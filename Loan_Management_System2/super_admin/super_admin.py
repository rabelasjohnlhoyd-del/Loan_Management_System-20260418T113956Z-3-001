from flask import Blueprint, render_template, request, redirect, url_for, session, flash, jsonify, send_file
import datetime
import os
import io
from Loan_Management_System2 import db_config, mail
from flask_mail import Message
import mysql.connector

admin_bp = Blueprint(
    'super_admin', __name__,
    template_folder='templates',
    static_folder='static',
    static_url_path='/admin/static'
)

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
                flash('Access denied. Insufficient permissions.', 'danger')
                return redirect(url_for('auth.dashboard'))
            return f(*args, **kwargs)
        return decorated
    return decorator

def log_activity(action, details=''):
    """Helper to log admin activity."""
    try:
        conn   = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO activity_logs (user_id, action, details, ip_address, created_at)
            VALUES (%s, %s, %s, %s, NOW())
        """, (
            session.get('user_id'),
            action,
            details,
            request.remote_addr
        ))
        conn.commit()
        cursor.close()
        conn.close()
    except Exception:
        pass  # Don't break app if logging fails


# ─────────────────────────────────────────────
# ADMIN DASHBOARD
# ─────────────────────────────────────────────
@admin_bp.route('/dashboard')
@login_required
@role_required('admin', 'super_admin')
def admin_dashboard():
    stats = {
        'total_loans': 0, 'active_loans': 0, 'total_borrowers': 0,
        'total_interest': 0, 'default_rate': 3.4, 'avg_loan_size': 0,
        'pending_verifications': 0, 'pending_payments': 0,
        'total_disbursed': 0, 'pending_applications': 0,
    }
    recent_applications = []
    activity_logs       = []

    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT COUNT(*) AS cnt FROM users WHERE role='borrower'")
        stats['total_borrowers'] = cursor.fetchone()['cnt']

        cursor.execute("SELECT COUNT(*) AS cnt FROM users WHERE id_verification_status='pending'")
        stats['pending_verifications'] = cursor.fetchone()['cnt']

        cursor.execute("SELECT COUNT(*) AS cnt FROM loan_applications WHERE status IN ('submitted','under_review')")
        stats['pending_applications'] = cursor.fetchone()['cnt']

        cursor.execute("SELECT COUNT(*) AS cnt FROM loans WHERE status='active'")
        stats['active_loans'] = cursor.fetchone()['cnt']

        cursor.execute("SELECT COALESCE(SUM(disbursed_amount),0) AS total FROM loans")
        stats['total_disbursed'] = cursor.fetchone()['total'] or 0

        cursor.execute("SELECT COUNT(*) AS cnt FROM payments WHERE status='pending'")
        stats['pending_payments'] = cursor.fetchone()['cnt']

        cursor.execute("""
    SELECT la.id, la.reference_no, la.amount_requested, la.status, la.submitted_at,
           u.full_name AS borrower_name, lt.name AS type_name
    FROM loan_applications la
    JOIN users u ON u.id = la.borrower_id
    JOIN loan_types lt ON lt.id = la.loan_type_id
    ORDER BY la.submitted_at DESC LIMIT 5
""")
        recent_applications = cursor.fetchall()

        cursor.execute("""
            SELECT al.*, u.full_name AS actor_name
            FROM activity_logs al
            LEFT JOIN users u ON u.id = al.user_id
            ORDER BY al.created_at DESC LIMIT 10
        """)
        activity_logs = cursor.fetchall()

        cursor.close()
        conn.close()
    except Exception as e:
        flash(f'Dashboard data error: {str(e)}', 'warning')

    return render_template('dashboard_admin.html',
        stats=stats,
        recent_applications=recent_applications,
        activity_logs=activity_logs,
        user_name=session.get('user_name'))


# ─────────────────────────────────────────────
# OFFICER DASHBOARD
# ─────────────────────────────────────────────
@admin_bp.route('/officer-dashboard')
@login_required
@role_required('loan_officer')
def officer_dashboard():
    return render_template('dashboard_officer.html', user_name=session.get('user_name'))


# ─────────────────────────────────────────────
# AUDITOR DASHBOARD
# ─────────────────────────────────────────────
@admin_bp.route('/auditor-dashboard')
@login_required
@role_required('auditor')
def auditor_dashboard():
    return render_template('dashboard_auditor.html', user_name=session.get('user_name'))


# ─────────────────────────────────────────────
# ADMIN: ALL APPLICATIONS
# ─────────────────────────────────────────────
@admin_bp.route('/applications')
@login_required
@role_required('admin', 'super_admin', 'loan_officer')
def admin_applications():
    status_filter = request.args.get('status', 'all')
    search        = request.args.get('search', '').strip()
    type_filter   = request.args.get('type', 'all')

    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)

        query = """
            SELECT la.*, lt.name AS type_name, lp.plan_name,
                   u.full_name AS borrower_name, u.email AS borrower_email
            FROM loan_applications la
            JOIN loan_types lt  ON lt.id  = la.loan_type_id
            JOIN loan_plans lp  ON lp.id  = la.loan_plan_id
            JOIN users u        ON u.id   = la.borrower_id
            WHERE 1=1
        """
        params = []

        if status_filter != 'all':
            query += " AND la.status = %s"
            params.append(status_filter)

        if type_filter != 'all':
            query += " AND la.loan_type_id = %s"
            params.append(type_filter)

        if search:
            query += " AND (u.full_name LIKE %s OR u.email LIKE %s OR la.reference_no LIKE %s)"
            params += [f'%{search}%', f'%{search}%', f'%{search}%']

        query += " ORDER BY la.submitted_at DESC"
        cursor.execute(query, params)
        applications = cursor.fetchall()

        cursor.execute("SELECT status, COUNT(*) AS cnt FROM loan_applications GROUP BY status")
        counts = {r['status']: r['cnt'] for r in cursor.fetchall()}
        cursor.execute("SELECT COUNT(*) AS cnt FROM loan_applications")
        counts['all'] = cursor.fetchone()['cnt']

        cursor.execute("SELECT * FROM loan_types WHERE is_active=1")
        types = cursor.fetchall()

        cursor.close()
        conn.close()
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')
        applications, counts, types = [], {}, []

    return render_template('admin_applications.html',
                           applications=applications,
                           counts=counts,
                           types=types,
                           status_filter=status_filter,
                           type_filter=type_filter,
                           search=search)


# ─────────────────────────────────────────────
# ADMIN: APPLICATION DETAIL
# ─────────────────────────────────────────────
@admin_bp.route('/applications/<int:app_id>')
@login_required
@role_required('admin', 'super_admin', 'loan_officer')
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
            WHERE la.id = %s
        """, (app_id,))
        app = cursor.fetchone()

        if not app:
            flash('Application not found.', 'danger')
            return redirect(url_for('super_admin.admin_applications'))

        cursor.execute("SELECT * FROM application_documents WHERE application_id = %s", (app_id,))
        docs = cursor.fetchall()

        from Loan_Management_System2.Loans.routes import calculate_monthly_payment
        monthly = calculate_monthly_payment(
            float(app['amount_requested']),
            float(app['interest_rate']),
            app['term_months']
        )

        cursor.close()
        conn.close()
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')
        return redirect(url_for('super_admin.admin_applications'))

    return render_template('application_detail.html', app=app, docs=docs, monthly_payment=monthly)


