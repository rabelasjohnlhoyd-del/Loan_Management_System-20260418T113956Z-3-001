import io
import datetime
import os
import mysql.connector
from flask import Blueprint, render_template, request, redirect, url_for, send_file, session, flash, jsonify, send_from_directory
from werkzeug.utils import secure_filename
from xhtml2pdf import pisa
from Loan_Management_System2 import db_config

# Blueprint setup
loans_bp = Blueprint(
    'loans', __name__,
    template_folder='templates',
    static_folder='static',
    static_url_path='/loans/static'
)

# Upload configuration
UPLOAD_FOLDER_DOCS = os.path.join(os.path.dirname(__file__), '..', 'Authentication', 'static', 'uploads', 'documents')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'pdf'}

# ================================================================
# SECTION 2: HELPER FUNCTIONS
# ================================================================
def get_db():
    return mysql.connector.connect(**db_config)

def is_logged_in():
    return session.get('logged_in', False)

def login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if not is_logged_in():
            flash('Please log in to access this page.', 'warning')
            return redirect(url_for('auth.login'))
        return f(*args, **kwargs)
    return decorated

def role_required(*roles):
    from functools import wraps
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if not is_logged_in():
                return redirect(url_for('auth.login')) 
            if session.get('role') not in roles:
                flash('Access denied.', 'danger')
                return redirect(url_for('auth.dashboard'))
            return f(*args, **kwargs)
        return decorated
    return decorator

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def generate_reference(prefix, table, col):
    conn = get_db()
    cursor = conn.cursor()
    year = datetime.datetime.now().year
    cursor.execute(f"SELECT COUNT(*) FROM {table} WHERE YEAR(created_at) = %s", (year,))
    count = cursor.fetchone()[0] + 1
    cursor.close()
    conn.close()
    return f"{prefix}-{year}-{str(count).zfill(6)}"

def calculate_monthly_payment(principal, annual_rate, months):
    if annual_rate == 0:
        return principal / months
    r = (annual_rate / 100) / 12
    payment = principal * (r * (1 + r) ** months) / ((1 + r) ** months - 1)
    return round(payment, 2)

def build_amortization(principal, annual_rate, months, start_date):
    schedule = []
    r = (annual_rate / 100) / 12
    monthly = calculate_monthly_payment(principal, annual_rate, months)
    balance = principal

    for i in range(1, months + 1):
        interest = round(balance * r, 2)
        principal_portion = round(monthly - interest, 2)
        if i == months:
            principal_portion = balance
        balance = round(balance - principal_portion, 2)
        
        # ✅ FIXED: This block is now INSIDE the loop
        due_date = start_date + datetime.timedelta(days=30 * i)
        schedule.append({
            'period_no': i,
            'due_date': due_date,
            'principal_due': principal_portion,
            'interest_due': interest,
            'total_due': round(principal_portion + interest, 2),
            'balance_after': max(balance, 0)
        })
    return schedule

# ================================================================
# SECTION 3: LOAN TYPES & PLANS
# ================================================================
@loans_bp.route('/loan-types')
@login_required
def loan_types():
    types = []
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM loan_types WHERE is_active = 1 ORDER BY id")
        types = cursor.fetchall()

        for t in types:
            cursor.execute("SELECT COUNT(*) AS cnt FROM loan_plans WHERE loan_type_id = %s AND is_active = 1", (t['id'],))
            # ✅ FIXED: Indented this so it runs for EVERY loan type
            t['plan_count'] = cursor.fetchone()['cnt']

        cursor.close()
        conn.close()
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')

    return render_template('loan_types.html', types=types)


# 3.2 VIEW PLANS UNDER A LOAN TYPE
@loans_bp.route('/loan-types/<int:type_id>/plans')
@login_required
def loan_plans(type_id):
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM loan_types WHERE id = %s", (type_id,))
        loan_type = cursor.fetchone()
        if not loan_type:
            flash('Loan type not found.', 'danger')
            return redirect(url_for('loans.loan_types'))

        cursor.execute("SELECT * FROM loan_plans WHERE loan_type_id = %s AND is_active = 1 ORDER BY min_amount", (type_id,))
        plans = cursor.fetchall()
        cursor.close()
        conn.close()
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')
        loan_type, plans = {}, []

    return render_template('loan_plans.html', loan_type=loan_type, plans=plans)


