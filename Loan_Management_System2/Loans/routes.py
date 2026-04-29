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

# ================================================================
# SECTION 1: UPLOAD PATH CONFIGURATION
# ================================================================
_BASE_DIR        = os.path.dirname(__file__)
_AUTH_STATIC     = os.path.join(_BASE_DIR, '..', 'Authentication', 'static')
UPLOAD_ROOT      = os.path.join(_AUTH_STATIC, 'uploads')
UPLOAD_DOCS      = os.path.join(UPLOAD_ROOT, 'documents')
UPLOAD_PROOFS    = os.path.join(UPLOAD_ROOT, 'proofs')

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
    conn   = get_db()
    cursor = conn.cursor()
    year   = datetime.datetime.now().year
    cursor.execute(f"SELECT COUNT(*) FROM {table} WHERE YEAR(created_at) = %s", (year,))
    count  = cursor.fetchone()[0] + 1
    cursor.close()
    conn.close()
    return f"{prefix}-{year}-{str(count).zfill(6)}"

def calculate_monthly_payment(principal, annual_rate, months):
    if annual_rate == 0:
        return principal / months
    r       = (annual_rate / 100) / 12
    payment = principal * (r * (1 + r) ** months) / ((1 + r) ** months - 1)
    return round(payment, 2)