# ─────────────────────────────────────────────
# ADMIN: ALL LOANS
# ─────────────────────────────────────────────
@admin_bp.route('/loans')
@login_required
@role_required('admin', 'super_admin', 'loan_officer', 'auditor')
def all_loans():
    status_filter = request.args.get('status', 'all')
    search        = request.args.get('search', '').strip()
    type_filter   = request.args.get('type', 'all')

    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)

        query = """
            SELECT l.*, lt.name AS type_name, lp.plan_name,
                   u.full_name AS borrower_name, u.email AS borrower_email
            FROM loans l
            JOIN loan_types lt ON l.loan_type_id = lt.id
            JOIN loan_plans lp ON l.loan_plan_id = lp.id
            JOIN users u ON l.borrower_id = u.id
            WHERE 1=1
        """
        params = []

        if status_filter != 'all':
            query += " AND l.status = %s"
            params.append(status_filter)

        if type_filter != 'all':
            query += " AND l.loan_type_id = %s"
            params.append(type_filter)

        if search:
            query += " AND (u.full_name LIKE %s OR l.loan_no LIKE %s OR u.email LIKE %s)"
            params += [f'%{search}%', f'%{search}%', f'%{search}%']

        query += " ORDER BY l.created_at DESC"
        cursor.execute(query, params)
        loan_list = cursor.fetchall()

        cursor.execute("SELECT status, COUNT(*) AS cnt FROM loans GROUP BY status")
        counts = {r['status']: r['cnt'] for r in cursor.fetchall()}
        cursor.execute("SELECT COUNT(*) AS cnt FROM loans")
        counts['all'] = cursor.fetchone()['cnt']

        cursor.execute("SELECT * FROM loan_types WHERE is_active=1")
        types = cursor.fetchall()

        cursor.close()
        conn.close()
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')
        loan_list, counts, types = [], {}, []

    return render_template('all_loans.html',
                           loans=loan_list,
                           counts=counts,
                           types=types,
                           status_filter=status_filter,
                           type_filter=type_filter,
                           search=search)


# ─────────────────────────────────────────────
# ADMIN: BORROWERS LIST
# ─────────────────────────────────────────────
@admin_bp.route('/borrowers')
@login_required
@role_required('admin', 'super_admin', 'loan_officer', 'auditor')
def borrowers():
    search        = request.args.get('search', '').strip()
    risk_filter   = request.args.get('risk', 'all')
    status_filter = request.args.get('status', 'all')

    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)

        query = """
            SELECT u.id, u.full_name, u.email, u.contact_number,
                   u.id_verification_status, u.is_active, u.created_at,
                   COALESCE(bp.credit_score, 500) AS credit_score,
                   COALESCE(bp.risk_level, 'medium') AS risk_level,
                   COALESCE(bp.active_loans, 0) AS active_loans,
                   COALESCE(bp.total_loans, 0) AS total_loans,
                   COALESCE(bp.total_borrowed, 0) AS total_borrowed
            FROM users u
            LEFT JOIN borrower_profiles bp ON u.id = bp.user_id
            WHERE u.role = 'borrower'
        """
        params = []

        if search:
            query += " AND (u.full_name LIKE %s OR u.email LIKE %s OR u.contact_number LIKE %s)"
            params += [f'%{search}%', f'%{search}%', f'%{search}%']

        if risk_filter != 'all':
            query += " AND COALESCE(bp.risk_level, 'medium') = %s"
            params.append(risk_filter)

        if status_filter == 'active':
            query += " AND u.is_active = 1"
        elif status_filter == 'inactive':
            query += " AND u.is_active = 0"

        query += " ORDER BY u.created_at DESC"
        cursor.execute(query, params)
        borrowers_list = cursor.fetchall()

        cursor.execute("SELECT COUNT(*) AS cnt FROM users WHERE role='borrower'")
        total = cursor.fetchone()['cnt']
        cursor.execute("SELECT COUNT(*) AS cnt FROM users WHERE role='borrower' AND is_active=1")
        active = cursor.fetchone()['cnt']
        cursor.execute("SELECT COUNT(*) AS cnt FROM borrower_profiles WHERE risk_level='high'")
        high_risk = cursor.fetchone()['cnt']

        cursor.close()
        conn.close()
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')
        borrowers_list, total, active, high_risk = [], 0, 0, 0

    return render_template('borrowers.html',
                           borrowers=borrowers_list,
                           total=total, active=active, high_risk=high_risk,
                           search=search, risk_filter=risk_filter,
                           status_filter=status_filter)


