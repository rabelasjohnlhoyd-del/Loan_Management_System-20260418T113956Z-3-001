# ================================================================
# LOGIN.PY — Loan Management System Authentication Blueprint
# ================================================================

# ================================================================
# SECTION 1: IMPORTS & CONFIGURATION
# ================================================================
from flask import Blueprint, render_template, request, redirect, url_for, session, flash, jsonify
import datetime
import random
import os
import json
import base64 as _base64
import uuid
from functools import wraps
from google import genai
from google.genai import types
from flask_mail import Message
from Loan_Management_System2 import db_config, mail
import mysql.connector
import bcrypt
from werkzeug.utils import secure_filename

# Blueprint setup
auth = Blueprint('auth', __name__, template_folder='templates', static_folder='static', static_url_path='/auth/static')

# Upload configuration
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'static', 'uploads')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'pdf', 'gif'}

# Gemini AI model
GEMINI_MODEL = 'gemini-2.5-flash'


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
# SECTION 3: AUTH CORE — LOGIN / LOGOUT
# ================================================================
@auth.route('/login', methods=['GET', 'POST'])
def login():
    if is_logged_in():
        return redirect(url_for('auth.dashboard'))

    if request.method == 'POST':
        email = request.form.get('email', '').strip()
        password = request.form.get('password', '').strip()

        if not email or not password:
            flash('Email and password are required.', 'danger')
            return render_template('login.html')

        try:
            conn = get_db()
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT * FROM users WHERE email = %s AND is_active = 1", (email,))
            user = cursor.fetchone()
            cursor.close()
            conn.close()

            if user and bcrypt.checkpw(password.encode('utf-8'), user['password'].encode('utf-8')):
                if user.get('failed_attempts', 0) >= 5:
                    flash('Account locked due to too many failed attempts. Contact support.', 'danger')
                    return render_template('login.html')

                conn = get_db()
                cursor = conn.cursor()
                cursor.execute("UPDATE users SET failed_attempts = 0, last_login = %s WHERE id = %s",
                               (datetime.datetime.now(), user['id']))
                conn.commit()
                cursor.close()
                conn.close()

                session['logged_in'] = True
                session['user_id'] = user['id']
                session['user_name'] = user['full_name']
                session['user_email'] = user['email']
                session['role'] = user['role']
                session['verified'] = user['id_verification_status']
                session['remember_me'] = 'remember' in request.form

                flash(f'Welcome back, {user["full_name"]}!', 'success')
                return redirect(url_for('auth.dashboard'))
            else:
                if user:
                    conn = get_db()
                    cursor = conn.cursor()
                    cursor.execute("UPDATE users SET failed_attempts = failed_attempts + 1 WHERE id = %s", (user['id'],))
                    conn.commit()
                    cursor.close()
                    conn.close()
                flash('Invalid email or password.', 'danger')
        except Exception as e:
            flash(f'Database error: {str(e)}', 'danger')

    return render_template('login.html')


@auth.route('/logout', methods=['GET', 'POST'])
def logout():
    session.clear()
    flash('You have been logged out successfully.', 'info')
    return redirect(url_for('auth.login'))