def build_amortization(principal, annual_rate, months, start_date):
    schedule = []
    r        = (annual_rate / 100) / 12
    monthly  = calculate_monthly_payment(principal, annual_rate, months)
    balance  = principal

    for i in range(1, months + 1):
        interest          = round(balance * r, 2)
        principal_portion = round(monthly - interest, 2)
        if i == months:
            principal_portion = balance
        balance  = round(balance - principal_portion, 2)
        due_date = start_date + datetime.timedelta(days=30 * i)
        schedule.append({
            'period_no':     i,
            'due_date':      due_date,
            'principal_due': principal_portion,
            'interest_due':  interest,
            'total_due':     round(principal_portion + interest, 2),
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
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM loan_types WHERE is_active = 1 ORDER BY id")
        types = cursor.fetchall()

        for t in types:
            cursor.execute("""
                SELECT COUNT(*) AS cnt FROM loan_plans
                WHERE loan_type_id = %s AND is_active = 1
            """, (t['id'],))
            t['plan_count'] = cursor.fetchone()['cnt']

        cursor.close()
        conn.close()
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')

    return render_template('loan_types.html', types=types)


@loans_bp.route('/loan-types/<int:type_id>/plans')
@login_required
def loan_plans(type_id):
    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM loan_types WHERE id = %s", (type_id,))
        loan_type = cursor.fetchone()

        if not loan_type:
            flash('Loan type not found.', 'danger')
            return redirect(url_for('loans.loan_types'))

        cursor.execute("""
            SELECT * FROM loan_plans
            WHERE loan_type_id = %s AND is_active = 1
            ORDER BY min_amount
        """, (type_id,))
        plans = cursor.fetchall()
        cursor.close()
        conn.close()
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')
        loan_type, plans = {}, []

    return render_template('loan_plans.html', loan_type=loan_type, plans=plans)


@loans_bp.route('/api/plans/<int:type_id>')
@login_required
def api_plans(type_id):
    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT id, plan_name, interest_rate, interest_type,
                   term_months_min, term_months_max,
                   min_amount, max_amount, processing_fee,
                   collateral_required, collateral_notes
            FROM loan_plans
            WHERE loan_type_id = %s AND is_active = 1
        """, (type_id,))
        plans = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify({'plans': plans})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@loans_bp.route('/api/calculate', methods=['POST'])
@login_required
def api_calculate():
    data = request.json
    try:
        principal = float(data.get('amount', 0))
        rate      = float(data.get('rate', 0))
        months    = int(data.get('months', 0))
        monthly   = calculate_monthly_payment(principal, rate, months)
        total     = round(monthly * months, 2)
        interest  = round(total - principal, 2)
        return jsonify({
            'monthly_payment': monthly,
            'total_payment':   total,
            'total_interest':  interest,
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400


# ================================================================
# SECTION 4: LOAN APPLICATION FLOW
# ================================================================

@loans_bp.route('/apply', methods=['GET', 'POST'])
@login_required
@role_required('borrower')
def apply():
    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM loan_types WHERE is_active = 1")
        types = cursor.fetchall()

        cursor.execute("""
            SELECT lp.*, lt.name AS type_name
            FROM loan_plans lp
            JOIN loan_types lt ON lp.loan_type_id = lt.id
            WHERE lp.is_active = 1
        """)
        plans = cursor.fetchall()

        cursor.execute(
            "SELECT id_verification_status FROM users WHERE id = %s",
            (session['user_id'],)
        )
        user = cursor.fetchone()
        cursor.close()
        conn.close()
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')
        return redirect(url_for('borrower.borrower_dashboard'))

    if user['id_verification_status'] != 'verified':
        flash('Your ID must be verified before applying for a loan.', 'warning')
        return redirect(url_for('borrower.borrower_dashboard'))

    if request.method == 'POST':
        loan_type_id = request.form.get('loan_type_id')
        loan_plan_id = request.form.get('loan_plan_id')
        amount       = request.form.get('amount', '').strip()
        term_months  = request.form.get('term_months', '').strip()
        purpose      = request.form.get('purpose', '').strip()

        errors = []
        if not all([loan_type_id, loan_plan_id, amount, term_months]):
            errors.append('All fields are required.')

        try:
            amount      = float(amount)
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
            conn   = get_db()
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT * FROM loan_plans WHERE id = %s", (loan_plan_id,))
            plan = cursor.fetchone()
            cursor.close()
            conn.close()
        except Exception as e:
            flash(f'Error: {str(e)}', 'danger')
            return render_template('apply.html', types=types, plans=plans,
                                   selected_plan_id=None)

        if plan:
            if not (plan['min_amount'] <= amount <= plan['max_amount']):
                flash(
                    f'Amount must be between ₱{plan["min_amount"]:,.2f} '
                    f'and ₱{plan["max_amount"]:,.2f}.',
                    'danger'
                )
                return render_template('apply.html', types=types, plans=plans,
                                       selected_plan_id=int(loan_plan_id))

            if not (plan['term_months_min'] <= term_months <= plan['term_months_max']):
                flash(
                    f'Term must be between {plan["term_months_min"]} '
                    f'and {plan["term_months_max"]} months.',
                    'danger'
                )
                return render_template('apply.html', types=types, plans=plans,
                                       selected_plan_id=int(loan_plan_id))

        try:
            ref_no = generate_reference('LA', 'loan_applications', 'id')
            conn   = get_db()
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO loan_applications
                  (reference_no, borrower_id, loan_type_id, loan_plan_id,
                   amount_requested, term_months, purpose, status, submitted_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, 'submitted', NOW())
            """, (ref_no, session['user_id'], loan_type_id, loan_plan_id,
                  amount, term_months, purpose))

            app_id = cursor.lastrowid

            docs = request.files.getlist('documents')
            os.makedirs(UPLOAD_DOCS, exist_ok=True)
            for doc in docs:
                if doc and allowed_file(doc.filename):
                    fname = secure_filename(
                        f"doc_{app_id}_{datetime.datetime.now().timestamp()}_{doc.filename}"
                    )
                    doc.save(os.path.join(UPLOAD_DOCS, fname))
                    cursor.execute("""
                        INSERT INTO application_documents
                          (application_id, document_type, file_path)
                        VALUES (%s, 'requirement', %s)
                    """, (app_id, fname))

            conn.commit()
            cursor.close()
            conn.close()

            flash(f'Application submitted! Reference: {ref_no}', 'success')
            return redirect(url_for('loans.my_applications'))

        except Exception as e:
            flash(f'Error submitting application: {str(e)}', 'danger')

    selected_plan_id = request.args.get('plan', type=int)
    return render_template('apply.html', types=types, plans=plans,
                           selected_plan_id=selected_plan_id)


@loans_bp.route('/my-applications')
@login_required
@role_required('borrower')
def my_applications():
    try:
        conn   = get_db()
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


@loans_bp.route('/applications/<int:app_id>')
@login_required
@role_required('borrower')
def application_detail(app_id):
    try:
        conn   = get_db()
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

        cursor.execute(
            "SELECT * FROM application_documents WHERE application_id = %s",
            (app_id,)
        )
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

    return render_template('B_application_detail.html',
                           app=app, docs=docs, monthly_payment=monthly)


# ================================================================
# SECTION 5: ACTIVE LOANS MANAGEMENT
# ================================================================

@loans_bp.route('/my-loans')
@login_required
@role_required('borrower')
def my_loans():
    try:
        conn   = get_db()
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


@loans_bp.route('/my-loans/<int:loan_id>')
@login_required
@role_required('borrower')
def loan_detail(loan_id):
    try:
        conn   = get_db()
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
        raw_schedule = cursor.fetchall()
 
        cursor.close()
        conn.close()
 
        import datetime as dt
        today = dt.date.today()
 
        schedule = []
        for row in raw_schedule:
            if row.get('is_paid') == 1 or row.get('is_paid') is True:
                row['status'] = 'paid'
            else:
                due = row.get('due_date')
                if due and isinstance(due, dt.date) and due < today:
                    row['status'] = 'overdue'
                else:
                    row['status'] = 'upcoming'
            schedule.append(row)
 
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')
        return redirect(url_for('loans.my_loans'))
 
    return render_template('loan_details.html',
                           loan=loan,
                           schedule=schedule,
                           now=dt.datetime.now().date())

# ================================================================
# SECTION 6: NOTIFICATIONS SYSTEM
# ================================================================

@loans_bp.route('/notifications')
@login_required
def notifications_page():
    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT id, type, title, message, link, is_read, created_at
            FROM notifications
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 50
        """, (session['user_id'],))
        notifs = cursor.fetchall()

        cursor.execute("""
            SELECT COUNT(*) AS cnt FROM notifications
            WHERE user_id = %s AND is_read = 0
        """, (session['user_id'],))
        unread_count = cursor.fetchone()['cnt']

        cursor.close()
        conn.close()
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')
        notifs       = []
        unread_count = 0

    return render_template('notifications.html',
                           notifications=notifs,
                           unread_count=unread_count)


@loans_bp.route('/api/notifications/count')
@login_required
def notif_count():
    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT COUNT(*) AS cnt FROM notifications
            WHERE user_id = %s AND is_read = 0
        """, (session['user_id'],))
        count = cursor.fetchone()['cnt']
        cursor.close()
        conn.close()
        return jsonify({'count': count})
    except Exception:
        return jsonify({'count': 0})