# ─────────────────────────────────────────────
# ADMIN: BORROWER DETAIL
# ─────────────────────────────────────────────
@admin_bp.route('/borrowers/<int:borrower_id>')
@login_required
@role_required('admin', 'super_admin', 'loan_officer', 'auditor')
def borrower_detail(borrower_id):
    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT u.*, COALESCE(bp.credit_score, 500) AS credit_score,
                   COALESCE(bp.risk_level, 'medium') AS risk_level,
                   COALESCE(bp.total_loans, 0) AS total_loans,
                   COALESCE(bp.active_loans, 0) AS active_loans,
                   COALESCE(bp.paid_loans, 0) AS paid_loans,
                   COALESCE(bp.defaulted_loans, 0) AS defaulted_loans,
                   COALESCE(bp.total_borrowed, 0) AS total_borrowed,
                   COALESCE(bp.total_paid, 0) AS total_paid,
                   bp.notes AS profile_notes
            FROM users u
            LEFT JOIN borrower_profiles bp ON u.id = bp.user_id
            WHERE u.id = %s AND u.role = 'borrower'
        """, (borrower_id,))
        borrower = cursor.fetchone()

        if not borrower:
            flash('Borrower not found.', 'danger')
            return redirect(url_for('super_admin.borrowers'))

        cursor.execute("""
            SELECT l.*, lt.name AS type_name, lp.plan_name
            FROM loans l
            JOIN loan_types lt ON l.loan_type_id = lt.id
            JOIN loan_plans lp ON l.loan_plan_id = lp.id
            WHERE l.borrower_id = %s
            ORDER BY l.created_at DESC
        """, (borrower_id,))
        loan_history = cursor.fetchall()

        cursor.execute("""
            SELECT la.*, lt.name AS type_name
            FROM loan_applications la
            JOIN loan_types lt ON la.loan_type_id = lt.id
            WHERE la.borrower_id = %s AND la.status NOT IN ('approved','rejected','cancelled')
            ORDER BY la.submitted_at DESC
        """, (borrower_id,))
        active_applications = cursor.fetchall()

        cursor.close()
        conn.close()
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')
        return redirect(url_for('super_admin.borrowers'))

    return render_template('borrower_detail.html',
                           borrower=borrower,
                           loan_history=loan_history,
                           active_applications=active_applications)


# ─────────────────────────────────────────────
# ADMIN: LOAN DETAIL
# ─────────────────────────────────────────────
@admin_bp.route('/loans/<int:loan_id>')
@login_required
@role_required('admin', 'super_admin', 'loan_officer', 'auditor')
def loan_detail(loan_id):
    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT l.*, lt.name AS type_name, lp.plan_name,
                   u.full_name AS borrower_name, u.email AS borrower_email,
                   u.contact_number AS borrower_contact
            FROM loans l
            JOIN loan_types lt ON l.loan_type_id = lt.id
            JOIN loan_plans lp ON l.loan_plan_id = lp.id
            JOIN users u ON l.borrower_id = u.id
            WHERE l.id = %s
        """, (loan_id,))
        loan = cursor.fetchone()

        if not loan:
            flash('Loan not found.', 'danger')
            return redirect(url_for('super_admin.all_loans'))

        cursor.execute("""
            SELECT * FROM amortization_schedule
            WHERE loan_id = %s ORDER BY period_no
        """, (loan_id,))
        schedule = cursor.fetchall()

        cursor.execute("""
            SELECT p.*, u.full_name AS verified_by_name
            FROM payments p
            LEFT JOIN users u ON p.verified_by = u.id
            WHERE p.loan_id = %s
            ORDER BY p.payment_date DESC
        """, (loan_id,))
        payment_history = cursor.fetchall()

        cursor.execute("SELECT * FROM penalties WHERE loan_id = %s ORDER BY period_no", (loan_id,))
        penalties = cursor.fetchall()

        cursor.execute("SELECT * FROM application_documents WHERE application_id = %s", (loan['application_id'],))
        documents = cursor.fetchall()

        cursor.close()
        conn.close()
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')
        return redirect(url_for('super_admin.all_loans'))

    return render_template('loan_detail.html',
                           loan=loan,
                           schedule=schedule,
                           payment_history=payment_history,
                           penalties=penalties,
                           documents=documents)