# ================================================================
# SECTION 4: REGISTRATION FLOW
# ================================================================
# 4.1 REGISTER
@auth.route('/register', methods=['GET', 'POST'])
def register():
    if is_logged_in():
        return redirect(url_for('auth.dashboard'))

    if request.method == 'POST':
        full_name = request.form.get('full_name', '').strip()
        email = request.form.get('email', '').strip()
        dob_str = request.form.get('dob', '').strip()
        password = request.form.get('password', '').strip()
        confirm_pass = request.form.get('confirm_password', '').strip()
        contact = request.form.get('contact_number', '').strip()
        terms = request.form.get('terms')

        errors = []
        if not all([full_name, email, dob_str, password, confirm_pass, contact]):
            errors.append('All fields are required.')
        if password != confirm_pass:
            errors.append('Passwords do not match.')
        if len(password) < 8:
            errors.append('Password must be at least 8 characters.')
        if not terms:
            errors.append('You must accept the Terms & Conditions.')

        dob = None
        age = None
        if dob_str:
            try:
                dob = datetime.datetime.strptime(dob_str, '%Y-%m-%d').date()
                today = datetime.date.today()
                age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
                if age < 18:
                    errors.append('You must be at least 18 years old.')
            except ValueError:
                errors.append('Invalid date of birth.')

        if errors:
            for err in errors:
                flash(err, 'danger')
            return render_template('register.html', form_data=request.form)

        try:
            conn = get_db()
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
            existing = cursor.fetchone()
            cursor.close()
            conn.close()

            if existing:
                flash('An account with this email already exists.', 'danger')
                return render_template('register.html', form_data=request.form)
        except Exception as e:
            flash(f'Database error: {str(e)}', 'danger')
            return render_template('register.html', form_data=request.form)

        hashed_pw = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        session['reg_data'] = {
            'full_name': full_name,
            'email': email,
            'dob': dob_str,
            'age': age,
            'password': hashed_pw,
            'contact_number': contact,
            'terms_accepted': True,
            'terms_version': '1.0',
            'terms_timestamp': datetime.datetime.now().isoformat()
        }

        otp = str(random.randint(100000, 999999))
        session['otp'] = otp
        session['otp_expiry'] = (datetime.datetime.now() + datetime.timedelta(minutes=10)).isoformat()
        session['otp_email'] = email

        try:
            msg = Message('Your Verification OTP - Loan Management System', recipients=[email])
            msg.html = f"""
            <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;
                        background:#0f172a;color:#e2e8f0;padding:40px;border-radius:12px;">
              <h2 style="color:#38bdf8;margin-bottom:8px;">Email Verification</h2>
              <p>Hello <strong>{full_name}</strong>,</p>
              <p>Use the OTP below to verify your email. It expires in <strong>10 minutes</strong>.</p>
              <div style="background:#1e293b;border-radius:8px;padding:24px;text-align:center;
                          margin:24px 0;letter-spacing:12px;font-size:36px;
                          font-weight:bold;color:#38bdf8;">{otp}</div>
              <p style="font-size:12px;color:#64748b;">If you did not register, ignore this email.</p>
            </div>"""
            mail.send(msg)
            flash(f'OTP sent to {email}. Please check your inbox.', 'success')
        except Exception as e:
            flash(f'Could not send OTP: {str(e)}. Dev OTP: {otp}', 'warning')

        return redirect(url_for('auth.verify_otp'))

    return render_template('register.html', form_data={})


# 4.2 OTP VERIFICATION
@auth.route('/verify-otp', methods=['GET', 'POST'])
def verify_otp():
    if 'reg_data' not in session:
        return redirect(url_for('auth.register'))

    if request.method == 'POST':
        entered_otp = ''.join([request.form.get(f'otp{i}', '') for i in range(1, 7)])
        stored_otp = session.get('otp')
        otp_expiry = session.get('otp_expiry')

        if not stored_otp or not otp_expiry:
            flash('OTP session expired. Please register again.', 'danger')
            return redirect(url_for('auth.register'))

        if datetime.datetime.now() > datetime.datetime.fromisoformat(otp_expiry):
            flash('OTP has expired. Please register again.', 'danger')
            session.pop('reg_data', None)
            session.pop('otp', None)
            return redirect(url_for('auth.register'))

        if entered_otp == stored_otp:
            session['otp_verified'] = True
            return redirect(url_for('auth.upload_id'))
        else:
            flash('Invalid OTP. Please try again.', 'danger')

    return render_template('verify_otp.html', email=session.get('otp_email', ''))


# 4.3 RESEND OTP (AJAX)
@auth.route('/resend-otp', methods=['POST'])
def resend_otp():
    if 'reg_data' not in session:
        return jsonify({'success': False, 'message': 'Session expired'})

    otp = str(random.randint(100000, 999999))
    email = session.get('otp_email', '')
    name = session['reg_data'].get('full_name', 'User')

    session['otp'] = otp
    session['otp_expiry'] = (datetime.datetime.now() + datetime.timedelta(minutes=10)).isoformat()

    try:
        msg = Message('Your New OTP - Loan Management System', recipients=[email])
        msg.html = f"""
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;
                    background:#0f172a;color:#e2e8f0;padding:40px;border-radius:12px;">
          <h2 style="color:#38bdf8;">New OTP Request</h2>
          <p>Hello <strong>{name}</strong>, here is your new OTP:</p>
          <div style="background:#1e293b;border-radius:8px;padding:24px;text-align:center;
                      letter-spacing:12px;font-size:36px;font-weight:bold;color:#38bdf8;">{otp}</div>
          <p style="font-size:12px;color:#64748b;">Expires in 10 minutes.</p>
        </div>"""
        mail.send(msg)
        return jsonify({'success': True, 'message': 'OTP resent successfully!'})
    except Exception as e:
        return jsonify({'success': False, 'message': f'Failed: {str(e)}. Dev OTP: {otp}'})