@loans_bp.route('/api/notifications')
@login_required
def notif_list():
    try:
        conn   = get_db()
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


@loans_bp.route('/api/notifications/<int:notif_id>/read', methods=['POST'])
@login_required
def notif_mark_read(notif_id):
    try:
        conn   = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE notifications SET is_read = 1
            WHERE id = %s AND user_id = %s
        """, (notif_id, session['user_id']))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@loans_bp.route('/api/notifications/read-all', methods=['POST'])
@login_required
def notif_mark_all_read():
    try:
        conn   = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE notifications SET is_read = 1
            WHERE user_id = %s AND is_read = 0
        """, (session['user_id'],))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


# ================================================================
# SECTION 7: DOCUMENT VIEWING & PDF GENERATION
# ================================================================

@loans_bp.route('/view-doc/<string:filename>')
@login_required
def view_doc(filename):
    if os.path.exists(os.path.join(UPLOAD_DOCS, filename)):
        return send_from_directory(UPLOAD_DOCS, filename)
    return send_from_directory(UPLOAD_ROOT, filename)


@loans_bp.route('/payment-proof/<int:payment_id>')
@login_required
def view_payment_proof(payment_id):
    conn   = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        "SELECT screenshot_path FROM payments WHERE id = %s",
        (payment_id,)
    )
    res = cursor.fetchone()
    cursor.close()
    conn.close()

    if res and res['screenshot_path']:
        return send_from_directory(UPLOAD_PROOFS, res['screenshot_path'])

    flash('File not found.', 'danger')
    return redirect(url_for('borrower.my_documents'))


