# ================================================================
# AUDITOR.PY — Hiraya Management System
# Blueprint for Auditor role (MySQL Updated Version)
# ================================================================

from flask import Blueprint, render_template, session, redirect, url_for, flash, request
from functools import wraps
import mysql.connector
from Loan_Management_System2 import db_config # Import configuration mula sa main file

# ── Blueprint setup ───────────────────────────────────────────────────────────
auditor_bp = Blueprint('auditor', __name__, 
                        template_folder='templates', 
                        static_folder='static', 
                        static_url_path='/officer/static')

# ── Database Helper ───────────────────────────────────────────────────────────
def get_db():
    """Helper to connect to MySQL based on your main app config."""
    return mysql.connector.connect(**db_config)

# ── Access control decorator ──────────────────────────────────────────────────
def auditor_required(f):
    """Restrict route to users with role 'auditor' only."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            flash('Please log in to continue.', 'warning')
            return redirect(url_for('auth.login'))
        if session.get('role') != 'auditor':
            flash('Access denied. Auditor privileges required.', 'danger')
            return redirect(url_for('auth.dashboard'))
        return f(*args, **kwargs)
    return decorated


# ── Dashboard ─────────────────────────────────────────────────────────────────
@auditor_bp.route('/dashboard')
@auditor_required
def auditor_dashboard():
    """Auditor main dashboard."""
    stats = {}
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("SELECT COUNT(*) as total FROM loans")
        stats['total_loans'] = cursor.fetchone()['total']
        
        cursor.execute("SELECT COUNT(*) as total FROM users WHERE role = 'borrower'")
        stats['total_borrowers'] = cursor.fetchone()['total']
        
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"Dashboard Error: {e}")
        
    return render_template('AU_dashboard.html', stats=stats)


# ── Profile ───────────────────────────────────────────────────────────────────
@auditor_bp.route('/profile')
@auditor_required
def profile():
    """Auditor profile page."""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute('SELECT * FROM users WHERE id = %s', (session['user_id'],))
        user = cursor.fetchone()
        cursor.close()
        conn.close()
        return render_template('AU_profile.html', user=user)
    except Exception as e:
        flash(f"Error fetching profile: {e}", "danger")
        return redirect(url_for('auditor.auditor_dashboard'))


# ── Loan Audit ────────────────────────────────────────────────────────────────
@auditor_bp.route('/loans')
@auditor_required
def audit_loans():
    """View all loans for audit purposes (read-only)."""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute('''
            SELECT l.*, u.full_name AS borrower_name, lt.name AS type_name
            FROM loans l
            JOIN users u  ON l.borrower_id = u.id
            JOIN loan_types lt ON l.loan_type_id = lt.id
            ORDER BY l.created_at DESC
        ''')
        loans = cursor.fetchall()
        cursor.close()
        conn.close()
        return render_template('audit_loans.html', loans=loans)
    except Exception as e:
        flash(f"Error fetching loans: {e}", "danger")
        return render_template('audit_loans.html', loans=[])


@auditor_bp.route('/loans/<int:loan_id>')
@auditor_required
def audit_loan_detail(loan_id):
    """View a single loan record in detail (read-only)."""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute('''
            SELECT l.*, u.full_name AS borrower_name, lt.name AS type_name
            FROM loans l
            JOIN users u  ON l.borrower_id = u.id
            JOIN loan_types lt ON l.loan_type_id = lt.id
            WHERE l.id = %s''', (loan_id,))
        loan = cursor.fetchone()

        if not loan:
            flash('Loan record not found.', 'danger')
            return redirect(url_for('auditor.audit_loans'))

        cursor.execute('SELECT * FROM payments WHERE loan_id = %s ORDER BY created_at DESC', (loan_id,))
        payments = cursor.fetchall()
        
        cursor.close()
        conn.close()
        return render_template('audit_loan_detail.html', loan=loan, payments=payments)
    except Exception as e:
        flash(f"Error: {e}", "danger")
        return redirect(url_for('auditor.audit_loans'))


# ── Payment Audit ─────────────────────────────────────────────────────────────
@auditor_bp.route('/payments')
@auditor_required
def audit_payments():
    """View all payment transactions for audit (read-only)."""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute('''
            SELECT p.*, u.full_name AS borrower_name, l.loan_no as reference_no
            FROM payments p
            JOIN loans l ON p.loan_id = l.id
            JOIN users u ON p.borrower_id = u.id
            ORDER BY p.created_at DESC
        ''')
        payments = cursor.fetchall()
        cursor.close()
        conn.close()
        return render_template('audit_payments.html', payments=payments)
    except Exception as e:
        flash(f"Error: {e}", "danger")
        return render_template('audit_payments.html', payments=[])


# ── Reports ───────────────────────────────────────────────────────────────────
@auditor_bp.route('/reports')
@auditor_required
def reports():
    """Auditor reports page."""
    return render_template('AU_reports.html')


@auditor_bp.route('/reports/loans')
@auditor_required
def report_loans():
    """Generate loan summary report."""
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute('''
        SELECT status, COUNT(*) AS count, SUM(principal_amount) AS total
        FROM loans
        GROUP BY status
    ''')
    summary = cursor.fetchall()
    cursor.close()
    conn.close()
    return render_template('AU_report_loans.html', summary=summary)


@auditor_bp.route('/reports/payments')
@auditor_required
def report_payments():
    """Generate payment summary report."""
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute('''
        SELECT DATE_FORMAT(created_at, '%Y-%m') AS month,
               COUNT(*) AS count,
               SUM(amount_paid) AS total
        FROM payments
        WHERE status = 'completed'
        GROUP BY month
        ORDER BY month DESC
    ''')
    monthly = cursor.fetchall()
    cursor.close()
    conn.close()
    return render_template('AU_report_payments.html', monthly=monthly)


# ── Activity Logs ─────────────────────────────────────────────────────────────
@auditor_bp.route('/activity-logs')
@auditor_required
def activity_logs():
    """View system activity logs (read-only)."""
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    page = request.args.get('page', 1, type=int)
    per_page = 50

    cursor.execute('''
        SELECT al.*, u.full_name AS actor_name
        FROM activity_logs al
        LEFT JOIN users u ON al.user_id = u.id
        ORDER BY al.created_at DESC
        LIMIT %s OFFSET %s''', (per_page, (page - 1) * per_page))
    logs = cursor.fetchall()

    cursor.execute('SELECT COUNT(*) as total FROM activity_logs')
    total = cursor.fetchone()['total']

    cursor.close()
    conn.close()
    return render_template('AU_activity_logs.html', logs=logs, page=page, per_page=per_page, total=total)


# ── Borrowers ─────────────────────────────────────────────────────────────────
@auditor_bp.route('/borrowers')
@auditor_required
def borrowers():
    """View all borrowers (read-only)."""
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute('''
        SELECT u.*, (SELECT COUNT(id) FROM loans WHERE borrower_id = u.id) AS loan_count
        FROM users u
        WHERE u.role = 'borrower'
        ORDER BY u.created_at DESC
    ''')
    borrowers = cursor.fetchall()
    cursor.close()
    conn.close()
    return render_template('AU_borrowers.html', borrowers=borrowers)


@auditor_bp.route('/borrowers/<int:borrower_id>')
@auditor_required
def borrower_detail(borrower_id):
    """View a single borrower's profile and loan history (read-only)."""
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute('SELECT * FROM users WHERE id = %s AND role = %s', (borrower_id, 'borrower'))
    borrower = cursor.fetchone()
    
    if not borrower:
        flash('Borrower not found.', 'danger')
        cursor.close(); conn.close()
        return redirect(url_for('auditor.borrowers'))

    cursor.execute('''
        SELECT l.*, lt.name AS type_name
        FROM loans l
        JOIN loan_types lt ON l.loan_type_id = lt.id
        WHERE l.borrower_id = %s
        ORDER BY l.created_at DESC''', (borrower_id,))
    loans = cursor.fetchall()

    cursor.close()
    conn.close()
    return render_template('AU_borrower_detail.html', borrower=borrower, loans=loans)