# 3.3 API: GET PLANS BY LOAN TYPE (AJAX)
@loans_bp.route('/api/plans/<int:type_id>')
@login_required
def api_plans(type_id):
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT id, plan_name, interest_rate, interest_type,
                   term_months_min, term_months_max,
                   min_amount, max_amount, processing_fee,
                   collateral_required, collateral_notes
            FROM loan_plans WHERE loan_type_id = %s AND is_active = 1
        """, (type_id,))
        plans = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify({'plans': plans})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# 3.4 API: LOAN CALCULATOR (AJAX)
@loans_bp.route('/api/calculate', methods=['POST'])
@login_required
def api_calculate():
    data = request.json
    try:
        principal = float(data.get('amount', 0))
        rate = float(data.get('rate', 0))
        months = int(data.get('months', 0))
        monthly = calculate_monthly_payment(principal, rate, months)
        total = round(monthly * months, 2)
        interest = round(total - principal, 2)
        return jsonify({
            'monthly_payment': monthly,
            'total_payment': total,
            'total_interest': interest
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400


# ================================================================
# SECTION 4: LOAN APPLICATION FLOW
# ================================================================
# 4.1 APPLY FOR LOAN (GET/POST)
@loans_bp.route('/apply', methods=['GET', 'POST'])
@login_required
@role_required('borrower')
def apply():
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM loan_types WHERE is_active = 1")
        types = cursor.fetchall()
        cursor.execute("SELECT lp.*, lt.name AS type_name FROM loan_plans lp JOIN loan_types lt ON lp.loan_type_id = lt.id WHERE lp.is_active = 1")
        plans = cursor.fetchall()

        cursor.execute("SELECT id_verification_status FROM users WHERE id = %s", (session['user_id'],))
        user = cursor.fetchone()
        cursor.close()
        conn.close()
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')
        return redirect(url_for('loans_bp.dashboard'))

    if user['id_verification_status'] != 'verified':
        flash('Your ID must be verified before applying for a loan.', 'warning')
        return redirect(url_for('loans_bp.borrower_dashboard'))

    # Start of POST logic (This must be indented)
    if request.method == 'POST':
        loan_type_id = request.form.get('loan_type_id')
        loan_plan_id = request.form.get('loan_plan_id')
        amount = request.form.get('amount', '').strip()
        term_months = request.form.get('term_months', '').strip()
        purpose = request.form.get('purpose', '').strip()

        errors = []
        if not all([loan_type_id, loan_plan_id, amount, term_months]):
            errors.append('All fields are required.')

        try:
            amount = float(amount)
            term_months = int(term_months)
        except ValueError:
            errors.append('Invalid amount or term.')

        if errors:
            for e in errors:
                flash(e, 'danger')
            
            selected_plan_id = request.form.get('loan_plan_id', type=int)
            return render_template('apply.html', types=types, plans=plans,
                                   selected_plan_id=selected_plan_id)

        try:
            conn = get_db()
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT * FROM loan_plans WHERE id = %s", (loan_plan_id,))
            plan = cursor.fetchone()
            cursor.close()
            conn.close()
        except Exception as e:
            flash(f'Error: {str(e)}', 'danger')
            return render_template('apply.html', types=types, plans=plans, selected_plan_id=None)

        if plan:
            if not (plan['min_amount'] <= amount <= plan['max_amount']):
                flash(f'Amount must be between ₱{plan["min_amount"]:,.2f} and ₱{plan["max_amount"]:,.2f}.', 'danger')
                return render_template('apply.html', types=types, plans=plans,
                                       selected_plan_id=int(loan_plan_id))
            if not (plan['term_months_min'] <= term_months <= plan['term_months_max']):
                flash(f'Term must be between {plan["term_months_min"]} and {plan["term_months_max"]} months.', 'danger')
                return render_template('apply.html', types=types, plans=plans,
                                       selected_plan_id=int(loan_plan_id))

        try:
            ref_no = generate_reference('LA', 'loan_applications', 'id')
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO loan_applications
                  (reference_no, borrower_id, loan_type_id, loan_plan_id,
                   amount_requested, term_months, purpose, status, submitted_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, 'submitted', NOW())
            """, (ref_no, session['user_id'], loan_type_id, loan_plan_id, amount, term_months, purpose))

            app_id = cursor.lastrowid

            docs = request.files.getlist('documents')
            os.makedirs(UPLOAD_FOLDER_DOCS, exist_ok=True)
            for doc in docs:
                if doc and allowed_file(doc.filename):
                    fname = secure_filename(f"doc_{app_id}_{datetime.datetime.now().timestamp()}_{doc.filename}")
                    doc.save(os.path.join(UPLOAD_FOLDER_DOCS, fname))
                    cursor.execute("""
                        INSERT INTO application_documents (application_id, document_type, file_path)
                        VALUES (%s, 'requirement', %s)
                    """, (app_id, fname))

            conn.commit()
            cursor.close()
            conn.close()

            flash(f'Application submitted successfully! Reference: {ref_no}', 'success')
            return redirect(url_for('loans.my_applications'))
        except Exception as e:
            flash(f'Error submitting application: {str(e)}', 'danger')

    # GET request — read ?plan= from URL (This must also be indented)
    selected_plan_id = request.args.get('plan', type=int)
    return render_template('apply.html', types=types, plans=plans,
                           selected_plan_id=selected_plan_id)