# ─────────────────────────────────────────────
# ADMIN: VERIFY BORROWER ID
# ─────────────────────────────────────────────
@admin_bp.route('/borrowers/<int:borrower_id>/verify-id', methods=['POST'])
@login_required
@role_required('admin', 'super_admin', 'loan_officer')
def verify_borrower_id(borrower_id):
    action = request.form.get('action')

    if action not in ('verified', 'rejected'):
        flash('Invalid action.', 'danger')
        return redirect(url_for('super_admin.borrowers'))

    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT full_name, email FROM users WHERE id = %s AND role = 'borrower'", (borrower_id,))
        borrower = cursor.fetchone()

        if not borrower:
            flash('Borrower not found.', 'danger')
            cursor.close(); conn.close()
            return redirect(url_for('super_admin.borrowers'))

        cursor.execute("""
            UPDATE users SET id_verification_status = %s,
            verified_by = %s, verified_at = %s WHERE id = %s
        """, (action, session['user_id'], datetime.datetime.now(), borrower_id))
        conn.commit()

        log_activity('verify_borrower_id', f'Borrower ID {borrower_id} -> {action}')

        try:
            if action == 'verified':
                note = request.form.get('note', '').strip()
                extra = f"<p><em>Note: {note}</em></p>" if note else ""
                msg = Message('Your ID Has Been Verified - Loan Management System',
                              recipients=[borrower['email']])
                msg.html = f"""
                <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;
                            background:#0f172a;color:#e2e8f0;padding:40px;border-radius:12px;">
                  <h2 style="color:#22c55e;">Identity Verified</h2>
                  <p>Hello <strong>{borrower['full_name']}</strong>,</p>
                  <p>Your ID has been <strong style="color:#22c55e;">approved</strong>. You can now apply for loans.</p>
                  {extra}
                </div>"""
                mail.send(msg)
            else:
                note = request.form.get('note', '').strip()
                reason_block = f"""
                  <div style="background:#1e293b;border-left:3px solid #ef4444;
                              border-radius:6px;padding:14px 16px;margin:16px 0;">
                    <strong style="font-size:12px;color:#94a3b8;">Reason:</strong>
                    <p style="margin:6px 0 0;color:#e2e8f0;">{note}</p>
                  </div>""" if note else ""
                msg = Message('ID Verification Update - Loan Management System',
                              recipients=[borrower['email']])
                msg.html = f"""
                <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;
                            background:#0f172a;color:#e2e8f0;padding:40px;border-radius:12px;">
                  <h2 style="color:#ef4444;">ID Verification Unsuccessful</h2>
                  <p>Hello <strong>{borrower['full_name']}</strong>,</p>
                  <p>Your ID was <strong style="color:#ef4444;">not approved</strong>.</p>
                  {reason_block}
                  <p>Please re-upload a clear, valid government-issued ID and selfie.</p>
                </div>"""
                mail.send(msg)
        except Exception as mail_err:
            flash(f'Status updated but email failed: {str(mail_err)}', 'warning')

        cursor.close()
        conn.close()
        label = 'verified' if action == 'verified' else 'rejected'
        flash(f'Borrower ID has been {label} successfully.', 'success' if action == 'verified' else 'warning')
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')

    next_url = request.form.get('next') or url_for('super_admin.borrowers')
    return redirect(next_url)