# 4.4 GEMINI ID VALIDATION API
@auth.route('/validate-id-api', methods=['POST'])
def validate_id_api():
    if 'reg_data' not in session or not session.get('otp_verified'):
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.json
    id_b64 = data.get('id_image')
    selfie_b64 = data.get('selfie_image')
    id_mime = data.get('id_mime', 'image/jpeg')
    selfie_mime = data.get('selfie_mime', 'image/jpeg')
    id_type = data.get('id_type', 'Unknown')

    if not id_b64 or not selfie_b64:
        return jsonify({'error': 'Missing images'}), 400

    session['gemini_approved'] = False
    session['gemini_result'] = 'rejected'

    if id_mime == 'application/pdf':
        return jsonify({
            'valid_id': False,
            'id_reason': 'PDF format is not supported. Please upload JPG or PNG.',
            'clear_selfie': False,
            'selfie_reason': 'Not evaluated due to PDF ID.',
            'id_type_match': False,
            'confidence': 'low',
            'action': 'reject',
            'overall_reason': 'Please re-upload your ID as a JPG or PNG image.'
        })

    try:
        client = genai.Client(api_key=os.environ.get('GEMINI_API_KEY'))

        prompt = f"""You are a STRICT identity verification officer for a Philippine loan application system.
You will be shown TWO images. Analyze them both VERY carefully.

IMAGE 1: Should be a Philippine government-issued PHYSICAL ID card
IMAGE 2: Should be a selfie photo of the applicant

The applicant declared their ID type as: {id_type}

Respond ONLY with this exact JSON — no markdown fences, no extra text:
{{
  "valid_id": true or false,
  "id_reason": "brief specific reason",
  "clear_selfie": true or false,
  "selfie_reason": "brief specific reason",
  "id_type_match": true or false,
  "confidence": "high" or "medium" or "low",
  "action": "approve" or "review" or "reject",
  "overall_reason": "one sentence summary"
}}

AUTOMATIC REJECT — set valid_id=false for ANY of these:
• Screenshot, digital screen, spreadsheet, source code, or IDE visible
• No human portrait on the card
• Full name not readable
• No ID/serial number visible
• Card is expired, photocopied, or printed paper
• Image is too blurry or dark to read

VALID ID — set valid_id=true ONLY when ALL of these are true:
✔ Physical plastic or laminated card
✔ Human portrait printed directly on the card
✔ Full name clearly readable
✔ ID/serial number visible
✔ One of: SSS, PhilHealth, Passport, Driver's License, Voter ID,
  PhilSys/National ID, UMID, PRC ID, Postal ID, Senior Citizen ID,
  PWD ID, TIN ID, OFW ID, Firearms License

ACTION RULES:
  approve → valid_id=true AND clear_selfie=true AND id_type_match=true AND confidence=high
  review  → valid_id=true AND clear_selfie=true AND confidence=medium
  reject  → valid_id=false OR clear_selfie=false OR confidence=low"""

        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=[
                types.Part.from_text(text=prompt),
                types.Part.from_bytes(data=_base64.b64decode(id_b64), mime_type=id_mime),
                types.Part.from_bytes(data=_base64.b64decode(selfie_b64), mime_type=selfie_mime),
            ]
        )

        result_text = response.text.strip()
        if result_text.startswith('```'):
            parts = result_text.split('```')
            result_text = parts[1]
            if result_text.startswith('json'):
                result_text = result_text[4:]
        result_text = result_text.strip()
        result = json.loads(result_text)

        if not result.get('valid_id') or not result.get('clear_selfie'):
            result['action'] = 'reject'
            result['confidence'] = 'low'

        if result.get('id_type_match') is False:
            result['action'] = 'reject'
            result['confidence'] = 'low'
            result['overall_reason'] = (
                f'ID type mismatch. You selected "{id_type}" but the uploaded document appears different.'
            )

        action = result['action']
        session['gemini_result'] = action
        session['gemini_approved'] = (action == 'approve')

        return jsonify(result)

    except json.JSONDecodeError as e:
        session['gemini_approved'] = False
        session['gemini_result'] = 'reject'
        return jsonify({'error': 'Failed to parse validation response'}), 500
    except Exception as e:
        session['gemini_approved'] = False
        session['gemini_result'] = 'reject'
        return jsonify({'error': str(e)}), 500


