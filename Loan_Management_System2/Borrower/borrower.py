# ================================================================
# BORROWER.PY — Loan Management System Borrower Blueprint
# ================================================================

# ================================================================
# SECTION 1: IMPORTS & CONFIGURATION
# ================================================================
from flask import Blueprint, render_template, request, redirect, url_for, session, flash, jsonify
import datetime
import os
import base64 as _base64
import uuid
from functools import wraps
from flask_mail import Message
from Loan_Management_System2 import db_config, mail
import mysql.connector
from werkzeug.utils import secure_filename

# Blueprint setup
borrower_bp = Blueprint(
    'borrower',
    __name__,
    template_folder='templates',
    static_folder='static',
    static_url_path='/borrower/static'
)

# Upload configuration
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'static', 'uploads')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'pdf', 'gif'}


# ================================================================
# SECTION 2: HELPER FUNCTIONS
# ================================================================
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_db():
    return mysql.connector.connect(**db_config)

def is_logged_in():
    return session.get('logged_in', False)

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not is_logged_in():
            flash('Please log in to access this page.', 'warning')
            return redirect(url_for('auth.login'))
        return f(*args, **kwargs)
    return decorated

def role_required(*roles):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if not is_logged_in():
                return redirect(url_for('auth.login'))
            if session.get('role') not in roles:
                flash('Access denied. Insufficient permissions.', 'danger')
                return redirect(url_for('auth.dashboard'))
            return f(*args, **kwargs)
        return decorated
    return decorator


# ================================================================
# SECTION 3: BORROWER DASHBOARD
# ================================================================
@borrower_bp.route('/dashboard')
@login_required
@role_required('borrower')
def borrower_dashboard():

    recent_loans = []
    stats = {'active_count': 0, 'total_outstanding': 0}
    next_payment = {'next_due': None, 'next_amount': 0}
    total_paid = 0

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
            LIMIT 5
        """, (session['user_id'],))
        recent_loans = cursor.fetchall()

        cursor.execute("""
            SELECT COUNT(*) AS active_count,
                   COALESCE(SUM(outstanding_balance), 0) AS total_outstanding
            FROM loans
            WHERE borrower_id = %s AND status IN ('active', 'disbursed')
        """, (session['user_id'],))
        stats = cursor.fetchone() or {'active_count': 0, 'total_outstanding': 0}

        cursor.execute("""
            SELECT MIN(a.due_date) AS next_due,
                   SUM(a.total_due) AS next_amount
            FROM amortization_schedule a
            JOIN loans l ON a.loan_id = l.id
            WHERE l.borrower_id = %s
              AND l.status = 'active'
              AND a.is_paid = 0
              AND a.due_date >= CURDATE()
        """, (session['user_id'],))
        next_payment = cursor.fetchone() or {'next_due': None, 'next_amount': 0}

        cursor.execute("""
            SELECT COALESCE(SUM(p.amount_paid), 0) AS total_paid
            FROM payments p
            JOIN loans l ON p.loan_id = l.id
            WHERE l.borrower_id = %s
              AND p.status = 'completed'
        """, (session['user_id'],))
        paid_row = cursor.fetchone()
        total_paid = paid_row['total_paid'] if paid_row else 0

        cursor.close()
        conn.close()

    except Exception as e:
        print(f"[borrower_dashboard ERROR] {e}")

    return render_template('dashboard_borrower.html',
                           recent_loans=recent_loans,
                           stats=stats,
                           next_payment=next_payment,
                           total_paid=total_paid)


# ================================================================
# SECTION 4: USER PROFILE
# ================================================================
@borrower_bp.route('/profile')
@login_required
def profile():
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM users WHERE id = %s", (session['user_id'],))
        user = cursor.fetchone()
        cursor.close()
        conn.close()
    except:
        user = {}
    return render_template('B_profile.html', user=user)


# ================================================================
# SECTION 5: PAYMENTS
# ================================================================

# 5.1 SELECT LOAN TO PAY (sidebar entry point)
@borrower_bp.route('/payments/select')
@login_required
@role_required('borrower')
def select_loan_to_pay():
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT l.*, lt.name AS type_name,
                   (SELECT MIN(a.due_date)
                    FROM amortization_schedule a
                    WHERE a.loan_id = l.id AND a.is_paid = 0) AS next_due,
                   (SELECT SUM(a.total_due)
                    FROM amortization_schedule a
                    WHERE a.loan_id = l.id AND a.is_paid = 0
                      AND a.due_date = (
                          SELECT MIN(a2.due_date)
                          FROM amortization_schedule a2
                          WHERE a2.loan_id = l.id AND a2.is_paid = 0
                      )) AS next_amount
            FROM loans l
            JOIN loan_types lt ON l.loan_type_id = lt.id
            WHERE l.borrower_id = %s
              AND l.status IN ('active', 'disbursed')
            ORDER BY l.created_at DESC
        """, (session['user_id'],))

        active_loans = cursor.fetchall()
        cursor.close()
        conn.close()

    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')
        return redirect(url_for('borrower.borrower_dashboard'))

    return render_template('make_payment.html',
                           active_loans=active_loans,
                           today=datetime.date.today())