# ─────────────────────────────────────────────
# ADMIN: APPROVE / REJECT APPLICATION
# ─────────────────────────────────────────────
@admin_bp.route('/applications/<int:app_id>/review', methods=['POST'])
@login_required
@role_required('admin', 'super_admin', 'loan_officer')
def review_application(app_id):
    from Loan_Management_System2.Loans.routes import (
        generate_reference, calculate_monthly_payment, build_amortization
    )

    action           = request.form.get('action')
    rejection_reason = request.form.get('rejection_reason', '').strip()

    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT la.*, lp.interest_rate, lp.interest_type, lp.processing_fee
            FROM loan_applications la
            JOIN loan_plans lp ON la.loan_plan_id = lp.id
            WHERE la.id = %s
        """, (app_id,))
        app = cursor.fetchone()

        if not app:
            flash('Application not found.', 'danger')
            return redirect(url_for('super_admin.admin_applications'))

        if action == 'approve':
            loan_no        = generate_reference('LN', 'loans', 'id')
            principal      = float(app['amount_requested'])
            rate           = float(app['interest_rate'])
            months         = app['term_months']
            fee_pct        = float(app['processing_fee'])
            processing_fee = round(principal * fee_pct / 100, 2)
            disbursed      = round(principal - processing_fee, 2)
            monthly        = calculate_monthly_payment(principal, rate, months)
            start_date     = datetime.date.today()
            maturity       = start_date + datetime.timedelta(days=30 * months)
            next_due       = start_date + datetime.timedelta(days=30)

            cursor.execute("""
                INSERT INTO loans
                  (loan_no, application_id, borrower_id, loan_type_id, loan_plan_id,
                   principal_amount, interest_rate, interest_type, term_months,
                   processing_fee, disbursed_amount, outstanding_balance,
                   monthly_payment, next_due_date, disbursed_at, maturity_date,
                   status, officer_id)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'active',%s)
            """, (
                loan_no, app_id, app['borrower_id'], app['loan_type_id'], app['loan_plan_id'],
                principal, rate, app['interest_type'], months,
                processing_fee, disbursed, principal,
                monthly, next_due, start_date, maturity,
                session['user_id']
            ))
            loan_id = cursor.lastrowid

            schedule = build_amortization(principal, rate, months,
                                          datetime.datetime.combine(start_date, datetime.time()))
            for s in schedule:
                cursor.execute("""
                    INSERT INTO amortization_schedule
                      (loan_id, period_no, due_date, principal_due, interest_due, total_due, balance_after)
                    VALUES (%s,%s,%s,%s,%s,%s,%s)
                """, (loan_id, s['period_no'], s['due_date'], s['principal_due'],
                      s['interest_due'], s['total_due'], s['balance_after']))

            cursor.execute("""
                INSERT INTO borrower_profiles (user_id, total_loans, active_loans, total_borrowed)
                VALUES (%s, 1, 1, %s)
                ON DUPLICATE KEY UPDATE
                  total_loans = total_loans + 1,
                  active_loans = active_loans + 1,
                  total_borrowed = total_borrowed + %s
            """, (app['borrower_id'], principal, principal))

            cursor.execute("""
                UPDATE loan_applications
                SET status='approved', reviewed_by=%s, reviewed_at=NOW()
                WHERE id=%s
            """, (session['user_id'], app_id))

            conn.commit()
            log_activity('approve_application', f'App ID {app_id} -> Loan {loan_no}')
            flash(f'Loan approved! Loan No: {loan_no}', 'success')

        elif action == 'reject':
            cursor.execute("""
                UPDATE loan_applications
                SET status='rejected', reviewed_by=%s, reviewed_at=NOW(), rejection_reason=%s
                WHERE id=%s
            """, (session['user_id'], rejection_reason, app_id))
            conn.commit()
            log_activity('reject_application', f'App ID {app_id}')
            flash('Application rejected.', 'warning')

        cursor.close()
        conn.close()
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')

    return redirect(url_for('super_admin.admin_applications'))


# ═════════════════════════════════════════════
# PAYMENT SYSTEM
# ═════════════════════════════════════════════

# ─────────────────────────────────────────────
# ADMIN: ALL PAYMENTS (Pending Verification)
# ─────────────────────────────────────────────
@admin_bp.route('/payments')
@login_required
@role_required('admin', 'super_admin', 'loan_officer', 'auditor')
def all_payments():
    status_filter = request.args.get('status', 'pending')
    search        = request.args.get('search', '').strip()

    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)

        query = """
            SELECT p.*, l.loan_no, u.full_name AS borrower_name, u.email AS borrower_email,
                   v.full_name AS verified_by_name
            FROM payments p
            JOIN loans l ON p.loan_id = l.id
            JOIN users u ON l.borrower_id = u.id
            LEFT JOIN users v ON p.verified_by = v.id
            WHERE 1=1
        """
        params = []

        if status_filter != 'all':
            query += " AND p.status = %s"
            params.append(status_filter)

        if search:
            query += " AND (u.full_name LIKE %s OR l.loan_no LIKE %s OR p.reference_number LIKE %s)"
            params += [f'%{search}%', f'%{search}%', f'%{search}%']

        query += " ORDER BY p.payment_date DESC"
        cursor.execute(query, params)
        payments = cursor.fetchall()

        cursor.execute("SELECT status, COUNT(*) AS cnt FROM payments GROUP BY status")
        counts = {r['status']: r['cnt'] for r in cursor.fetchall()}
        cursor.execute("SELECT COUNT(*) AS cnt FROM payments")
        counts['all'] = cursor.fetchone()['cnt']

        cursor.close()
        conn.close()
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')
        payments, counts = [], {}

    return render_template('admin_payments.html',
                           payments=payments,
                           counts=counts,
                           status_filter=status_filter,
                           search=search)


# ─────────────────────────────────────────────
# ADMIN: VERIFY / REJECT PAYMENT
# ─────────────────────────────────────────────
@admin_bp.route('/payments/<int:payment_id>/verify', methods=['POST'])
@login_required
@role_required('admin', 'super_admin', 'loan_officer')
def verify_payment(payment_id):
    action = request.form.get('action')
    notes  = request.form.get('notes', '').strip()
    
    # ADD THIS LINE ↓
    print(f"[VERIFY] payment_id={payment_id} action='{action}' form={dict(request.form)}")
    
    if action not in ('approved', 'rejected'):
        flash('Invalid action.', 'danger')
        return redirect(url_for('super_admin.all_payments'))

    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT p.*, l.loan_no, l.id AS loan_id, l.outstanding_balance,
                   l.monthly_payment, l.borrower_id,
                   u.full_name AS borrower_name, u.email AS borrower_email
            FROM payments p
            JOIN loans l ON p.loan_id = l.id
            JOIN users u ON l.borrower_id = u.id
            WHERE p.id = %s
        """, (payment_id,))
        payment = cursor.fetchone()

        if not payment:
            flash('Payment not found.', 'danger')
            cursor.close(); conn.close()
            return redirect(url_for('super_admin.all_payments'))

        now = datetime.datetime.now()

        # I-update agad yung status
        cursor.execute("""
        UPDATE payments
        SET status = %s, verified_by = %s, verified_at = %s, notes = %s
        WHERE id = %s
        """, (action, session['user_id'], now, notes, payment_id))
        conn.commit()  # ← COMMIT AGAD DITO

        if action == 'approved':
            new_balance = max(0, float(payment['outstanding_balance']) - float(payment['amount_paid']))

            # Mark the corresponding amortization period as paid
            # Mark the corresponding amortization period as paid
            cursor.execute("""
            UPDATE amortization_schedule
            SET is_paid = 1, paid_at = %s
            WHERE loan_id = %s AND is_paid = 0
            ORDER BY period_no ASC LIMIT 1
            """, (now, payment['loan_id']))

# Update next due date (move to next period)
            cursor.execute("""
            SELECT due_date FROM amortization_schedule
            WHERE loan_id = %s AND is_paid = 0
            ORDER BY period_no ASC LIMIT 1
            """, (payment['loan_id'],))
            next_row = cursor.fetchone()
            next_due = next_row['due_date'] if next_row else None

            loan_status = 'paid' if new_balance <= 0 else 'active'

            cursor.execute("""
                UPDATE loans
                SET outstanding_balance = %s,
                    next_due_date = %s,
                    status = %s
                WHERE id = %s
            """, (new_balance, next_due, loan_status, payment['loan_id']))

            if loan_status == 'paid':
                cursor.execute("""
                    UPDATE borrower_profiles
                    SET active_loans = GREATEST(active_loans - 1, 0),
                        paid_loans = paid_loans + 1,
                        total_paid = total_paid + %s
                    WHERE user_id = %s
                """, (float(payment['amount_paid']), payment['borrower_id']))

            conn.commit()
            log_activity('verify_payment', f'Payment {payment_id} approved for Loan {payment["loan_no"]}')

            # Send confirmation email
            try:
                msg = Message('Payment Confirmed - Loan Management System',
                              recipients=[payment['email'] if 'email' in payment else payment['borrower_email']])
                msg.html = f"""
                <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;
                            background:#0f172a;color:#e2e8f0;padding:40px;border-radius:12px;">
                  <h2 style="color:#22c55e;">Payment Confirmed</h2>
                  <p>Hello <strong>{payment['borrower_name']}</strong>,<p>Your payment of <strong>₱{float(payment['amount_paid']):,.2f}</strong>
                     for Loan <strong>{payment['loan_no']}</strong> has been verified.</p>
                  <p>Remaining Balance: <strong>₱{new_balance:,.2f}</strong></p>
                  <p style="color:#94a3b8;font-size:12px;">Reference: {payment.get('reference_no','N/A')}</p>
                </div>"""
                mail.send(msg)
            except Exception:
                pass

            flash('Payment approved and loan balance updated.', 'success')

        else:
            conn.commit()
            log_activity('reject_payment', f'Payment {payment_id} rejected')

            try:
                msg = Message('Payment Not Verified - Loan Management System',
                              recipients=[payment['borrower_email']])
                msg.html = f"""
                <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;
                            background:#0f172a;color:#e2e8f0;padding:40px;border-radius:12px;">
                  <h2 style="color:#ef4444;">Payment Rejected</h2>
                  <p>Hello <strong>{payment['borrower_name']}</strong>,</p>
                  <p>Your payment submission for Loan <strong>{payment['loan_no']}</strong>
                     was <strong style="color:#ef4444;">not verified</strong>.</p>
                  {'<p>Reason: ' + notes + '</p>' if notes else ''}
                  <p>Please resubmit with a clear screenshot of the transaction.</p>
                </div>"""
                mail.send(msg)
            except Exception:
                pass

            flash('Payment rejected.', 'warning')

        cursor.close()
        conn.close()
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')

    return redirect(url_for('super_admin.all_payments'))