# 4.5 UPLOAD ID
@auth.route('/upload-id', methods=['GET', 'POST'])
def upload_id():
    if 'reg_data' not in session or not session.get('otp_verified'):
        return redirect(url_for('auth.register'))

    if request.method == 'POST':
        id_file = request.files.get('valid_id')
        selfie_b64 = request.form.get('selfie_base64', '')

        errors = []
        if not id_file or not allowed_file(id_file.filename):
            errors.append('Please upload a valid ID (PNG, JPG).')
        if not selfie_b64:
            errors.append('Please take a selfie photo.')

        if errors:
            for err in errors:
                flash(err, 'danger')
            return render_template('upload_id.html')

        gemini_result = session.get('gemini_result', 'reject')
        if gemini_result not in ('approve', 'review'):
            flash('Your documents were not accepted. Please re-upload valid images to continue.', 'danger')
            return render_template('upload_id.html')

        gemini_approved = session.get('gemini_approved', False)
        if gemini_result == 'approve' and gemini_approved:
            verification_status = 'verified'
        else:
            verification_status = 'pending'

        os.makedirs(UPLOAD_FOLDER, exist_ok=True)

        id_filename = secure_filename(f"id_{datetime.datetime.now().timestamp()}_{id_file.filename}")
        id_file.save(os.path.join(UPLOAD_FOLDER, id_filename))

        selfie_data = _base64.b64decode(selfie_b64.split(',')[-1])
        selfie_filename = secure_filename(f"selfie_{uuid.uuid4().hex}.jpg")
        with open(os.path.join(UPLOAD_FOLDER, selfie_filename), 'wb') as f:
            f.write(selfie_data)

        reg = session['reg_data']
        try:
            conn = get_db()
            cursor = conn.cursor()

            cursor.execute("""
                INSERT INTO users
                    (full_name, email, date_of_birth, age, password, contact_number,
                     role, id_document_path, selfie_path,
                     id_verification_status, terms_accepted, terms_version,
                     terms_accepted_at, is_active, failed_attempts, created_at)
                VALUES (%s,%s,%s,%s,%s,%s,'borrower',%s,%s,%s,1,%s,%s,1,0,%s)
            """, (
                reg['full_name'], reg['email'], reg['dob'], reg['age'],
                reg['password'], reg['contact_number'],
                id_filename, selfie_filename,
                verification_status,
                reg['terms_version'], reg['terms_timestamp'],
                datetime.datetime.now()
            ))

            conn.commit()
            cursor.close()
            conn.close()

            for key in ('reg_data', 'otp', 'otp_expiry', 'otp_email', 'otp_verified', 'gemini_approved', 'gemini_result'):
                session.pop(key, None)

            if verification_status == 'verified':
                flash('Account created and ID verified! You may now log in and apply for loans.', 'success')
            else:
                flash('Account created! Your ID is under review. You will be notified once verified.', 'info')

            return redirect(url_for('auth.login'))

        except Exception as e:
            flash(f'Error saving account: {str(e)}', 'danger')

    return render_template('upload_id.html')


# ================================================================
# SECTION 5: PASSWORD RESET FLOW
# ================================================================
# 5.1 FORGOT PASSWORD
@auth.route('/forgot-password', methods=['GET', 'POST'])
def forgot_password():
    if request.method == 'POST':
        email = request.form.get('email', '').strip()
        try:
            conn = get_db()
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
            user = cursor.fetchone()
            cursor.close()
            conn.close()

            if user:
                reset_otp = str(random.randint(100000, 999999))
                session['reset_otp'] = reset_otp
                session['reset_email'] = email
                session['reset_expiry'] = (datetime.datetime.now() + datetime.timedelta(minutes=15)).isoformat()

                try:
                    msg = Message('Password Reset OTP - Loan Management System', recipients=[email])
                    msg.html = f"""
                    <div style="font-family:Arial,sans-serif;background:#0f172a;color:#e2e8f0;
                                padding:40px;border-radius:12px;max-width:500px;margin:0 auto;">
                      <h2 style="color:#f59e0b;">Password Reset</h2>
                      <p>Use this OTP to reset your password. Expires in <strong>15 minutes</strong>.</p>
                      <div style="background:#1e293b;border-radius:8px;padding:24px;text-align:center;
                                  letter-spacing:12px;font-size:36px;font-weight:bold;
                                  color:#f59e0b;">{reset_otp}</div>
                    </div>"""
                    mail.send(msg)
                except:
                    pass

            flash('If that email exists, a reset OTP has been sent.', 'info')
            return redirect(url_for('auth.reset_password'))
        except Exception as e:
            flash(f'Error: {str(e)}', 'danger')

    return render_template('forgot_password.html')


