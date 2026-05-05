from flask import Blueprint, render_template, request, redirect, url_for, session, flash, jsonify
import datetime
import mysql.connector
from functools import wraps

# ── Blueprint setup ───────────────────────────────────────────────
officer_bp = Blueprint(
    'officer',
    __name__,
    template_folder='templates',
    static_folder='static',
    static_url_path='/officer/static'
)


# ================================================================
# SECTION 1: HELPER FUNCTIONS
# ================================================================
def get_db():
    import Loan_Management_System2 as lms
    return mysql.connector.connect(**lms.db_config)


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get('logged_in'):
            flash('Please log in to access this page.', 'warning')
            return redirect(url_for('auth.login'))
        return f(*args, **kwargs)
    return decorated


def role_required(*roles):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if session.get('role') not in roles:
                flash('Access denied.', 'danger')
                return redirect(url_for('auth.dashboard'))
            return f(*args, **kwargs)
        return decorated
    return decorator


def log_activity(action, details='', status='success'):
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO audit_logs (user_id, action, status, details, ip_address, device_info, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, NOW())
        """, (
            session.get('user_id'),
            action,
            status,
            details,
            request.remote_addr,
            request.user_agent.string[:255]
        ))
        conn.commit()
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"Officer Log Error: {e}")


def get_sidebar_stats():
    stats = {
        'pending_applications': 0,
        'pending_verifications': 0,
        'active_loans': 0,
        'pending_payments': 0,
        'locked_accounts': 0,
        'activity_logs': [],  # ← DAGDAG
    }
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT COUNT(*) AS cnt FROM loan_applications WHERE status IN ('submitted', 'under_review')")
        stats['pending_applications'] = cursor.fetchone()['cnt']

        cursor.execute("SELECT COUNT(*) AS cnt FROM users WHERE id_verification_status = 'pending'")
        stats['pending_verifications'] = cursor.fetchone()['cnt']

        cursor.execute("SELECT COUNT(*) AS cnt FROM loans WHERE status = 'active'")
        stats['active_loans'] = cursor.fetchone()['cnt']

        cursor.execute("SELECT COUNT(*) AS cnt FROM payments WHERE status = 'pending'")
        stats['pending_payments'] = cursor.fetchone()['cnt']

        cursor.execute("SELECT COUNT(*) AS cnt FROM users WHERE failed_attempts >= 5 AND role = 'borrower'")
        stats['locked_accounts'] = cursor.fetchone()['cnt']

        # ← DAGDAG: activity logs para sa notification dropdown
        cursor.execute("""
            SELECT al.id, al.action, al.details, al.created_at,
                   u.full_name AS actor_name
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            ORDER BY al.created_at DESC
            LIMIT 5
        """)
        stats['activity_logs'] = cursor.fetchall()

        cursor.close()
        conn.close()
    except Exception as e:
        print(f"get_sidebar_stats error: {e}")

    return stats

# ================================================================
# SECTION 2: OFFICER DASHBOARD
# ================================================================
@officer_bp.route('/dashboard')
@login_required
@role_required('loan_officer')
def officer_dashboard():
    stats = get_sidebar_stats()
    recent_applications = []
    verification_queue  = []

    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT la.id, la.reference_no, u.full_name AS borrower_name,
                   lt.name AS type_name, la.amount_requested,
                   la.status, la.submitted_at
            FROM loan_applications la
            JOIN users u  ON la.borrower_id   = u.id
            JOIN loan_types lt ON la.loan_type_id = lt.id
            WHERE la.status IN ('submitted', 'under_review')
            ORDER BY la.submitted_at DESC
            LIMIT 10
        """)
        recent_applications = cursor.fetchall()

        cursor.execute("""
            SELECT id, full_name, email
            FROM users
            WHERE id_verification_status = 'pending'
            ORDER BY created_at DESC
            LIMIT 5
        """)
        verification_queue = cursor.fetchall()

        cursor.close()
        conn.close()
    except Exception as e:
        flash(f'Dashboard error: {str(e)}', 'danger')

    return render_template('dashboard_officer.html',
                           stats=stats,
                           recent_applications=recent_applications,
                           verification_queue=verification_queue,
                           activity_logs=stats['activity_logs'],  # ← galing na sa stats
                           pending_applications_notif=recent_applications)