# ═════════════════════════════════════════════
# USER / STAFF MANAGEMENT (Super Admin Only)
# ═════════════════════════════════════════════

@admin_bp.route('/users')
@login_required
@role_required('super_admin')
def manage_users():
    role_filter = request.args.get('role', 'all')
    search      = request.args.get('search', '').strip()

    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)

        query = """
            SELECT id, full_name, email, role, is_active, created_at, contact_number
            FROM users
            WHERE role != 'borrower'
        """
        params = []

        if role_filter != 'all':
            query += " AND role = %s"
            params.append(role_filter)

        if search:
            query += " AND (full_name LIKE %s OR email LIKE %s)"
            params += [f'%{search}%', f'%{search}%']

        query += " ORDER BY created_at DESC"
        cursor.execute(query, params)
        users = cursor.fetchall()

        cursor.close()
        conn.close()
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')
        users = []

    return render_template('manage_users.html',
                           users=users,
                           role_filter=role_filter,
                           search=search)


@admin_bp.route('/users/create', methods=['GET', 'POST'])
@login_required
@role_required('super_admin')
def create_user():
    if request.method == 'POST':
        full_name      = request.form.get('full_name', '').strip()
        email          = request.form.get('email', '').strip()
        password       = request.form.get('password', '').strip()
        role           = request.form.get('role', '').strip()
        contact_number = request.form.get('contact_number', '').strip()

        if role not in ('admin', 'loan_officer', 'auditor', 'super_admin'):
            flash('Invalid role selected.', 'danger')
            return redirect(url_for('super_admin.create_user'))

        try:
            import bcrypt
            hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

            conn   = get_db()
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO users (full_name, email, password, role, contact_number,
                                   is_active, id_verification_status, created_at)
                VALUES (%s, %s, %s, %s, %s, 1, 'verified', NOW())
            """, (full_name, email, hashed, role, contact_number))
            conn.commit()
            log_activity('create_user', f'Created {role} account: {email}')
            flash(f'Staff account created for {full_name}.', 'success')
            cursor.close()
            conn.close()
            return redirect(url_for('super_admin.manage_users'))
        except mysql.connector.IntegrityError:
            flash('Email already exists.', 'danger')
        except Exception as e:
            flash(f'Error: {str(e)}', 'danger')

    return render_template('create_user.html')


@admin_bp.route('/users/<int:user_id>/toggle-status', methods=['POST'])
@login_required
@role_required('super_admin')
def toggle_user_status(user_id):
    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT full_name, is_active FROM users WHERE id = %s", (user_id,))
        user = cursor.fetchone()
        if not user:
            flash('User not found.', 'danger')
        else:
            new_status = 0 if user['is_active'] else 1
            cursor.execute("UPDATE users SET is_active = %s WHERE id = %s", (new_status, user_id))
            conn.commit()
            label = 'activated' if new_status else 'deactivated'
            log_activity('toggle_user_status', f'User {user_id} {label}')
            flash(f'{user["full_name"]} has been {label}.', 'success')
        cursor.close()
        conn.close()
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')

    return redirect(url_for('super_admin.manage_users'))


# ═════════════════════════════════════════════
# PENALTIES & OVERDUE MANAGEMENT
# ═════════════════════════════════════════════

@admin_bp.route('/penalties')
@login_required
@role_required('admin', 'super_admin', 'loan_officer', 'auditor')
def penalties_page():
    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT pen.*, l.loan_no, u.full_name AS borrower_name, u.email AS borrower_email,
                   l.outstanding_balance
            FROM penalties pen
            JOIN loans l ON pen.loan_id = l.id
            JOIN users u ON l.borrower_id = u.id
            ORDER BY pen.created_at DESC
        """)
        penalties = cursor.fetchall()

        cursor.close()
        conn.close()
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')
        penalties = []

    return render_template('penalties.html', penalties=penalties)


