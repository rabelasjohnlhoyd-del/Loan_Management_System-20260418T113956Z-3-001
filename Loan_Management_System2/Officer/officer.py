from flask import Blueprint, render_template, request, redirect, url_for, session, flash, jsonify
import datetime
import mysql.connector
from functools import wraps

# ── Blueprint setup ───────────────────────────────────────────────────────────
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

def log_activity(action, details=''):
    try:
        conn = get_db(); cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO activity_logs (user_id, action, details, ip_address, created_at)
            VALUES (%s, %s, %s, %s, NOW())
        """, (session.get('user_id'), action, details, request.remote_addr))
        conn.commit(); cursor.close(); conn.close()
    except Exception: pass

# ================================================================
# SECTION 2: OFFICER DASHBOARD
# ================================================================
@officer_bp.route('/dashboard')
@login_required
@role_required('loan_officer')
def officer_dashboard():
    stats = {'pending_applications': 0, 'pending_verifications': 0, 'active_loans': 0, 'total_borrowers': 0}
    recent_applications = []
    verification_queue = []

    try:
        conn = get_db(); cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT COUNT(*) AS cnt FROM loan_applications WHERE status IN ('submitted', 'under_review')")
        stats['pending_applications'] = cursor.fetchone()['cnt']
        cursor.execute("SELECT COUNT(*) AS cnt FROM users WHERE id_verification_status = 'pending'")
        stats['pending_verifications'] = cursor.fetchone()['cnt']
        cursor.execute("SELECT COUNT(*) AS cnt FROM loans WHERE status = 'active'")
        stats['active_loans'] = cursor.fetchone()['cnt']
        cursor.execute("SELECT COUNT(*) AS cnt FROM users WHERE role = 'borrower'")
        stats['total_borrowers'] = cursor.fetchone()['cnt']

        cursor.execute("""
            SELECT la.id, la.reference_no, u.full_name AS borrower_name, lt.name AS type_name, 
                   la.amount_requested, la.status, la.submitted_at
            FROM loan_applications la
            JOIN users u ON la.borrower_id = u.id
            JOIN loan_types lt ON la.loan_type_id = lt.id
            WHERE la.status IN ('submitted', 'under_review')
            ORDER BY la.submitted_at DESC LIMIT 5
        """)
        recent_applications = cursor.fetchall()

        cursor.execute("""
            SELECT id, full_name, email, created_at 
            FROM users WHERE id_verification_status = 'pending' 
            ORDER BY created_at DESC LIMIT 5
        """)
        verification_queue = cursor.fetchall()
        cursor.close(); conn.close()
    except Exception as e: flash(f'Error: {str(e)}', 'danger')

    return render_template('dashboard_officer.html', stats=stats, recent_applications=recent_applications, verification_queue=verification_queue)

# ================================================================
# SECTION 3: ID VERIFICATION
# ================================================================
@officer_bp.route('/verifications')
@login_required
@role_required('loan_officer')
def list_verifications():
    conn = get_db(); cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id, full_name, email, id_document_path, selfie_path FROM users WHERE id_verification_status = 'pending'")
    users = cursor.fetchall(); conn.close()
    return render_template('O_verify_list.html', users=users)

@officer_bp.route('/verify-user/<int:user_id>', methods=['POST'])
@login_required
@role_required('loan_officer')
def verify_user(user_id):
    decision = request.form.get('status'); risk = request.form.get('risk_level')
    try:
        conn = get_db(); cursor = conn.cursor()
        cursor.execute("UPDATE users SET id_verification_status = %s WHERE id = %s", (decision, user_id))
        cursor.execute("""
            INSERT INTO borrower_profiles (user_id, risk_level) VALUES (%s, %s)
            ON DUPLICATE KEY UPDATE risk_level = %s
        """, (user_id, risk, risk))
        conn.commit(); conn.close()
        flash("Verification completed.", "success")
    except Exception as e: flash(str(e), "danger")
    return redirect(url_for('officer.list_verifications'))

# ================================================================
# SECTION 4: BORROWER MANAGEMENT (Section 5 & 10 of PDF)
# ================================================================
@officer_bp.route('/borrowers')
@login_required
@role_required('loan_officer')
def manage_borrowers():
    """List of borrowers with Credit Scores and Risk Levels."""
    conn = get_db(); cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT u.id, u.full_name, u.email, 
               COALESCE(bp.credit_score, 0) as credit_score, 
               COALESCE(bp.risk_level, 'Not Set') as risk_level
        FROM users u
        LEFT JOIN borrower_profiles bp ON u.id = bp.user_id
        WHERE u.role = 'borrower'
    """)
    borrowers = cursor.fetchall(); conn.close()
    return render_template('O_borrowers.html', borrowers=borrowers)

@officer_bp.route('/update-score/<int:user_id>', methods=['POST'])
@login_required
@role_required('loan_officer')
def update_score(user_id):
    """Updates Credit Score based on payment history (PDF Section 10)."""
    score = request.form.get('credit_score')
    try:
        conn = get_db(); cursor = conn.cursor()
        cursor.execute("UPDATE borrower_profiles SET credit_score = %s WHERE user_id = %s", (score, user_id))
        conn.commit(); conn.close()
        flash("Credit score updated.", "success")
    except Exception as e: flash(str(e), "danger")
    return redirect(url_for('officer.manage_borrowers'))

# ================================================================
# SECTION 5: PROFILE & ACTIVITY (Existing)
# ================================================================
@officer_bp.route('/profile')
@login_required
@role_required('loan_officer')
def profile():
    conn = get_db(); cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM users WHERE id = %s", (session['user_id'],))
    user = cursor.fetchone(); conn.close()
    return render_template('O_profile.html', user=user)

@officer_bp.route('/my-activity')
@login_required
@role_required('loan_officer')
def my_activity():
    conn = get_db(); cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT action, details, created_at FROM activity_logs WHERE user_id = %s ORDER BY created_at DESC", (session['user_id'],))
    logs = cursor.fetchall(); conn.close()
    return render_template('officer_activity.html', logs=logs)