# ================================================================
# SECTION 3: LOAN APPLICATIONS (Officer View)
# ================================================================
@officer_bp.route('/applications')
@login_required
@role_required('loan_officer')
def officer_applications():
    status_filter = request.args.get('status', 'all')
    search        = request.args.get('search', '').strip()
    applications  = []
    counts        = {}

    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)

        query = """
            SELECT la.id, la.reference_no, la.amount_requested, la.status,
                   la.submitted_at, la.term_months,
                   u.full_name AS borrower_name, u.email AS borrower_email,
                   lt.name AS type_name, lp.plan_name,
                   COALESCE(bp.credit_score, 0) AS credit_score,
                   COALESCE(bp.risk_level, 'Not Set') AS risk_level
            FROM loan_applications la
            JOIN users u       ON la.borrower_id   = u.id
            JOIN loan_types lt ON la.loan_type_id   = lt.id
            JOIN loan_plans lp ON la.loan_plan_id   = lp.id
            LEFT JOIN borrower_profiles bp ON la.borrower_id = bp.user_id
            WHERE 1=1
        """
        params = []

        if status_filter != 'all':
            query += " AND la.status = %s"
            params.append(status_filter)

        if search:
            query += " AND (u.full_name LIKE %s OR la.reference_no LIKE %s OR u.email LIKE %s)"
            params += [f'%{search}%', f'%{search}%', f'%{search}%']

        query += " ORDER BY la.submitted_at DESC"
        cursor.execute(query, params)
        applications = cursor.fetchall()

        cursor.execute("SELECT status, COUNT(*) AS cnt FROM loan_applications GROUP BY status")
        counts = {r['status']: r['cnt'] for r in cursor.fetchall()}
        cursor.execute("SELECT COUNT(*) AS cnt FROM loan_applications")
        counts['all'] = cursor.fetchone()['cnt']

        cursor.close()
        conn.close()
    except Exception as e:
        flash(f'Error loading applications: {str(e)}', 'danger')

    return render_template('O_applications.html',
                           applications=applications,
                           counts=counts,
                           status_filter=status_filter,
                           search=search,
                           stats=get_sidebar_stats())


@officer_bp.route('/applications/<int:app_id>')
@login_required
@role_required('loan_officer')
def officer_application_detail(app_id):
    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT la.*, lt.name AS type_name, lp.plan_name,
                   lp.interest_rate, lp.processing_fee, lp.collateral_required,
                   u.full_name AS borrower_name, u.email AS borrower_email,
                   u.contact_number, u.employment_type, u.source_of_funds,
                   COALESCE(bp.credit_score, 0) AS credit_score,
                   COALESCE(bp.risk_level, 'Not Set') AS risk_level,
                   COALESCE(bp.active_loans, 0) AS active_loans,
                   COALESCE(bp.total_loans, 0) AS total_loans
            FROM loan_applications la
            JOIN users u       ON la.borrower_id   = u.id
            JOIN loan_types lt ON la.loan_type_id   = lt.id
            JOIN loan_plans lp ON la.loan_plan_id   = lp.id
            LEFT JOIN borrower_profiles bp ON la.borrower_id = bp.user_id
            WHERE la.id = %s
        """, (app_id,))
        app = cursor.fetchone()

        if not app:
            flash('Application not found.', 'danger')
            return redirect(url_for('officer.officer_applications'))

        cursor.execute(
            "SELECT * FROM application_documents WHERE application_id = %s",
            (app_id,)
        )
        docs = cursor.fetchall()

        cursor.execute("""
            SELECT l.loan_no, l.status, l.principal_amount,
                   l.outstanding_balance, l.created_at, lt.name AS type_name
            FROM loans l
            JOIN loan_types lt ON l.loan_type_id = lt.id
            WHERE l.borrower_id = %s
            ORDER BY l.created_at DESC
        """, (app['borrower_id'],))
        loan_history = cursor.fetchall()
        for l in loan_history:
            l['principal_amount']    = float(l.get('principal_amount') or 0)
            l['outstanding_balance'] = float(l.get('outstanding_balance') or 0)

        cursor.close()
        conn.close()

    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')
        return redirect(url_for('officer.officer_applications'))

    return render_template('O_application_detail.html',
                           app=app,
                           docs=docs,
                           loan_history=loan_history,
                           stats=get_sidebar_stats())


@officer_bp.route('/applications/<int:app_id>/recommend', methods=['POST'])
@login_required
@role_required('loan_officer')
def recommend_application(app_id):
    recommendation = request.form.get('recommendation')
    notes          = request.form.get('notes', '').strip()

    if recommendation not in ('under_review', 'flagged'):
        flash('Invalid recommendation.', 'danger')
        return redirect(url_for('officer.officer_application_detail', app_id=app_id))

    try:
        conn   = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE loan_applications
            SET status = %s, officer_notes = %s, reviewed_by = %s
            WHERE id = %s AND status = 'submitted'
        """, (recommendation, notes, session.get('user_id'), app_id))
        conn.commit()
        cursor.close()
        conn.close()

        log_activity('recommend_application',
                     f'App ID {app_id} set to {recommendation}. Notes: {notes}')
        flash(f'Application marked as {recommendation.replace("_", " ")}.', 'success')
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')

    return redirect(url_for('officer.officer_applications'))


