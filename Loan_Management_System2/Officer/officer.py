"""
officer.py — Loan Management System
Blueprint for Loan Officer role.
Handles officer-specific views that are separate from super_admin.py.
Note: Applications, loans, payments, borrowers, penalties are managed
      through super_admin.py (accessible to loan_officer role).
      This blueprint handles officer profile and officer-specific dashboard.
"""

# ================================================================
# SECTION 1: IMPORTS & CONFIGURATION
# ================================================================
from flask import Blueprint, render_template, request, redirect, url_for, session, flash, jsonify
import datetime
import os
import mysql.connector
from functools import wraps
from Loan_Management_System2 import db_config, mail
from flask_mail import Message

# ── Blueprint setup ───────────────────────────────────────────────────────────
officer_bp = Blueprint(
    'officer',
    __name__,
    template_folder='templates',
    static_folder='static',
    static_url_path='/officer/static'
)


# ================================================================
# SECTION 2: HELPER FUNCTIONS
# ================================================================
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

def log_activity(action, details=''):
    """Helper to log officer activity."""
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


# ================================================================
# SECTION 3: OFFICER DASHBOARD
# ================================================================
@officer_bp.route('/dashboard')
@login_required
@role_required('loan_officer')
def officer_dashboard():
    """
    Officer-specific dashboard with stats relevant to loan officers.
    Note: The super_admin blueprint also has /admin/officer-dashboard
    which auth.dashboard redirects to. This route is the officer's
    own home when accessed via /officer/dashboard directly.
    """
    stats = {
        'pending_applications': 0,
        'active_loans':         0,
        'pending_payments':     0,
        'total_borrowers':      0,
        'pending_verifications': 0,
    }
    recent_applications = []
    pending_payments    = []

    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT COUNT(*) AS cnt FROM loan_applications
            WHERE status IN ('submitted', 'under_review')
        """)
        stats['pending_applications'] = cursor.fetchone()['cnt']

        cursor.execute("SELECT COUNT(*) AS cnt FROM loans WHERE status = 'active'")
        stats['active_loans'] = cursor.fetchone()['cnt']

        cursor.execute("SELECT COUNT(*) AS cnt FROM payments WHERE status = 'pending'")
        stats['pending_payments'] = cursor.fetchone()['cnt']

        cursor.execute("SELECT COUNT(*) AS cnt FROM users WHERE role = 'borrower'")
        stats['total_borrowers'] = cursor.fetchone()['cnt']

        cursor.execute("""
            SELECT COUNT(*) AS cnt FROM users
            WHERE id_verification_status = 'pending'
        """)
        stats['pending_verifications'] = cursor.fetchone()['cnt']

        cursor.execute("""
            SELECT la.id, la.reference_no, la.amount_requested, la.status,
                   la.submitted_at, u.full_name AS borrower_name, lt.name AS type_name
            FROM loan_applications la
            JOIN users u       ON u.id  = la.borrower_id
            JOIN loan_types lt ON lt.id = la.loan_type_id
            WHERE la.status IN ('submitted', 'under_review')
            ORDER BY la.submitted_at DESC
            LIMIT 5
        """)
        recent_applications = cursor.fetchall()

        cursor.execute("""
            SELECT p.id, p.payment_no, p.amount_paid, p.payment_date,
                   p.payment_method, p.status,
                   l.loan_no, u.full_name AS borrower_name
            FROM payments p
            JOIN loans l ON p.loan_id  = l.id
            JOIN users u ON l.borrower_id = u.id
            WHERE p.status = 'pending'
            ORDER BY p.payment_date DESC
            LIMIT 5
        """)
        pending_payments = cursor.fetchall()

        cursor.close()
        conn.close()

    except Exception as e:
        flash(f'Dashboard error: {str(e)}', 'warning')

    return render_template(
        'dashboard_officer.html',
        stats=stats,
        recent_applications=recent_applications,
        pending_payments=pending_payments,
        user_name=session.get('user_name')
    )


# ================================================================
# SECTION 4: OFFICER PROFILE
# ================================================================
@officer_bp.route('/profile')
@login_required
@role_required('loan_officer')
def profile():
    """Officer profile page."""
    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM users WHERE id = %s", (session['user_id'],))
        user = cursor.fetchone()
        cursor.close()
        conn.close()
    except Exception as e:
        flash(f'Error loading profile: {str(e)}', 'danger')
        user = {}

    return render_template('O_profile.html', user=user)


# ================================================================
# SECTION 5: OFFICER ACTIVITY LOG (own actions only)
# ================================================================
@officer_bp.route('/my-activity')
@login_required
@role_required('loan_officer')
def my_activity():
    """View this officer's own activity log."""
    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT action, details, ip_address, created_at
            FROM activity_logs
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

    return render_template('officer_activity.html', logs=logs)


# ================================================================
# SECTION 6: QUICK ACTIONS (AJAX endpoints for officer dashboard)
# ================================================================

# 6.1 GET PENDING COUNTS (for dashboard badge refresh)
@officer_bp.route('/api/pending-counts')
@login_required
@role_required('loan_officer')
def pending_counts():
    """Return live pending counts for dashboard badge updates."""
    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT COUNT(*) AS cnt FROM loan_applications
            WHERE status IN ('submitted', 'under_review')
        """)
        apps = cursor.fetchone()['cnt']

        cursor.execute("SELECT COUNT(*) AS cnt FROM payments WHERE status = 'pending'")
        payments = cursor.fetchone()['cnt']

        cursor.execute("""
            SELECT COUNT(*) AS cnt FROM users
            WHERE id_verification_status = 'pending'
        """)
        verifications = cursor.fetchone()['cnt']

        cursor.close()
        conn.close()

        return jsonify({
            'applications':   apps,
            'payments':       payments,
            'verifications':  verifications,
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500