# 5.2 RESET PASSWORD
@auth.route('/reset-password', methods=['GET', 'POST'])
def reset_password():
    if 'reset_email' not in session:
        return redirect(url_for('auth.forgot_password'))

    if request.method == 'POST':
        entered_otp = request.form.get('otp', '').strip()
        new_password = request.form.get('new_password', '').strip()
        confirm_pass = request.form.get('confirm_password', '').strip()

        if entered_otp != session.get('reset_otp'):
            flash('Invalid OTP.', 'danger')
            return render_template('reset_password.html')

        if datetime.datetime.now() > datetime.datetime.fromisoformat(session.get('reset_expiry', '')):
            flash('OTP expired.', 'danger')
            return redirect(url_for('auth.forgot_password'))

        if new_password != confirm_pass:
            flash('Passwords do not match.', 'danger')
            return render_template('reset_password.html')

        if len(new_password) < 8:
            flash('Password must be at least 8 characters.', 'danger')
            return render_template('reset_password.html')

        hashed = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        try:
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("UPDATE users SET password = %s, failed_attempts = 0 WHERE email = %s",
                           (hashed, session['reset_email']))
            conn.commit()
            cursor.close()
            conn.close()

            session.pop('reset_otp', None)
            session.pop('reset_email', None)
            session.pop('reset_expiry', None)

            flash('Password reset successfully! Please log in.', 'success')
            return redirect(url_for('auth.login'))
        except Exception as e:
            flash(f'Error: {str(e)}', 'danger')

    return render_template('reset_password.html')


# ================================================================
# SECTION 6: DASHBOARD & REDIRECTS
# ================================================================
# 6.1 MAIN DASHBOARD (role-based redirect)
@auth.route('/dashboard')
@login_required
def dashboard():
    role = session.get('role', 'borrower')

    if role in ('super_admin', 'admin'):
        return redirect(url_for('super_admin.admin_dashboard'))
    elif role == 'loan_officer':
        return redirect(url_for('super_admin.officer_dashboard'))
    elif role == 'auditor':
        return redirect(url_for('super_admin.auditor_dashboard'))
    else:
        return redirect(url_for('auth.borrower_dashboard'))


# 6.2 BORROWER DASHBOARD
# 6.2 BORROWER DASHBOARD
@auth.route('/dashboard/borrower')
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

        # ── Recent loans (last 5) ──────────────────────────────
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

        # ── Stats: active count + outstanding balance ──────────
        cursor.execute("""
            SELECT COUNT(*) AS active_count,
                   COALESCE(SUM(outstanding_balance), 0) AS total_outstanding
            FROM loans
            WHERE borrower_id = %s AND status IN ('active', 'disbursed')
        """, (session['user_id'],))
        stats = cursor.fetchone() or {'active_count': 0, 'total_outstanding': 0}

        # ── Next payment due ───────────────────────────────────
        cursor.execute("""
            SELECT MIN(a.due_date) AS next_due,
                   SUM(a.total_due) AS next_amount
            FROM amortization_schedule a
            JOIN loans l ON a.loan_id = l.id
            WHERE l.borrower_id = %s
              AND l.status = 'active'
              AND a.status = 'pending'
              AND a.due_date >= CURDATE()
        """, (session['user_id'],))
        next_payment = cursor.fetchone() or {'next_due': None, 'next_amount': 0}

        # ── Total paid (via payments joined to loans) ──────────
        # Uses loan join to avoid borrower_id column issues in payments table
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
        # Log the actual error so you can debug it
        print(f"[borrower_dashboard ERROR] {e}")

    return render_template('dashboard_borrower.html',
                           recent_loans=recent_loans,
                           stats=stats,
                           next_payment=next_payment,
                           total_paid=total_paid)


# ================================================================
# SECTION 7: USER PROFILE
# ================================================================
@auth.route('/profile')
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
    return render_template('profile.html', user=user)


# ================================================================
# SECTION 8: API ENDPOINTS
# ================================================================
@auth.route('/api/check-email', methods=['POST'])
def check_email():
    email = request.json.get('email', '')
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
        exists = cursor.fetchone() is not None
        cursor.close()
        conn.close()
        return jsonify({'exists': exists})
    except:
        return jsonify({'exists': False})