# 5.2 MAKE PAYMENT
@borrower_bp.route('/payments/make/<int:loan_id>', methods=['GET', 'POST'])
@login_required
@role_required('borrower')
def make_payment(loan_id):
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT l.*, lt.name AS type_name, lp.plan_name, lp.interest_rate
            FROM loans l
            JOIN loan_types lt ON l.loan_type_id = lt.id
            JOIN loan_plans lp ON l.loan_plan_id = lp.id
            WHERE l.id = %s AND l.borrower_id = %s
        """, (loan_id, session['user_id']))
        loan = cursor.fetchone()

        if not loan:
            flash('Loan not found.', 'danger')
            return redirect(url_for('borrower.borrower_dashboard'))

        cursor.execute("""
            SELECT * FROM amortization_schedule
            WHERE loan_id = %s AND is_paid = 0
            ORDER BY due_date ASC
        """, (loan_id,))
        schedules = cursor.fetchall()

        cursor.execute("""
            SELECT l.*, lt.name AS type_name, lp.plan_name,
                   (SELECT MIN(a.due_date)
                    FROM amortization_schedule a
                    WHERE a.loan_id = l.id AND a.is_paid = 0) AS next_due,
                   (SELECT SUM(a.total_due)
                    FROM amortization_schedule a
                    WHERE a.loan_id = l.id AND a.is_paid = 0
                      AND a.due_date = (
                          SELECT MIN(a2.due_date)
                          FROM amortization_schedule a2
                          WHERE a2.loan_id = l.id AND a2.is_paid = 0
                      )) AS next_amount
            FROM loans l
            JOIN loan_types lt ON l.loan_type_id = lt.id
            JOIN loan_plans lp ON l.loan_plan_id = lp.id
            WHERE l.borrower_id = %s AND l.status IN ('active', 'disbursed')
            ORDER BY l.created_at DESC
        """, (session['user_id'],))
        active_loans = cursor.fetchall()

        cursor.close()
        conn.close()
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')
        return redirect(url_for('borrower.borrower_dashboard'))

    if request.method == 'POST':
        amount_paid      = request.form.get('amount_paid', '').strip()
        payment_method   = request.form.get('payment_method', '').strip()
        reference_number = request.form.get('reference_number', '').strip()
        payment_date     = request.form.get('payment_date', '').strip()
        notes            = request.form.get('notes', '').strip()
        proof_file       = request.files.get('payment_screenshot')

        errors = []
        if not amount_paid or not payment_method:
            errors.append('Amount and payment method are required.')
        if not reference_number:
            errors.append('Reference number is required.')
        if not payment_date:
            errors.append('Payment date is required.')

        try:
            amount_paid = float(amount_paid)
            if amount_paid <= 0:
                errors.append('Amount must be greater than zero.')
        except (ValueError, TypeError):
            errors.append('Invalid amount.')

        if errors:
            for e in errors:
                flash(e, 'danger')
            return render_template('make_payment.html',
                                   loan=loan, schedules=schedules,
                                   active_loans=active_loans,
                                   today=datetime.date.today())

        # Handle screenshot upload
        screenshot_path = None
        if proof_file and proof_file.filename:
            PROOF_FOLDER = os.path.join(os.path.dirname(__file__), 'static', 'uploads', 'proofs')
            os.makedirs(PROOF_FOLDER, exist_ok=True)
            fname = secure_filename(
                f"proof_{session['user_id']}_{datetime.datetime.now().timestamp()}_{proof_file.filename}"
            )
            proof_file.save(os.path.join(PROOF_FOLDER, fname))
            screenshot_path = fname

        try:
            conn   = get_db()
            cursor = conn.cursor()

            year  = datetime.datetime.now().year
            cursor.execute("SELECT COUNT(*) FROM payments WHERE YEAR(created_at) = %s", (year,))
            count  = cursor.fetchone()[0] + 1
            pay_no = f"PAY-{year}-{str(count).zfill(6)}"

            cursor.execute("""
                INSERT INTO payments
                    (payment_no, loan_id, borrower_id,
                     amount_paid, payment_method, reference_number,
                     payment_date, screenshot_path, notes,
                     status, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending', NOW())
            """, (
                pay_no, loan_id, session['user_id'],
                amount_paid, payment_method, reference_number,
                payment_date, screenshot_path, notes
            ))
            conn.commit()

            # Get the loan reference number to pass to Step 4
            cursor2 = conn.cursor(dictionary=True)
            cursor2.execute("SELECT loan_no FROM loans WHERE id = %s", (loan_id,))
            loan_row = cursor2.fetchone()
            loan_ref = loan_row['loan_no'] if loan_row else ''
            cursor2.close()

            cursor.close()
            conn.close()

            return redirect(
                url_for('borrower.select_loan_to_pay') +
                f'?success=1&ref={pay_no}&amount={amount_paid}&method={payment_method}&loan_ref={loan_ref}'
            )

        except Exception as e:
            flash(f'Error processing payment: {str(e)}', 'danger')

    return render_template('make_payment.html',
                           loan=loan, schedules=schedules,
                           active_loans=active_loans,
                           today=datetime.date.today())


# 5.3 PAYMENT STATUS (polling endpoint)
@borrower_bp.route('/payments/status/<string:pay_no>')
@login_required
def payment_status(pay_no):
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT status FROM payments
            WHERE payment_no = %s AND borrower_id = %s
        """, (pay_no, session['user_id']))
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        if row:
            return jsonify({'status': row['status']})
        return jsonify({'status': 'not_found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# 5.4 VIEW E-RECEIPT
@borrower_bp.route('/payments/receipt/<string:pay_no>')
@login_required
@role_required('borrower')
def view_receipt(pay_no):
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT p.*,
                   l.loan_no AS loan_ref,
                   lt.name   AS type_name,
                   u.full_name AS borrower_name
            FROM payments p
            JOIN loans l      ON p.loan_id      = l.id
            JOIN loan_types lt ON l.loan_type_id = lt.id
            JOIN users u       ON p.borrower_id  = u.id
            WHERE p.payment_no  = %s
              AND p.borrower_id = %s
              AND p.status IN ('approved', 'completed')
        """, (pay_no, session['user_id']))
        payment = cursor.fetchone()
        cursor.close()
        conn.close()

        if not payment:
            flash('Receipt not found or payment not yet confirmed.', 'warning')
            return redirect(url_for('borrower.payment_history'))

    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')
        return redirect(url_for('borrower.payment_history'))

    return render_template('e_receipt.html', payment=payment)

# ================================================================
# IDAGDAG ITO SA borrower.py — pagkatapos ng view_receipt route (5.4)
# Bagong Section 5.4b: RECEIPT DATA (JSON endpoint para sa inline fetch)
# ================================================================

# ================================================================
# IDAGDAG ITO SA borrower.py — pagkatapos ng view_receipt route (5.4)
# Bagong Section 5.4b: RECEIPT DATA (JSON endpoint para sa inline fetch)
# ================================================================

@borrower_bp.route('/payments/receipt-data/<string:pay_no>')
@login_required
@role_required('borrower')
def receipt_data(pay_no):
    """
    Returns receipt details as JSON.
    Ginagamit ng make_payment.html Step 5 para i-fetch ang receipt
    inline — nang hindi nire-redirect ang user sa ibang page.

    Fixes:
    - updated_at → verified_at  (actual column sa payments table)
    - status IN added 'verified' (actual enum value sa DB)
    - date_verified now uses verified_at
    """
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT p.payment_no,
                   p.amount_paid,
                   p.payment_method,
                   p.reference_number,
                   p.payment_date,
                   p.verified_at,
                   p.status,
                   l.loan_no   AS loan_ref,
                   lt.name     AS type_name,
                   u.full_name AS borrower_name
            FROM payments p
            JOIN loans l       ON p.loan_id      = l.id
            JOIN loan_types lt ON l.loan_type_id = lt.id
            JOIN users u       ON p.borrower_id  = u.id
            WHERE p.payment_no  = %s
              AND p.borrower_id = %s
              AND p.status IN ('approved', 'verified', 'completed')
        """, (pay_no, session['user_id']))
        payment = cursor.fetchone()
        cursor.close()
        conn.close()

        if not payment:
            return jsonify({'error': 'not_found'}), 404

        def fmt_date(d):
            if d is None:
                return None
            if hasattr(d, 'strftime'):
                return d.strftime('%B %d, %Y')
            return str(d)

        def fmt_datetime(d):
            if d is None:
                return None
            if hasattr(d, 'strftime'):
                return d.strftime('%B %d, %Y %I:%M %p')
            return str(d)

        return jsonify({
            'payment_no':       payment['payment_no'],
            'amount_paid':      float(payment['amount_paid']),
            'payment_method':   payment['payment_method'],
            'reference_number': payment['reference_number'] or '',
            'payment_date':     fmt_date(payment['payment_date']),
            'date_verified':    fmt_datetime(payment['verified_at']),
            'loan_ref':         payment['loan_ref'] or '',
            'type_name':        payment['type_name'] or '',
            'borrower_name':    payment['borrower_name'] or '',
            'status':           payment['status'],
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# 5.5 PAYMENT HISTORY
@borrower_bp.route('/payments/history')
@login_required
@role_required('borrower')
def payment_history():
    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT
                p.*,
                l.loan_no AS loan_ref,
                lt.name   AS type_name,
                COALESCE(SUM(a.principal_due), 0) AS principal_paid,
                COALESCE(SUM(a.interest_due),  0) AS interest_paid,
                COALESCE(
                    (SELECT SUM(pen.penalty_amount)
                     FROM penalties pen
                     WHERE pen.loan_id = p.loan_id
                       AND pen.is_paid = 1),
                0) AS penalty_paid
            FROM payments p
            JOIN loans l       ON p.loan_id  = l.id
            JOIN loan_types lt ON l.loan_type_id = lt.id
            LEFT JOIN amortization_schedule a
                   ON a.loan_id = p.loan_id
                  AND a.is_paid = 1
            WHERE p.borrower_id = %s
            GROUP BY p.id
            ORDER BY p.created_at DESC
        """, (session['user_id'],))
        payments = cursor.fetchall()
        cursor.close()
        conn.close()
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')
        payments = []

    return render_template('payment_history.html', payments=payments)


# ================================================================
# SECTION 6: DOCUMENTS
# ================================================================

# 6.1 MY DOCUMENTS
@borrower_bp.route('/documents')
@login_required
@role_required('borrower')
def my_documents():
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT id_document_path, selfie_path, id_verification_status, created_at
            FROM users WHERE id = %s
        """, (session['user_id'],))
        user_data = cursor.fetchone()

        cursor.execute("""
            SELECT ad.*, la.reference_no, la.status as app_status
            FROM application_documents ad
            JOIN loan_applications la ON ad.application_id = la.id
            WHERE la.borrower_id = %s
        """, (session['user_id'],))
        app_docs = cursor.fetchall()

        cursor.execute("""
            SELECT l.*, lt.name AS type_name
            FROM loans l
            JOIN loan_types lt ON l.loan_type_id = lt.id
            WHERE l.borrower_id = %s
        """, (session['user_id'],))
        loans = cursor.fetchall()

        cursor.execute("""
            SELECT * FROM payments
            WHERE borrower_id = %s AND screenshot_path IS NOT NULL
        """, (session['user_id'],))
        payments = cursor.fetchall()

        cursor.close()
        conn.close()

    except Exception as e:
        flash(f'Error loading documents: {str(e)}', 'danger')
        user_data = {}
        app_docs, loans, payments = [], [], []

    return render_template('documents.html',
                           user=user_data,
                           documents=app_docs,
                           loans=loans,
                           payments=payments,
                           generated_docs=loans)


# 6.2 UPLOAD DOCUMENT
@borrower_bp.route('/documents/upload', methods=['POST'])
@login_required
@role_required('borrower')
def upload_document():
    app_id   = request.form.get('application_id')
    doc_type = request.form.get('document_type', 'requirement')
    file     = request.files.get('document')

    UPLOAD_FOLDER_DOCS = os.path.join(
        os.path.dirname(__file__), 'static', 'uploads', 'documents'
    )

    if not file or not allowed_file(file.filename):
        flash('Invalid file. Allowed: PNG, JPG, JPEG, PDF.', 'danger')
        return redirect(url_for('borrower.my_documents'))

    try:
        os.makedirs(UPLOAD_FOLDER_DOCS, exist_ok=True)
        fname = secure_filename(
            f"doc_{session['user_id']}_{datetime.datetime.now().timestamp()}_{file.filename}"
        )
        file.save(os.path.join(UPLOAD_FOLDER_DOCS, fname))

        conn   = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO application_documents (application_id, document_type, file_path)
            VALUES (%s, %s, %s)
        """, (app_id, doc_type, fname))
        conn.commit()
        cursor.close()
        conn.close()

        flash('Document uploaded successfully.', 'success')
    except Exception as e:
        flash(f'Upload error: {str(e)}', 'danger')

    return redirect(url_for('borrower.my_documents'))