@loans_bp.route('/download-receipt/<int:payment_id>')
@login_required
def download_receipt(payment_id):
    conn   = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT p.*, u.full_name, l.loan_no
        FROM payments p
        JOIN users u  ON p.borrower_id = u.id
        JOIN loans l  ON p.loan_id     = l.id
        WHERE p.id = %s
    """, (payment_id,))
    pay = cursor.fetchone()
    cursor.close()
    conn.close()

    if not pay:
        flash('Payment not found.', 'danger')
        return redirect(url_for('borrower.payment_history'))

    html = f"""
    <html>
      <body style="font-family:Helvetica;padding:30px;">
        <h1>HIRAYA RECEIPT</h1>
        <hr>
        <p>Reference No: {pay['payment_no']}</p>
        <p>Loan No: {pay['loan_no']}</p>
        <p>Borrower: {pay['full_name']}</p>
        <p>Amount Paid: PHP {float(pay['amount_paid']):,.2f}</p>
        <p>Payment Date: {pay['payment_date']}</p>
        <p>Status: {pay['status']}</p>
      </body>
    </html>
    """
    pdf = io.BytesIO()
    pisa.CreatePDF(io.BytesIO(html.encode('UTF-8')), dest=pdf)
    pdf.seek(0)
    return send_file(
        pdf,
        mimetype='application/pdf',
        as_attachment=True,
        download_name=f"Receipt_{pay['payment_no']}.pdf"
    )


# 7.4 PDF LOAN AGREEMENT - FIXED with inline viewing
@loans_bp.route('/download-agreement/<int:loan_id>')
@login_required
def download_agreement(loan_id):
    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)
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
            flash('Loan record not found.', 'danger')
            return redirect(url_for('borrower.my_documents'))

        html = f"""
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
  @page {{
    size: A4;
    margin: 1.5cm;
  }}

  * {{
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }}

  body {{
    font-family: Helvetica, Arial, sans-serif;
    background: #fff;
    color: #2c3e2f;
    font-size: 11pt;
    line-height: 1.5;
  }}

  .header {{
    background: #1a6b5e;
    padding: 25px 30px 20px;
    margin-bottom: 25px;
    text-align: center;
  }}

  .logo {{
    font-size: 28px;
    font-weight: bold;
    color: #fff;
    margin-bottom: 8px;
  }}

  .brand-name {{
    font-size: 18px;
    font-weight: bold;
    color: #fff;
  }}

  .brand-sub {{
    font-size: 10px;
    color: #c8e6e0;
    margin-bottom: 15px;
  }}

  .header-title {{
    font-size: 24px;
    font-weight: bold;
    color: #fff;
    letter-spacing: 2px;
    margin: 15px 0 10px;
  }}

  .ref-pill {{
    background: #0d5247;
    padding: 5px 15px;
    font-size: 9pt;
    color: #e0f0ec;
    display: inline-block;
  }}

  .body {{
    padding: 0 10px;
  }}

  .section-label {{
    font-size: 11pt;
    font-weight: bold;
    color: #1a6b5e;
    border-bottom: 2px solid #1a6b5e;
    margin: 20px 0 12px 0;
    padding-bottom: 5px;
  }}

  .section-label-first {{
    font-size: 11pt;
    font-weight: bold;
    color: #1a6b5e;
    border-bottom: 2px solid #1a6b5e;
    margin: 0 0 12px 0;
    padding-bottom: 5px;
  }}

  .overview-text {{
    background: #f0f8f6;
    padding: 12px 15px;
    margin-bottom: 20px;
    text-align: justify;
    border: 1px solid #d0e6e0;
  }}

  .loan-details-card {{
    border: 1px solid #d0e6e0;
    margin-bottom: 20px;
    background: #fff;
  }}

  .details-header {{
    background: #e8f3f0;
    padding: 8px 15px;
    border-bottom: 1px solid #d0e6e0;
    font-weight: bold;
    font-size: 10pt;
    color: #1a6b5e;
  }}

  .details-table {{
    width: 100%;
    border-collapse: collapse;
  }}

  .details-table td {{
    padding: 10px 15px;
    vertical-align: top;
    border-bottom: 1px solid #f0f0f0;
  }}

  .detail-label {{
    font-size: 8pt;
    font-weight: bold;
    color: #6b8f88;
    display: block;
    text-transform: uppercase;
  }}

  .detail-value {{
    font-size: 11pt;
    font-weight: bold;
    color: #2c3e2f;
  }}

  .status-badge {{
    background: #e8f5f2;
    color: #1a6b5e;
    padding: 2px 8px;
    font-size: 9pt;
    font-weight: bold;
    display: inline-block;
  }}

  .term-item {{
    margin-bottom: 12px;
    text-align: justify;
  }}

  .term-number {{
    font-weight: bold;
    color: #1a6b5e;
  }}

  .acknowledge-box {{
    background: #fef9e8;
    border-left: 4px solid #d4a373;
    padding: 12px 15px;
    margin: 20px 0 25px;
    text-align: center;
  }}

  .signatures {{
    margin: 25px 0 20px;
  }}

  .sig-table {{
    width: 100%;
    border-collapse: collapse;
    margin-top: 10px;
  }}

  .sig-table td {{
    width: 50%;
    padding: 0 15px;
    vertical-align: top;
  }}

  .sig-table td:first-child {{
    padding-left: 0;
  }}

  .sig-table td:last-child {{
    padding-right: 0;
  }}

  .sig-card {{
    background: #fafdfc;
    border: 1px solid #d0e6e0;
    padding: 25px 15px 15px 15px;
    text-align: center;
  }}

  .sig-line {{
    border-top: 1px solid #b8d4cc;
    width: 80%;
    margin: 0 auto 8px auto;
  }}

  .sig-name {{
    font-size: 11pt;
    font-weight: bold;
    color: #2c3e2f;
    margin: 5px 0 2px;
  }}

  .sig-role {{
    font-size: 9pt;
    color: #6b8f88;
  }}

  .sig-date {{
    font-size: 8pt;
    color: #9bbdb5;
    margin-top: 8px;
  }}

  .divider {{
    border-top: 1px solid #d0e6e0;
    margin: 15px 0 10px;
  }}

  .footer {{
    border-top: 1px solid #d0e6e0;
    padding-top: 12px;
    margin-top: 20px;
    font-size: 8pt;
    color: #9bbdb5;
    text-align: center;
  }}