# 4.2 MY APPLICATIONS (LIST)
@loans_bp.route('/my-applications')
@login_required
@role_required('borrower')
def my_applications():
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT la.*, lt.name AS type_name, lp.plan_name, lp.interest_rate
            FROM loan_applications la
            JOIN loan_types lt ON la.loan_type_id = lt.id
            JOIN loan_plans lp ON la.loan_plan_id = lp.id
            WHERE la.borrower_id = %s
            ORDER BY la.submitted_at DESC
        """, (session['user_id'],))
        applications = cursor.fetchall()

        cursor.execute("""
            SELECT la.id, la.status, la.reference_no,
                   la.rejection_reason, la.reviewed_at,
                   lt.name AS type_name
            FROM loan_applications la
            JOIN loan_types lt ON la.loan_type_id = lt.id
            WHERE la.borrower_id = %s
              AND la.status IN ('approved', 'rejected', 'under_review', 'pending')
              AND la.reviewed_at IS NOT NULL
            ORDER BY
              FIELD(la.status, 'approved', 'rejected', 'under_review', 'pending'),
              la.reviewed_at DESC
        """, (session['user_id'],))
        notifications = cursor.fetchall()

        cursor.close()
        conn.close()
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')
        applications = []
        notifications = []

    return render_template('my_applications.html',
                           applications=applications,
                           notifications=notifications)


# 4.3 APPLICATION DETAIL (VIEW SPECIFIC)
@loans_bp.route('/applications/<int:app_id>')
@login_required
@role_required('borrower')
def application_detail(app_id):
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT la.*, lt.name AS type_name, lp.plan_name, lp.interest_rate,
                   lp.processing_fee, lp.collateral_required,
                   u.full_name AS borrower_name, u.email AS borrower_email
            FROM loan_applications la
            JOIN loan_types lt ON la.loan_type_id = lt.id
            JOIN loan_plans lp ON la.loan_plan_id = lp.id
            JOIN users u ON la.borrower_id = u.id
            WHERE la.id = %s AND la.borrower_id = %s
        """, (app_id, session['user_id']))
        app = cursor.fetchone()

        if not app:
            flash('Application not found.', 'danger')
            return redirect(url_for('loans.my_applications'))

        cursor.execute("SELECT * FROM application_documents WHERE application_id = %s", (app_id,))
        docs = cursor.fetchall()

        monthly = calculate_monthly_payment(
            float(app['amount_requested']),
            float(app['interest_rate']),
            app['term_months']
        )

        cursor.close()
        conn.close()
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')
        return redirect(url_for('loans.my_applications'))

    return render_template('application_detail.html', app=app, docs=docs, monthly_payment=monthly)


# ================================================================
# SECTION 5: ACTIVE LOANS MANAGEMENT
# ================================================================
# 5.1 MY LOANS (LIST)
@loans_bp.route('/my-loans')
@login_required
@role_required('borrower')
def my_loans():
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT l.*, lt.name AS type_name, lp.plan_name
            FROM loans l
            JOIN loan_types lt ON l.loan_type_id = lt.id
            JOIN loan_plans lp ON l.loan_plan_id = lp.id
            WHERE l.borrower_id = %s
            ORDER BY l.created_at DESC
        """, (session['user_id'],))
        my_loan_list = cursor.fetchall()
        cursor.close()
        conn.close()
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')
        my_loan_list = []

    return render_template('my_loans.html', loans=my_loan_list)


# 5.2 LOAN DETAIL (VIEW SPECIFIC LOAN)
@loans_bp.route('/my-loans/<int:loan_id>')
@login_required
@role_required('borrower')
def loan_detail(loan_id):
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT l.*, lt.name AS type_name, lp.plan_name, lp.interest_rate,
                   u.full_name AS borrower_name, u.email AS borrower_email
            FROM loans l
            JOIN loan_types lt ON l.loan_type_id = lt.id
            JOIN loan_plans lp ON l.loan_plan_id = lp.id
            JOIN users u ON l.borrower_id = u.id
            WHERE l.id = %s AND l.borrower_id = %s
        """, (loan_id, session['user_id']))
        loan = cursor.fetchone()

        if not loan:
            flash('Loan not found.', 'danger')
            return redirect(url_for('loans.my_loans'))

        cursor.execute("""
            SELECT * FROM amortization_schedule
            WHERE loan_id = %s
            ORDER BY period_no
        """, (loan_id,))
        schedule = cursor.fetchall()

        cursor.close()
        conn.close()
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')
        return redirect(url_for('loans.my_loans'))

    return render_template('loan_details.html',
                           loan=loan,
                           schedule=schedule,
                           now=datetime.datetime.now().date())