# ================================================================
# SECTION 4: ID VERIFICATION
# ================================================================
@officer_bp.route('/verifications')
@login_required
@role_required('loan_officer')
def list_verifications():
    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT id, full_name, email, id_document_path, selfie_path, created_at
            FROM users
            WHERE id_verification_status = 'pending'
            ORDER BY created_at DESC
        """)
        users = cursor.fetchall()
        cursor.close()
        conn.close()
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')
        users = []

    return render_template('O_verify_list.html',
                           users=users,
                           stats=get_sidebar_stats())


@officer_bp.route('/verify-user/<int:user_id>', methods=['POST'])
@login_required
@role_required('loan_officer')
def verify_user(user_id):
    decision = request.form.get('status')
    risk     = request.form.get('risk_level', 'medium')

    if decision not in ('verified', 'rejected'):
        flash('Invalid decision.', 'danger')
        return redirect(url_for('officer.list_verifications'))

    try:
        conn   = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE users
            SET id_verification_status = %s, verified_by = %s, verified_at = NOW()
            WHERE id = %s
        """, (decision, session.get('user_id'), user_id))
        cursor.execute("""
            INSERT INTO borrower_profiles (user_id, risk_level)
            VALUES (%s, %s)
            ON DUPLICATE KEY UPDATE risk_level = %s
        """, (user_id, risk, risk))
        conn.commit()
        cursor.close()
        conn.close()

        log_activity('verify_user_id', f'User ID {user_id} -> {decision}, risk: {risk}')
        flash(f'Verification completed: {decision}.', 'success')
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')

    return redirect(url_for('officer.list_verifications'))


# ================================================================
# SECTION 5: BORROWER MANAGEMENT
# ================================================================
@officer_bp.route('/borrowers')
@login_required
@role_required('loan_officer')
def manage_borrowers():
    search      = request.args.get('search', '').strip()
    risk_filter = request.args.get('risk', 'all')

    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)

        query = """
            SELECT u.id, u.full_name, u.email, u.contact_number,
                   u.id_verification_status, u.created_at,
                   COALESCE(bp.credit_score, 0) AS credit_score,
                   COALESCE(bp.risk_level, 'Not Set') AS risk_level,
                   COALESCE(bp.active_loans, 0) AS active_loans,
                   COALESCE(bp.total_loans, 0) AS total_loans
            FROM users u
            LEFT JOIN borrower_profiles bp ON u.id = bp.user_id
            WHERE u.role = 'borrower'
        """
        params = []

        if search:
            query += " AND (u.full_name LIKE %s OR u.email LIKE %s)"
            params += [f'%{search}%', f'%{search}%']

        if risk_filter != 'all':
            query += " AND COALESCE(bp.risk_level, 'Not Set') = %s"
            params.append(risk_filter)

        query += " ORDER BY u.created_at DESC"
        cursor.execute(query, params)
        borrowers = cursor.fetchall()
        cursor.close()
        conn.close()
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')
        borrowers = []

    return render_template('O_borrowers.html',
                           borrowers=borrowers,
                           search=search,
                           risk_filter=risk_filter,
                           stats=get_sidebar_stats())