</style>
</head>
<body>

<div class="header">
  <div class="logo">Hiraya</div>
  <div class="brand-name">Management System</div>
  <div class="brand-sub">Financial Services</div>
  <div class="header-title">LOAN AGREEMENT</div>
  <div class="ref-pill">
    Reference No. {loan['loan_no']} &nbsp;|&nbsp; Issued {datetime.datetime.now().strftime('%B %d, %Y')}
  </div>
</div>

<div class="body">

  <div class="section-label-first">Overview</div>
  <div class="overview-text">
    This Loan Agreement is entered into as of <strong>{datetime.datetime.now().strftime('%B %d, %Y')}</strong>,
    between <strong>Hiraya Management System</strong> (the "Lender") and
    <strong>{loan['full_name']}</strong> (the "Borrower"). By accepting or signing this agreement,
    the Borrower agrees to all terms and conditions set forth herein.
  </div>

  <div class="section-label">Loan Details</div>
  <div class="loan-details-card">
    <div class="details-header">📋 Loan Information</div>
    <table class="details-table">
      <tr>
        <td style="width: 50%;">
          <span class="detail-label">Loan Reference No.</span>
          <span class="detail-value">{loan['loan_no']}</span>
        </td>
        <td style="width: 50%;">
          <span class="detail-label">Date of Issue</span>
          <span class="detail-value">{datetime.datetime.now().strftime('%B %d, %Y')}</span>
         </td>
      </tr>
      <tr>
        <tr>
          <span class="detail-label">Borrower</span>
          <span class="detail-value">{loan['full_name']}</span>
        </td>
        <td>
          <span class="detail-label">Status</span>
          <span class="status-badge">{loan.get('status', 'Active').title()}</span>
        </td>
      </tr>
      <tr>
        <td>
          <span class="detail-label">Principal Amount</span>
          <span class="detail-value">PHP {float(loan['principal_amount']):,.2f}</span>
        </td>
        <td>
          <span class="detail-label">Document Type</span>
          <span class="detail-value">Loan Agreement</span>
        </td>
      </tr>
    </table>
  </div>

  <div class="section-label">Terms &amp; Conditions</div>
  <div class="terms">
    <div class="term-item"><span class="term-number">1. Repayment.</span> The Borrower agrees to repay the full loan amount plus applicable interest on the agreed schedule. Failure to pay on time may result in penalties and additional charges as defined in the company policy.</div>
    <div class="term-item"><span class="term-number">2. Interest.</span> Interest shall be computed based on the loan type and plan selected at the time of application, as reflected in the amortization schedule provided to the Borrower upon loan release.</div>
    <div class="term-item"><span class="term-number">3. Late Payment.</span> A penalty charge of <strong>2% per month</strong> shall be imposed on any overdue amount. Continued non-payment may result in loan restructuring or legal action without further notice.</div>
    <div class="term-item"><span class="term-number">4. Prepayment.</span> The Borrower may prepay all or part of the outstanding balance at any time without penalty. Prepayments shall be applied first to accrued interest, then to the remaining principal balance.</div>
    <div class="term-item"><span class="term-number">5. Default.</span> The loan shall be in default if payment is not received within <strong>30 days</strong> of the due date, making the entire outstanding balance immediately due and payable.</div>
    <div class="term-item"><span class="term-number">6. Governing Law.</span> This Agreement shall be governed by the laws of the Republic of the Philippines. Any disputes shall be settled in the proper courts of jurisdiction in the city where the Lender operates.</div>
  </div>

  <div class="acknowledge-box">
    <strong>📄 Acknowledgment</strong><br/>
    By signing below, the Borrower acknowledges having read, understood, and agreed to all the
    terms and conditions of this Loan Agreement. The Borrower confirms that all information provided
    is true and correct.
  </div>

  <div class="section-label">Signatures</div>
  <div class="signatures">
    <table class="sig-table">
      <tr>
        <td>
          <div class="sig-card">
            <div class="sig-line"></div>
            <div class="sig-name">{loan['full_name']}</div>
            <div class="sig-role">Borrower</div>
            <div class="sig-date">Date: _________________</div>
          </div>
        </td>
        <td>
          <div class="sig-card">
            <div class="sig-line"></div>
            <div class="sig-name">Hiraya Management System</div>
            <div class="sig-role">Authorized Signatory</div>
            <div class="sig-date">Date: _________________</div>
          </div>
        </td>
      </tr>
    </table>
  </div>

  <div class="divider"></div>

  <div class="footer">
    Generated by Hiraya Management System &nbsp;|&nbsp; {datetime.datetime.now().strftime('%B %d, %Y')}
    &nbsp;|&nbsp; Ref: {loan['loan_no']} &nbsp;|&nbsp; <strong>CONFIDENTIAL</strong>
  </div>