@admin_bp.route('/penalties/compute', methods=['POST'])
@login_required
@role_required('admin', 'super_admin', 'loan_officer')
def compute_penalties():
    """
    Run penalty computation for all overdue loans.
    Grace period: 5 days. Penalty rate: 2% of monthly payment per month overdue.
    """
    GRACE_DAYS    = 5
    PENALTY_RATE  = 0.02  # 2% of monthly_payment
    today         = datetime.date.today()
    applied_count = 0

    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT l.id AS loan_id, l.loan_no, l.monthly_payment,
                   l.outstanding_balance, l.next_due_date, l.borrower_id,
                   u.full_name AS borrower_name, u.email AS borrower_email
            FROM loans l
            JOIN users u ON l.borrower_id = u.id
            WHERE l.status = 'active'
              AND l.next_due_date IS NOT NULL
              AND l.next_due_date < %s
        """, (today - datetime.timedelta(days=GRACE_DAYS),))
        overdue_loans = cursor.fetchall()

        for loan in overdue_loans:
            days_overdue = (today - loan['next_due_date']).days - GRACE_DAYS
            if days_overdue <= 0:
                continue

            months_overdue = max(1, days_overdue // 30)
            penalty_amount = round(float(loan['monthly_payment']) * PENALTY_RATE * months_overdue, 2)

            # Avoid duplicate penalty for same period
            cursor.execute("""
                SELECT id FROM penalties
                WHERE loan_id = %s AND period_no = (
                    SELECT COALESCE(MAX(period_no), 0) + 1
                    FROM penalties WHERE loan_id = %s
                )
                LIMIT 1
            """, (loan['loan_id'], loan['loan_id']))

            cursor.execute("""
                INSERT INTO penalties (loan_id, amount, days_overdue, due_date, created_at)
                VALUES (%s, %s, %s, %s, NOW())
                ON DUPLICATE KEY UPDATE amount = %s
            """, (loan['loan_id'], penalty_amount, days_overdue, loan['next_due_date'], penalty_amount))

            # Add penalty to outstanding balance
            cursor.execute("""
                UPDATE loans SET outstanding_balance = outstanding_balance + %s WHERE id = %s
            """, (penalty_amount, loan['loan_id']))

            applied_count += 1

            # Send overdue email
            try:
                msg = Message('Overdue Payment Notice - Loan Management System',
                              recipients=[loan['borrower_email']])
                msg.html = f"""
                <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;
                            background:#0f172a;color:#e2e8f0;padding:40px;border-radius:12px;">
                  <h2 style="color:#f59e0b;">Overdue Payment Alert</h2>
                  <p>Hello <strong>{loan['borrower_name']}</strong>,</p>
                  <p>Your loan <strong>{loan['loan_no']}</strong> has a payment
                     overdue by <strong>{days_overdue} days</strong>.</p>
                  <p>A penalty of <strong>₱{penalty_amount:,.2f}</strong> has been added
                     to your outstanding balance.</p>
                  <p>Please settle your account immediately to avoid further penalties.</p>
                </div>"""
                mail.send(msg)
            except Exception:
                pass

        conn.commit()
        log_activity('compute_penalties', f'Applied penalties to {applied_count} loans')
        flash(f'Penalties applied to {applied_count} overdue loan(s).', 'success' if applied_count else 'info')
        cursor.close()
        conn.close()
    except Exception as e:
        flash(f'Error computing penalties: {str(e)}', 'danger')

    return redirect(url_for('super_admin.penalties_page'))


# ═════════════════════════════════════════════
# ACTIVITY LOGS
# ═════════════════════════════════════════════

@admin_bp.route('/activity-logs')
@login_required
@role_required('admin', 'super_admin', 'auditor')
def activity_logs():
    search     = request.args.get('search', '').strip()
    date_from  = request.args.get('date_from', '')
    date_to    = request.args.get('date_to', '')

    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)

        query = """
            SELECT al.*, u.full_name AS actor_name, u.role AS actor_role
            FROM activity_logs al
            LEFT JOIN users u ON u.id = al.user_id
            WHERE 1=1
        """
        params = []

        if search:
            query += " AND (al.action LIKE %s OR al.details LIKE %s OR u.full_name LIKE %s)"
            params += [f'%{search}%', f'%{search}%', f'%{search}%']

        if date_from:
            query += " AND DATE(al.created_at) >= %s"
            params.append(date_from)

        if date_to:
            query += " AND DATE(al.created_at) <= %s"
            params.append(date_to)

        query += " ORDER BY al.created_at DESC LIMIT 500"
        cursor.execute(query, params)
        logs = cursor.fetchall()

        cursor.close()
        conn.close()
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')
        logs = []

    return render_template('activity_logs.html',
                           logs=logs,
                           search=search,
                           date_from=date_from,
                           date_to=date_to)


# ═════════════════════════════════════════════
# REPORTS
# ═════════════════════════════════════════════

@admin_bp.route('/reports')
@login_required
@role_required('admin', 'super_admin', 'auditor')
def reports_page():
    return render_template('reports.html')


@admin_bp.route('/reports/amortization/<int:loan_id>')
@login_required
@role_required('admin', 'super_admin', 'loan_officer', 'auditor')
def report_amortization(loan_id):
    """Generate amortization schedule report for a specific loan."""
    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT l.*, lt.name AS type_name, lp.plan_name,
                   u.full_name AS borrower_name, u.email AS borrower_email
            FROM loans l
            JOIN loan_types lt ON l.loan_type_id = lt.id
            JOIN loan_plans lp ON l.loan_plan_id = lp.id
            JOIN users u ON l.borrower_id = u.id
            WHERE l.id = %s
        """, (loan_id,))
        loan = cursor.fetchone()

        if not loan:
            flash('Loan not found.', 'danger')
            return redirect(url_for('super_admin.reports_page'))

        cursor.execute("""
            SELECT * FROM amortization_schedule
            WHERE loan_id = %s ORDER BY period_no
        """, (loan_id,))
        schedule = cursor.fetchall()

        cursor.close()
        conn.close()

        return render_template('report_amortization.html', loan=loan, schedule=schedule)
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')
        return redirect(url_for('super_admin.reports_page'))