# ================================================================
# SECTION 6: NOTIFICATIONS SYSTEM
# ================================================================
# 6.1 FULL NOTIFICATIONS PAGE
@loans_bp.route('/notifications')
@login_required
def notifications_page():
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT id, type, title, message, link, is_read, created_at
            FROM notifications
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 50
        """, (session['user_id'],))
        notifs = cursor.fetchall()

        cursor.execute(
            "SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = %s AND is_read = 0",
            (session['user_id'],)
        )
        unread_count = cursor.fetchone()['cnt']

        cursor.close()
        conn.close()
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')
        notifs = []
        unread_count = 0

    return render_template('notifications.html',
                           notifications=notifs,
                           unread_count=unread_count)


# 6.2 API: GET UNREAD NOTIFICATION COUNT (AJAX)
@loans_bp.route('/api/notifications/count')
@login_required
def notif_count():
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = %s AND is_read = 0",
            (session['user_id'],)
        )
        count = cursor.fetchone()['cnt']
        cursor.close()
        conn.close()
        return jsonify({'count': count})
    except Exception as e:
        return jsonify({'count': 0})


# 6.3 API: GET NOTIFICATIONS LIST (AJAX)
@loans_bp.route('/api/notifications')
@login_required
def notif_list():
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT id, type, title, message, link, is_read,
                   created_at,
                   TIMESTAMPDIFF(MINUTE, created_at, NOW()) AS minutes_ago
            FROM notifications
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 10
        """, (session['user_id'],))
        notifs = cursor.fetchall()
        cursor.close()
        conn.close()

        for n in notifs:
            n['created_at'] = n['created_at'].strftime('%b %d, %Y %I:%M %p')
            mins = n['minutes_ago']
            if mins < 1:
                n['time_ago'] = 'Just now'
            elif mins < 60:
                n['time_ago'] = f'{mins}m ago'
            elif mins < 1440:
                n['time_ago'] = f'{mins // 60}h ago'
            else:
                n['time_ago'] = f'{mins // 1440}d ago'

        return jsonify({'notifications': notifs})
    except Exception as e:
        return jsonify({'notifications': [], 'error': str(e)})


# 6.4 API: MARK SINGLE NOTIFICATION AS READ (AJAX)
@loans_bp.route('/api/notifications/<int:notif_id>/read', methods=['POST'])
@login_required
def notif_mark_read(notif_id):
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE notifications SET is_read = 1 WHERE id = %s AND user_id = %s",
            (notif_id, session['user_id'])
        )
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


# 6.5 API: MARK ALL NOTIFICATIONS AS READ (AJAX)
@loans_bp.route('/api/notifications/read-all', methods=['POST'])
@login_required
def notif_mark_all_read():
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE notifications SET is_read = 1 WHERE user_id = %s AND is_read = 0",
            (session['user_id'],)
        )
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})
    


# ================================================================
# SECTION 7: DOCUMENT & PDF GENERATION
# ================================================================

# 1. VIEW KYC / APPLICATION DOCUMENTS
# Replace ALL occurrences of 'def view_doc' with this ONE function:
# ================================================================
# SECTION 7: DOCUMENTS, VIEWING & PDF GENERATION
# ================================================================

# 1. Unified View Function (ID, Selfie, Application Docs)
@loans_bp.route('/view-doc/<string:filename>')
@login_required
def view_doc(filename):
    doc_path = os.path.join(os.path.dirname(__file__), '..', 'Authentication', 'static', 'uploads', 'documents')
    user_path = os.path.join(os.path.dirname(__file__), '..', 'Authentication', 'static', 'uploads')
    
    # Check if file is in documents folder, if not check parent uploads folder
    if os.path.exists(os.path.join(doc_path, filename)):
        return send_from_directory(doc_path, filename)
    return send_from_directory(user_path, filename)