</div>
</body>
</html>
"""

        pdf_out = io.BytesIO()
        pisa.CreatePDF(io.BytesIO(html.encode('UTF-8')), dest=pdf_out)
        pdf_out.seek(0)

        # Get inline parameter from request
        # ?inline=1 = display in browser (for View button)
        # no inline or ?inline=0 = download (for Download button)
        inline = request.args.get('inline', '0') == '1'

        return send_file(
            pdf_out,
            mimetype='application/pdf',
            as_attachment=not inline,  # If inline=True, don't force download
            download_name=f"Agreement_{loan['loan_no']}.pdf"
        )
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')
        return redirect(url_for('borrower.my_documents'))


# 7.5 PDF AMORTIZATION SCHEDULE - Consistent with Loan Agreement design
@loans_bp.route('/amortization-pdf/<int:loan_id>')
@login_required
def amortization_pdf(loan_id):
    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT l.*, lt.name AS type_name, lp.plan_name, lp.interest_rate,
                   u.full_name, u.email
            FROM loans l 
            JOIN users u ON l.borrower_id = u.id
            JOIN loan_types lt ON l.loan_type_id = lt.id
            JOIN loan_plans lp ON l.loan_plan_id = lp.id
            WHERE l.id = %s
        """, (loan_id,))
        loan = cursor.fetchone()

        cursor.execute("""
            SELECT * FROM amortization_schedule
            WHERE loan_id = %s ORDER BY period_no
        """, (loan_id,))
        schedule = cursor.fetchall()
        cursor.close()
        conn.close()

        if not loan:
            flash('Loan not found.', 'danger')
            return redirect(url_for('borrower.my_documents'))

        # Build schedule rows
        rows = ''
        for s in schedule:
            status_text = '✓ Paid' if s['is_paid'] else '○ Upcoming'
            rows += f"""
            <tr>
                <td style="padding: 8px; text-align: center; border-bottom: 1px solid #deecea;">{s['period_no']}</td>
                <td style="padding: 8px; text-align: center; border-bottom: 1px solid #deecea;">{s['due_date'].strftime('%b %d, %Y') if s['due_date'] else '—'}</td>
                <td style="padding: 8px; text-align: right; border-bottom: 1px solid #deecea;">₱{float(s['principal_due']):,.2f}</td>
                <td style="padding: 8px; text-align: right; border-bottom: 1px solid #deecea;">₱{float(s['interest_due']):,.2f}</td>
                <td style="padding: 8px; text-align: right; border-bottom: 1px solid #deecea; font-weight: bold;">₱{float(s['total_due']):,.2f}</td>
                <td style="padding: 8px; text-align: right; border-bottom: 1px solid #deecea;">₱{float(s['balance_after']):,.2f}</td>
                <td style="padding: 8px; text-align: center; border-bottom: 1px solid #deecea;">
                    <span style="background: {'#e8f5f2' if s['is_paid'] else '#fffbea'}; color: {'#1a6b5e' if s['is_paid'] else '#d97706'}; padding: 2px 8px; border-radius: 12px; font-size: 9px;">
                        {status_text}
                    </span>
                </td>
            </tr>
            """

        html = f"""
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
  @page {{
    size: A4 landscape;
    margin: 1.5cm;
  }}

  * {{
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }}

  body {{
    font-family: Helvetica, Arial, sans-serif;
    background: #fff;
    color: #2c3e2f;
    font-size: 10pt;
    line-height: 1.5;
  }}

  .header {{
    background: #1a6b5e;
    padding: 20px 30px 15px;
    margin-bottom: 20px;
    text-align: center;
  }}

  .logo {{
    font-size: 22px;
    font-weight: bold;
    color: #fff;
    margin-bottom: 5px;
  }}

  .brand-sub {{
    font-size: 9px;
    color: #c8e6e0;
    margin-bottom: 10px;
  }}

  .header-title {{
    font-size: 18px;
    font-weight: bold;
    color: #fff;
    letter-spacing: 1px;
    margin: 8px 0 8px;
  }}

  .ref-pill {{
    background: #0d5247;
    padding: 4px 12px;
    font-size: 8pt;
    color: #e0f0ec;
    display: inline-block;
  }}

  .body {{
    padding: 0 10px;
  }}

  .section-label {{
    font-size: 11pt;
    font-weight: bold;
    color: #1a6b5e;
    border-bottom: 2px solid #1a6b5e;
    margin: 15px 0 12px 0;
    padding-bottom: 5px;
  }}

  .loan-info {{
    background: #f0f8f6;
    padding: 12px 15px;
    margin-bottom: 20px;
    border: 1px solid #d0e6e0;
  }}

  .info-table {{
    width: 100%;
    border-collapse: collapse;
  }}

  .info-table td {{
    padding: 5px 8px;
    vertical-align: top;
  }}

  .info-label {{
    font-size: 8pt;
    font-weight: bold;
    color: #6b8f88;
    width: 100px;
  }}

  .info-value {{
    font-size: 10pt;
    color: #2c3e2f;
  }}

  table {{
    width: 100%;
    border-collapse: collapse;
    margin-top: 10px;
  }}

  th {{
    background: #e8f3f0;
    padding: 8px 6px;
    font-size: 9pt;
    font-weight: bold;
    color: #1a6b5e;
    text-align: center;
    border-bottom: 1px solid #d0e6e0;
  }}

  td {{
    border-bottom: 1px solid #deecea;
  }}

  .footer {{
    border-top: 1px solid #d0e6e0;
    padding-top: 10px;
    margin-top: 20px;
    font-size: 8pt;
    color: #9bbdb5;
    text-align: center;
  }}
</style>
</head>
<body>

<div class="header">
  <div class="logo">Hiraya</div>
  <div class="brand-sub">Management System</div>
  <div class="header-title">AMORTIZATION SCHEDULE</div>
  <div class="ref-pill">
    Loan Reference: {loan['loan_no']} &nbsp;|&nbsp; Generated {datetime.datetime.now().strftime('%B %d, %Y')}
  </div>
</div>

<div class="body">

  <div class="section-label">Loan Information</div>
  <div class="loan-info">
    <table class="info-table">
      <tr>
        <td><span class="info-label">Borrower:</span></td>
        <td><span class="info-value">{loan['full_name']}</span></td>
        <td><span class="info-label">Loan Type:</span></td>
        <td><span class="info-value">{loan['type_name']}</span></td>
      </tr>
      <tr>
        <td><span class="info-label">Principal Amount:</span></td>
        <td><span class="info-value">₱{float(loan['principal_amount']):,.2f}</span></td>
        <td><span class="info-label">Interest Rate:</span></td>
        <td><span class="info-value">{loan['interest_rate']}%</span></td>
      </tr>
      <tr>
        <td><span class="info-label">Term:</span></td>
        <td><span class="info-value">{len(schedule)} months</span></td>
        <td><span class="info-label">Plan:</span></td>
        <td><span class="info-value">{loan['plan_name']}</span></td>
      </tr>
    </table>
  </div>

  <div class="section-label">Payment Schedule</div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Due Date</th>
        <th>Principal</th>
        <th>Interest</th>
        <th>Total Due</th>
        <th>Balance</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      {rows}
    </tbody>
  </table>

  <div class="footer">
    Generated by Hiraya Management System &nbsp;|&nbsp; {datetime.datetime.now().strftime('%B %d, %Y')}
    &nbsp;|&nbsp; Ref: {loan['loan_no']} &nbsp;|&nbsp; CONFIDENTIAL
  </div>

</div>
</body>
</html>
"""

        pdf = io.BytesIO()
        pisa.CreatePDF(io.BytesIO(html.encode('UTF-8')), dest=pdf)
        pdf.seek(0)
        
        inline = request.args.get('inline', '0') == '1'
        
        return send_file(
            pdf,
            mimetype='application/pdf',
            as_attachment=not inline,
            download_name=f"Amortization_{loan['loan_no']}.pdf"
        )
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')
        return redirect(url_for('borrower.my_documents'))