@officer_bp.route('/borrowers/<int:borrower_id>')
@login_required
@role_required('loan_officer')
def borrower_detail(borrower_id):
    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT u.*,
                   COALESCE(bp.credit_score, 0) AS credit_score,
                   COALESCE(bp.risk_level, 'Not Set') AS risk_level,
                   COALESCE(bp.active_loans, 0) AS active_loans,
                   COALESCE(bp.total_loans, 0) AS total_loans,
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
            return redirect(url_for('officer.manage_borrowers'))

        cursor.execute("""
            SELECT l.*, lt.name AS type_name, lp.plan_name
            FROM loans l
            JOIN loan_types lt ON l.loan_type_id = lt.id
            JOIN loan_plans lp ON l.loan_plan_id = lp.id
            WHERE l.borrower_id = %s
            ORDER BY l.created_at DESC
        """, (borrower_id,))
        loan_history = cursor.fetchall()
        for l in loan_history:
            l['principal_amount']    = float(l.get('principal_amount') or 0)
            l['outstanding_balance'] = float(l.get('outstanding_balance') or 0)
            l['monthly_payment']     = float(l.get('monthly_payment') or 0)

        cursor.execute("""
            SELECT la.*, lt.name AS type_name
            FROM loan_applications la
            JOIN loan_types lt ON la.loan_type_id = lt.id
            WHERE la.borrower_id = %s
              AND la.status NOT IN ('approved', 'rejected', 'cancelled')
            ORDER BY la.submitted_at DESC
        """, (borrower_id,))
        active_applications = cursor.fetchall()

        cursor.close()
        conn.close()
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')
        return redirect(url_for('officer.manage_borrowers'))

    return render_template('O_borrower_detail.html',
                           borrower=borrower,
                           loan_history=loan_history,
                           active_applications=active_applications,
                           stats=get_sidebar_stats())


@officer_bp.route('/update-score/<int:user_id>', methods=['POST'])
@login_required
@role_required('loan_officer')
def update_score(user_id):
    score = request.form.get('credit_score')
    risk  = request.form.get('risk_level')

    try:
        conn   = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE borrower_profiles
            SET credit_score = %s, risk_level = %s
            WHERE user_id = %s
        """, (score, risk, user_id))
        conn.commit()
        cursor.close()
        conn.close()

        log_activity('update_credit_score',
                     f'Borrower ID {user_id} -> score: {score}, risk: {risk}')
        flash('Credit score and risk level updated.', 'success')
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')

    return redirect(url_for('officer.borrower_detail', borrower_id=user_id))


@officer_bp.route('/payments/<int:payment_id>/verify', methods=['POST'])
@login_required
@role_required('loan_officer')
def verify_payment(payment_id):
    action = request.form.get('action')
    notes  = request.form.get('notes', '').strip()

    if action not in ('approved', 'rejected'):
        flash('Invalid action.', 'danger')
        return redirect(url_for('officer.payment_list'))

    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT p.*, l.outstanding_balance, l.monthly_payment,
                   l.term_months, l.id AS loan_id
            FROM payments p
            JOIN loans l ON p.loan_id = l.id
            WHERE p.id = %s AND p.status = 'pending'
        """, (payment_id,))
        payment = cursor.fetchone()

        if not payment:
            flash('Payment not found or already processed.', 'warning')
            cursor.close()
            conn.close()
            return redirect(url_for('officer.payment_list'))

        if action == 'approved':
            amount_paid     = float(payment.get('amount_paid') or 0)
            current_balance = float(payment.get('outstanding_balance') or 0)
            new_balance     = max(0, current_balance - amount_paid)

            cursor.execute("""
                UPDATE payments
                SET status = 'approved', verified_by = %s,
                    verified_at = NOW(), notes = %s
                WHERE id = %s
            """, (session.get('user_id'), notes, payment_id))

            cursor.execute("""
                UPDATE loans
                SET outstanding_balance = %s,
                    next_due_date = DATE_ADD(next_due_date, INTERVAL 1 MONTH),
                    status = CASE WHEN %s <= 0 THEN 'paid' ELSE status END
                WHERE id = %s
            """, (new_balance, new_balance, payment['loan_id']))

            cursor.execute("""
                UPDATE amortization_schedule
                SET is_paid = 1, paid_at = NOW()
                WHERE loan_id = %s AND is_paid = 0
                ORDER BY period_no ASC
                LIMIT 1
            """, (payment['loan_id'],))

            if new_balance <= 0:
                cursor.execute("""
                    UPDATE borrower_profiles
                    SET active_loans = GREATEST(0, active_loans - 1),
                        paid_loans   = paid_loans + 1
                    WHERE user_id = (SELECT borrower_id FROM loans WHERE id = %s)
                """, (payment['loan_id'],))

            log_activity('approve_payment',
                         f'Payment ID {payment_id} approved. '
                         f'Loan ID {payment["loan_id"]}. '
                         f'Balance: {current_balance} -> {new_balance}')
            flash('Payment approved and balance updated.', 'success')

        else:
            cursor.execute("""
                UPDATE payments
                SET status = 'rejected', verified_by = %s,
                    verified_at = NOW(), notes = %s
                WHERE id = %s
            """, (session.get('user_id'), notes, payment_id))

            log_activity('reject_payment',
                         f'Payment ID {payment_id} rejected. Reason: {notes}')
            flash('Payment rejected.', 'warning')

        conn.commit()
        cursor.close()
        conn.close()

    except Exception as e:
        flash(f'Error verifying payment: {str(e)}', 'danger')

    return redirect(url_for('officer.payment_list'))