# 2. View Payment Proofs (Stored in proofs folder)
@loans_bp.route('/payment-proof/<int:payment_id>')
@login_required
def view_payment_proof(payment_id):
    conn = get_db(); cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT screenshot_path FROM payments WHERE id = %s", (payment_id,))
    res = cursor.fetchone()
    cursor.close(); conn.close()
    
    if res and res['screenshot_path']:
        proof_path = os.path.join(os.path.dirname(__file__), '..', 'Authentication', 'static', 'uploads', 'proofs')
        return send_from_directory(proof_path, res['screenshot_path'])
    flash("File not found", "danger")
    return redirect(url_for('auth.my_documents'))

# 3. Real PDF Receipt Download
@loans_bp.route('/download-receipt/<int:payment_id>')
@login_required
def download_receipt(payment_id):
    conn = get_db(); cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT p.*, u.full_name, l.reference_no FROM payments p JOIN users u ON p.borrower_id = u.id JOIN loans l ON p.loan_id = l.id WHERE p.id = %s", (payment_id,))
    pay = cursor.fetchone()
    cursor.close(); conn.close()
    
    html = f"<html><body style='font-family:Helvetica;'><h1>HIRAYA RECEIPT</h1><hr><p>Ref: {pay['payment_no']}</p><p>Amount: PHP {pay['amount_paid']:,.2f}</p><p>Date: {pay['payment_date']}</p></body></html>"
    pdf = io.BytesIO()
    pisa.CreatePDF(io.BytesIO(html.encode("UTF-8")), dest=pdf)
    pdf.seek(0)
    return send_file(pdf, mimetype='application/pdf', as_attachment=True, download_name=f"Receipt_{pay['payment_no']}.pdf")

# 4. Real PDF Loan Agreement
# 4. Real PDF Loan Agreement (FIXED KEYERROR)
@loans_bp.route('/download-agreement/<int:loan_id>')
@login_required
def download_agreement(loan_id):
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        # We select l.* which includes 'loan_no'
        cursor.execute("""
            SELECT l.*, u.full_name 
            FROM loans l 
            JOIN users u ON l.borrower_id = u.id 
            WHERE l.id = %s
        """, (loan_id,))
        loan = cursor.fetchone()
        cursor.close()
        conn.close()

        if not loan:
            flash("Loan record not found.", "danger")
            return redirect(url_for('auth.my_documents'))

        # ✅ FIXED: Changed loan['reference_no'] to loan['loan_no']
        html = f"""
        <html>
            <body style="font-family: Helvetica; padding: 30px;">
                <h1 style="text-align: center;">LOAN AGREEMENT</h1>
                <p>This document certifies that <strong>{loan['full_name']}</strong> 
                   has an active loan with the reference number: <strong>{loan['loan_no']}</strong>.</p>
                <p>Date of Issue: {datetime.datetime.now().strftime('%Y-%m-%d')}</p>
                <br><br>
                <p>__________________________</p>
                <p>Authorized Signature</p>
            </body>
        </html>
        """
        
        pdf_out = io.BytesIO()
        pisa.CreatePDF(io.BytesIO(html.encode("UTF-8")), dest=pdf_out)
        pdf_out.seek(0)

        return send_file(
            pdf_out, 
            mimetype='application/pdf', 
            as_attachment=True, 
            download_name=f"Agreement_{loan['loan_no']}.pdf"
        )
    except Exception as e:
        flash(f"Error: {str(e)}", "danger")
        return redirect(url_for('auth.my_documents'))

# 5. Real PDF Amortization
@loans_bp.route('/amortization-pdf/<int:loan_id>')
@login_required
def amortization_pdf(loan_id):
    pdf = io.BytesIO()
    pisa.CreatePDF(io.BytesIO("<p>Amortization Schedule Content</p>".encode("UTF-8")), dest=pdf)
    pdf.seek(0)
    return send_file(pdf, mimetype='application/pdf', as_attachment=True, download_name="Amortization_Schedule.pdf")

@loans_bp.route('/payment-history-pdf/<int:loan_id>')
@login_required
def payment_history_pdf(loan_id):
    pdf = io.BytesIO()
    pisa.CreatePDF(io.BytesIO("<p>Payment History Content</p>".encode("UTF-8")), dest=pdf)
    pdf.seek(0)
    return send_file(pdf, mimetype='application/pdf', as_attachment=True, download_name="Payment_History.pdf")