@admin_bp.route('/reports/loan-performance')
@login_required
@role_required('admin', 'super_admin', 'auditor')
def report_loan_performance():
    """Loan performance report by type and date range."""
    date_from  = request.args.get('date_from', '')
    date_to    = request.args.get('date_to', '')
    type_filter = request.args.get('type', 'all')

    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)

        query = """
            SELECT l.*, lt.name AS type_name, lp.plan_name,
                   u.full_name AS borrower_name
            FROM loans l
            JOIN loan_types lt ON l.loan_type_id = lt.id
            JOIN loan_plans lp ON l.loan_plan_id = lp.id
            JOIN users u ON l.borrower_id = u.id
            WHERE 1=1
        """
        params = []

        if type_filter != 'all':
            query += " AND l.loan_type_id = %s"
            params.append(type_filter)

        if date_from:
            query += " AND DATE(l.created_at) >= %s"
            params.append(date_from)

        if date_to:
            query += " AND DATE(l.created_at) <= %s"
            params.append(date_to)

        query += " ORDER BY l.created_at DESC"
        cursor.execute(query, params)
        loans = cursor.fetchall()

        # Summary stats
        total_disbursed  = sum(float(l['disbursed_amount'] or 0) for l in loans)
        total_balance    = sum(float(l['outstanding_balance'] or 0) for l in loans)
        active_count     = sum(1 for l in loans if l['status'] == 'active')
        paid_count       = sum(1 for l in loans if l['status'] == 'paid')
        defaulted_count  = sum(1 for l in loans if l['status'] == 'defaulted')

        cursor.execute("SELECT * FROM loan_types WHERE is_active=1")
        types = cursor.fetchall()

        cursor.close()
        conn.close()

        return render_template('report_loan_performance.html',
                               loans=loans,
                               total_disbursed=total_disbursed,
                               total_balance=total_balance,
                               active_count=active_count,
                               paid_count=paid_count,
                               defaulted_count=defaulted_count,
                               types=types,
                               date_from=date_from,
                               date_to=date_to,
                               type_filter=type_filter)
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')
        return redirect(url_for('super_admin.reports_page'))


@admin_bp.route('/reports/borrower-history/<int:borrower_id>')
@login_required
@role_required('admin', 'super_admin', 'loan_officer', 'auditor')
def report_borrower_history(borrower_id):
    """Individual borrower payment history report."""
    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT u.*, COALESCE(bp.credit_score, 500) AS credit_score,
                   COALESCE(bp.risk_level, 'medium') AS risk_level,
                   COALESCE(bp.total_paid, 0) AS total_paid,
                   COALESCE(bp.total_borrowed, 0) AS total_borrowed
            FROM users u
            LEFT JOIN borrower_profiles bp ON u.id = bp.user_id
            WHERE u.id = %s
        """, (borrower_id,))
        borrower = cursor.fetchone()

        if not borrower:
            flash('Borrower not found.', 'danger')
            return redirect(url_for('super_admin.reports_page'))

        cursor.execute("""
            SELECT p.*, l.loan_no, lt.name AS type_name
            FROM payments p
            JOIN loans l ON p.loan_id = l.id
            JOIN loan_types lt ON l.loan_type_id = lt.id
            WHERE l.borrower_id = %s AND p.status = 'approved'
            ORDER BY p.payment_date DESC
        """, (borrower_id,))
        payments = cursor.fetchall()

        cursor.execute("""
            SELECT l.*, lt.name AS type_name, lp.plan_name
            FROM loans l
            JOIN loan_types lt ON l.loan_type_id = lt.id
            JOIN loan_plans lp ON l.loan_plan_id = lp.id
            WHERE l.borrower_id = %s
            ORDER BY l.created_at DESC
        """, (borrower_id,))
        loans = cursor.fetchall()

        cursor.close()
        conn.close()

        return render_template('report_borrower_history.html',
                               borrower=borrower,
                               payments=payments,
                               loans=loans)
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')
        return redirect(url_for('super_admin.reports_page'))


@admin_bp.route('/reports/paid-loans')
@login_required
@role_required('admin', 'super_admin', 'auditor')
def report_paid_loans():
    """Record of all fully paid loans — bank note format."""
    date_from  = request.args.get('date_from', '')
    date_to    = request.args.get('date_to', '')

    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)

        query = """
            SELECT l.*, lt.name AS type_name, lp.plan_name,
                   u.full_name AS borrower_name, u.contact_number AS borrower_contact,
                   COALESCE(SUM(p.amount_paid), 0) AS total_paid_amount,
COALESCE(SUM(p.amount_paid) - l.principal_amount, 0) AS interest_earned
            FROM loans l
            JOIN loan_types lt ON l.loan_type_id = lt.id
            JOIN loan_plans lp ON l.loan_plan_id = lp.id
            JOIN users u ON l.borrower_id = u.id
            LEFT JOIN payments p ON p.loan_id = l.id AND p.status = 'approved'
            WHERE l.status = 'paid'
        """
        params = []

        if date_from:
            query += " AND DATE(l.created_at) >= %s"
            params.append(date_from)

        if date_to:
            query += " AND DATE(l.created_at) <= %s"
            params.append(date_to)

        query += " GROUP BY l.id ORDER BY l.created_at DESC"
        cursor.execute(query, params)
        paid_loans = cursor.fetchall()

        total_principal     = sum(float(l['principal_amount'] or 0) for l in paid_loans)
        total_interest      = sum(float(l['interest_earned'] or 0) for l in paid_loans)

        cursor.close()
        conn.close()

        return render_template('report_paid_loans.html',
                               paid_loans=paid_loans,
                               total_principal=total_principal,
                               total_interest=total_interest,
                               date_from=date_from,
                               date_to=date_to)
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')
        return redirect(url_for('super_admin.reports_page'))
    