# ================================================================
# SECTION 7: ACTIVE LOANS (Officer View — Read Only)
# ================================================================
@officer_bp.route('/loans')
@login_required
@role_required('loan_officer')
def officer_loans():
    status_filter = request.args.get('status', 'active')
    search        = request.args.get('search', '').strip()

    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)

        query = """
            SELECT l.id, l.loan_no, l.status, l.principal_amount,
                   l.outstanding_balance, l.monthly_payment, l.next_due_date,
                   l.disbursed_at, l.maturity_date, l.created_at,
                   lt.name AS type_name, lp.plan_name,
                   u.full_name AS borrower_name, u.email AS borrower_email
            FROM loans l
            JOIN loan_types lt ON l.loan_type_id = lt.id
            JOIN loan_plans lp ON l.loan_plan_id = lp.id
            JOIN users u       ON l.borrower_id  = u.id
            WHERE 1=1
        """
        params = []

        if status_filter != 'all':
            query += " AND l.status = %s"
            params.append(status_filter)

        if search:
            query += " AND (u.full_name LIKE %s OR l.loan_no LIKE %s)"
            params += [f'%{search}%', f'%{search}%']

        query += " ORDER BY l.created_at DESC"
        cursor.execute(query, params)
        loans = cursor.fetchall()

        for l in loans:
            l['principal_amount']    = float(l.get('principal_amount') or 0)
            l['outstanding_balance'] = float(l.get('outstanding_balance') or 0)
            l['monthly_payment']     = float(l.get('monthly_payment') or 0)

        cursor.execute("SELECT status, COUNT(*) AS cnt FROM loans GROUP BY status")
        counts = {r['status']: r['cnt'] for r in cursor.fetchall()}
        cursor.execute("SELECT COUNT(*) AS cnt FROM loans")
        counts['all'] = cursor.fetchone()['cnt']

        cursor.close()
        conn.close()
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')
        loans, counts = [], {}

    today = datetime.date.today()

    return render_template('O_loans.html',
                           loans=loans,
                           counts=counts,
                           status_filter=status_filter,
                           search=search,
                           today=today,
                           stats=get_sidebar_stats())