# 7.6 PDF PAYMENT HISTORY - UPDATED with inline support
@loans_bp.route('/payment-history-pdf/<int:loan_id>')
@login_required
def payment_history_pdf(loan_id):
    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT l.*, u.full_name
            FROM loans l JOIN users u ON l.borrower_id = u.id
            WHERE l.id = %s
        """, (loan_id,))
        loan = cursor.fetchone()

        cursor.execute("""
            SELECT * FROM payments
            WHERE loan_id = %s
            ORDER BY payment_date DESC
        """, (loan_id,))
        payments = cursor.fetchall()
        cursor.close()
        conn.close()

        # Calculate total paid
        total_paid = sum(float(p['amount_paid']) for p in payments) if payments else 0
        
        # Calculate remaining balance
        remaining_balance = float(loan['principal_amount']) - total_paid if loan else 0

        rows = ''.join([
            f"<tr style='{'background:#e8f5f2' if loop.index % 2 == 0 else ''}'>"
            f"<td>{p['payment_no']}</td>"
            f"<td>{p['payment_date'].strftime('%b %d, %Y') if p['payment_date'] else '—'}</td>"
            f"<td>₱{float(p['amount_paid']):,.2f}</td>"
            f"<td>{p['payment_method'] or '—'}</td>"
            f"<td><span style='padding:2px 8px;border-radius:20px;font-size:10px;"
            f"background:{'#22c55e20' if p['status']=='approved' else '#f59e0b20' if p['status']=='pending' else '#ef444420'};"
            f"color:{'#16a34a' if p['status']=='approved' else '#d97706' if p['status']=='pending' else '#dc2626'}'>"
            f"{'Approved' if p['status']=='approved' else 'Pending' if p['status']=='pending' else 'Rejected'}</span></td></tr>"
            for p in payments
        ])

        html = f"""
        <html>
          <head><meta charset="UTF-8"/></head>
          <body style="font-family:Helvetica;padding:20px;">
            <h2>Payment History Statement — {loan['loan_no']}</h2>
            <p>Borrower: {loan['full_name']}</p>
            <p>Loan Type: {loan['type_name'] if loan.get('type_name') else '—'}</p>
            <hr/>
            <table border="1" cellpadding="4" cellspacing="0" width="100%" style="border-collapse:collapse;">
              <thead style="background:#1a6b5e;color:white;">
                <tr><th>Reference No.</th><th>Payment Date</th><th>Amount</th>
                    <th>Method</th><th>Status</th></tr>
              </thead>
              <tbody>{rows if rows else '<tr><td colspan="5" style="text-align:center;">No payments recorded yet.</td></tr>'}</tbody>
            </table>
            <hr/>
            <div style="margin-top:20px;padding:10px;background:#f0f8f6;border-radius:8px;">
              <p><strong>Summary:</strong></p>
              <p>Total Principal: ₱{float(loan['principal_amount']):,.2f}</p>
              <p>Total Payments: ₱{total_paid:,.2f}</p>
              <p>Remaining Balance: ₱{max(remaining_balance, 0):,.2f}</p>
            </div>
            <hr/>
            <p style="font-size:10px;color:#999;text-align:center;">
              Generated by Hiraya Management System on {datetime.datetime.now().strftime('%B %d, %Y')}
            </p>
          </body>
        </html>
        """
        pdf = io.BytesIO()
        pisa.CreatePDF(io.BytesIO(html.encode('UTF-8')), dest=pdf)
        pdf.seek(0)
        
        # Check if inline viewing is requested
        inline = request.args.get('inline', '0') == '1'
        
        return send_file(
            pdf,
            mimetype='application/pdf',
            as_attachment=not inline,  # If inline=True, display in browser
            download_name=f"PaymentHistory_{loan['loan_no']}.pdf"
        )
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')
        return redirect(url_for('borrower.my_documents'))


# ================================================================
# SECTION 8: ADDITIONAL ROUTE FOR VIEWING AGREEMENT (OPTIONAL)
# ================================================================

@loans_bp.route('/view-agreement/<int:loan_id>')
@login_required
def view_agreement(loan_id):
    """
    Alternative route that forces inline display (for View button)
    This is cleaner than using ?inline=1 parameter
    """
    return download_agreement(loan_id)