@officer_bp.route('/loans/<int:loan_id>')
@login_required
@role_required('loan_officer')
def officer_loan_detail(loan_id):
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
            JOIN users u       ON l.borrower_id  = u.id
            WHERE l.id = %s
        """, (loan_id,))
        loan = cursor.fetchone()

        if not loan:
            flash('Loan not found.', 'danger')
            return redirect(url_for('officer.officer_loans'))

        for key in ('principal_amount', 'outstanding_balance', 'monthly_payment',
                    'disbursed_amount', 'processing_fee'):
            loan[key] = float(loan.get(key) or 0)

        cursor.execute("""
            SELECT * FROM amortization_schedule
            WHERE loan_id = %s ORDER BY period_no ASC
        """, (loan_id,))
        schedule = cursor.fetchall()
        for row in schedule:
            row['principal_due'] = float(row.get('principal_due') or 0)
            row['interest_due']  = float(row.get('interest_due') or 0)
            row['total_due']     = float(row.get('total_due') or 0)
            row['balance_after'] = float(row.get('balance_after') or 0)

        cursor.execute("""
            SELECT p.*, u.full_name AS verified_by_name
            FROM payments p
            LEFT JOIN users u ON p.verified_by = u.id
            WHERE p.loan_id = %s
            ORDER BY p.payment_date DESC
        """, (loan_id,))
        payment_history = cursor.fetchall()
        for row in payment_history:
            row['amount_paid'] = float(row.get('amount_paid') or 0)

        cursor.execute("""
            SELECT * FROM penalties
            WHERE loan_id = %s ORDER BY created_at DESC
        """, (loan_id,))
        penalties = cursor.fetchall()
        for row in penalties:
            row['amount'] = float(row.get('amount') or 0)

        cursor.close()
        conn.close()
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')
        return redirect(url_for('officer.officer_loans'))

    today = datetime.date.today()

    return render_template('O_loan_detail.html',
                           loan=loan,
                           schedule=schedule,
                           payment_history=payment_history,
                           penalties=penalties,
                           today=today,
                           stats=get_sidebar_stats())


# ================================================================
# SECTION 8: PROFILE & ACTIVITY
# ================================================================
@officer_bp.route('/profile')
@login_required
@role_required('loan_officer')
def profile():
    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM users WHERE id = %s", (session['user_id'],))
        user = cursor.fetchone()
        cursor.close()
        conn.close()
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')
        user = None

    return render_template('O_profile.html',
                           user=user,
                           stats=get_sidebar_stats())


@officer_bp.route('/my-activity')
@login_required
@role_required('loan_officer')
def my_activity():
    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT action, status, details, ip_address, created_at
            FROM audit_logs
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 100
        """, (session['user_id'],))
        logs = cursor.fetchall()
        cursor.close()
        conn.close()
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')
        logs = []

    return render_template('officer_activity.html',
                           logs=logs,
                           stats=get_sidebar_stats())


# ================================================================
# SECTION 9: API ENDPOINTS
# ================================================================
@officer_bp.route('/api/stats')
@login_required
@role_required('loan_officer')
def api_stats():
    try:
        stats = get_sidebar_stats()
        return jsonify(stats)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ================================================================
# SECTION 10: LOCKED ACCOUNT MANAGEMENT
# ================================================================
@officer_bp.route('/locked-accounts')
@login_required
@role_required('loan_officer')
def locked_accounts():
    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT id, full_name, email, contact_number,
                   failed_attempts, last_login, created_at
            FROM users
            WHERE failed_attempts >= 5 AND role = 'borrower'
            ORDER BY last_login DESC
        """)
        locked_users = cursor.fetchall()
        cursor.close()
        conn.close()
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')
        locked_users = []

    return render_template('O_locked_accounts.html',
                           locked_users=locked_users,
                           stats=get_sidebar_stats())


@officer_bp.route('/unlock-account/<int:user_id>', methods=['POST'])
@login_required
@role_required('loan_officer')
def unlock_account(user_id):
    notes = request.form.get('notes', '').strip()

    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT full_name, email FROM users
            WHERE id = %s AND failed_attempts >= 5
        """, (user_id,))
        user = cursor.fetchone()

        if not user:
            flash('Account not found or not locked.', 'warning')
            cursor.close()
            conn.close()
            return redirect(url_for('officer.locked_accounts'))

        # Unlock the account
        cursor.execute(
            "UPDATE users SET failed_attempts = 0 WHERE id = %s",
            (user_id,)
        )

        # Resolve any pending unlock requests
        cursor.execute("""
            UPDATE unlock_requests
            SET status = 'resolved', notes = %s
            WHERE user_id = %s AND status = 'pending'
        """, (notes, user_id))

        conn.commit()

        # Send unlock email
        try:
            from Loan_Management_System2 import mail
            from flask_mail import Message as MailMessage

            html_body = render_template(
                'email_unlock.html',
                full_name=user['full_name'],
                notes=notes,
                login_url='http://127.0.0.1:5000/auth/login',
                support_email='support@hiraya.com'
            )
            msg = MailMessage(
                subject='Your Hiraya Account Has Been Unlocked',
                recipients=[user['email']],
                html=html_body
            )
            mail.send(msg)
        except Exception as mail_err:
            print(f"Email send error: {mail_err}")
            # Don't block the unlock if email fails

        log_activity('unlock_account',
                     f'User ID {user_id} ({user["email"]}) unlocked. Notes: {notes}')
        flash(f'Account unlocked. Email sent to {user["email"]}.', 'success')

        cursor.close()
        conn.close()

    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')

    return redirect(url_for('officer.locked_accounts'))