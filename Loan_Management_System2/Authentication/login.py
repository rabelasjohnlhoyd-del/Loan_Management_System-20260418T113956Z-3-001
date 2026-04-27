# ================================================================
# LOGIN.PY — ULTIMATE SECURE FINTECH VERSION (Full Update)
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
import re
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
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'} 

# Gemini AI model
GEMINI_MODELS = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
]

# ================================================================
# SECTION 2: HELPER FUNCTIONS (PDF Section 12 Audit Trail)
# ================================================================
def log_activity(user_id, action, status="success", details=None):
    """PDF Section 12: Audit Trail - Records security and financial events"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        query = """
            INSERT INTO audit_logs 
            (user_id, action, status, ip_address, device_info, details, created_at) 
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        cursor.execute(query, (
            user_id, action, status, 
            request.remote_addr, 
            request.user_agent.string[:255], 
            json.dumps(details) if details else None, 
            datetime.datetime.now()
        ))
        conn.commit()
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"Audit Log Error: {e}")

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

def calculate_age(dob_str):
    """Compute age server-side for legal compliance"""
    if not dob_str: return 0
    try:
        birth_date = datetime.datetime.strptime(dob_str, '%Y-%m-%d').date()
        today = datetime.date.today()
        age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
        return max(age, 0)
    except: return 0


# ================================================================
# SECTION 3: AUTH CORE — LOGIN / LOGOUT (With Hardened Lockout)
# ================================================================
@auth.route('/login', methods=['GET', 'POST'])
def login():
    if is_logged_in():
        return redirect(url_for('auth.dashboard'))

    if request.method == 'POST':
        email = request.form.get('email', '').strip()
        password = request.form.get('password', '').strip()

        # Generic message para hindi malaman ng hacker kung tama ang email
        error_msg = "Invalid email or password."

        try:
            conn = get_db()
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT * FROM users WHERE email = %s AND is_active = 1", (email,))
            user = cursor.fetchone()
            cursor.close()
            conn.close()

            if user:
                # ✅ PDF SECTION 2: Hard Lockout (5 attempts)
                if user.get('failed_attempts', 0) >= 5:
                    log_activity(user['id'], "login_attempt", "locked", {"reason": "brute_force_protection"})
                    flash('Account locked. Please reset your password to unlock.', 'danger')
                    return render_template('login.html')

                if bcrypt.checkpw(password.encode('utf-8'), user['password'].encode('utf-8')):
                    conn = get_db()
                    cursor = conn.cursor()
                    cursor.execute("UPDATE users SET failed_attempts = 0, last_login = %s WHERE id = %s",
                                   (datetime.datetime.now(), user['id']))
                    conn.commit()
                    cursor.close()
                    conn.close()

                    # Prevent Session Fixation
                    session.clear()
                    session.permanent = 'remember' in request.form

                    session.update({
                        'logged_in': True,
                        'user_id': user['id'],
                        'user_name': user['full_name'],
                        'user_email': user['email'],
                        'role': user['role'],
                        'verified': user['id_verification_status']
                    })

                    log_activity(user['id'], "login", "success")
                    flash(f'Welcome back, {user["full_name"]}!', 'success')
                    return redirect(url_for('auth.dashboard'))
                else:
                    # Increment failed attempts record
                    conn = get_db()
                    cursor = conn.cursor()
                    cursor.execute("UPDATE users SET failed_attempts = failed_attempts + 1 WHERE id = %s", (user['id'],))
                    conn.commit()
                    cursor.close()
                    conn.close()
                    log_activity(user['id'], "login", "failed", {"reason": "incorrect_password"})
                    flash(error_msg, 'danger')
            else:
                flash(error_msg, 'danger')

        except Exception as e:
            flash("System busy. Please try again later.", 'danger')

    return render_template('login.html')

@auth.route('/logout', methods=['GET', 'POST'])
def logout():
    user_id = session.get('user_id')
    if user_id:
        log_activity('logout', 'User logged out successfully')
    session.clear()
    flash('You have been logged out successfully.', 'info')
    return redirect(url_for('auth.login'))

# ================================================================
# SECTION 4: REGISTRATION — ANTI-BYPASS VERIFICATION
# ================================================================
@auth.route('/register', methods=['GET', 'POST'])
def register():
    if is_logged_in(): return redirect(url_for('auth.dashboard'))

    if request.method == 'POST':
        email = request.form.get('email', '').strip()
        password = request.form.get('password')
        confirm = request.form.get('confirm_password')
        phone = request.form.get('contact_number', '').strip()

        if password != confirm:
            flash('Passwords do not match.', 'danger')
            return render_template('register.html', form_data=request.form)

        # ✅ SECURITY: Backend Age & Name Verification
        dob = request.form.get('dob', '').strip()
        age = calculate_age(dob)
        if age < 18:
            flash('Compliance Error: You must be at least 18 years old.', 'danger')
            return render_template('register.html', form_data=request.form)

        first_name = (request.form.get('first_name', '') or '').strip()
        last_name = (request.form.get('last_name', '') or '').strip()
        full_name = f"{first_name} {last_name}"

        session['reg_data'] = {
            'full_name': full_name,
            'email': email,
            'contact_number': phone,
            'dob': dob,
            'age': age,
            'password': bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8'),
            'terms_version': '1.0-SECURE',
            'terms_timestamp': datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            # Address and Work details
            'province': request.form.get('province'), 'city': request.form.get('city'),
            'barangay': request.form.get('barangay'), 'zip_code': request.form.get('zip_code'),
            'house_street': request.form.get('house_street'),
            'employment_type': request.form.get('employment_type'),
            'job_role': request.form.get('job_role'),
            'employer_business': request.form.get('employer_business'),
            'nature_of_work': request.form.get('nature_of_work'),
            'source_of_funds': request.form.get('source_of_funds'),
            'monthly_transactions': request.form.get('monthly_transactions')
        }

        # OTP Logic
        otp = str(random.randint(100000, 999999))
        session.update({'otp': otp, 'otp_expiry': (datetime.datetime.now() + datetime.timedelta(minutes=10)).isoformat(), 'otp_email': email})
        try:
            msg = Message('Your Secure OTP', recipients=[email])
            msg.body = f"Your verification code: {otp}"
            mail.send(msg)
            flash(f'OTP sent to {email}.', 'success')
        except: flash(f'Dev OTP: {otp}', 'warning')
        return redirect(url_for('auth.verify_otp'))

    return render_template('register.html', form_data={})

@auth.route('/verify-otp', methods=['GET', 'POST'])
def verify_otp():
    if 'reg_data' not in session: return redirect(url_for('auth.register'))
    if request.method == 'POST':
        entered_otp = ''.join([request.form.get(f'otp{i}', '') for i in range(1, 7)])
        if entered_otp == session.get('otp') and datetime.datetime.now() <= datetime.datetime.fromisoformat(session.get('otp_expiry')):
            session['otp_verified'] = True
            return redirect(url_for('auth.upload_id'))
        flash('Invalid or expired OTP.', 'danger')
    return render_template('verify_otp.html', email=session.get('otp_email', ''))

# 4.4 VALIDATE ID (GEMINI AI — IDENTITY CROSS-CHECK)
@auth.route('/validate-id-api', methods=['POST'])
def validate_id_api():
    if 'reg_data' not in session or not session.get('otp_verified'):
        return jsonify({'error': 'Unauthorized'}), 401

    gemini_key = os.environ.get('GEMINI_API_KEY')
    data = request.json or {}
    id_b64 = data.get('id_image')
    selfie_b64 = data.get('selfie_image')
    
    # ✅ SECURITY: Get the registered name to cross-check with the ID
    registered_name = session['reg_data'].get('full_name', 'Unknown')

    # ULTIMATE FINTECH PROMPT
    prompt = f"""
    Strictly verify identity for a Philippine Loan System. 
    IMAGE 1: Physical Government ID Card.
    IMAGE 2: Live Selfie.
    APPLICANT'S REGISTERED NAME: {registered_name}

    TASKS:
    1. NAME CHECK: Extract the name from IMAGE 1. Does it match "{registered_name}"? 
    2. BIOMETRIC CHECK: Does the face in IMAGE 2 match the portrait in IMAGE 1? 
    3. LIVENESS CHECK: Is IMAGE 2 a live person? Reject if screen photo or photocopy.
    4. ID VALIDITY: Is IMAGE 1 a real physical card (not a screen screenshot)?

    JSON Output Only:
    {{
      "valid_id": true/false,
      "name_match": true/false,
      "face_match": true/false,
      "action": "approve" or "reject",
      "overall_reason": "One sentence summary"
    }}
    OVERRIDE: If name_match or face_match is false, action MUST be "reject".
    """

    try:
        client = genai.Client(api_key=gemini_key)
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[
                types.Part.from_text(text=prompt),
                types.Part.from_bytes(data=_base64.b64decode(id_b64), mime_type='image/jpeg'),
                types.Part.from_bytes(data=_base64.b64decode(selfie_b64), mime_type='image/jpeg'),
            ]
        )
        result = json.loads(response.text.strip().replace('```json', '').replace('```', ''))
        
        # Manual safety check
        if result.get('name_match') is False or result.get('face_match') is False:
            result['action'] = 'reject'
            result['overall_reason'] = "ID name or face mismatch with registration data."

        # ✅ CRITICAL: Store in session for the final upload step (Anti-Bypass)
        session['gemini_approved'] = (result['action'] == 'approve')
        session['gemini_result'] = result['action']
        return jsonify(result)
    except:
        session['gemini_result'] = 'review'
        session['gemini_approved'] = False
        return jsonify({'action': 'review', 'overall_reason': 'AI check failed. Manual review required.'})

# 4.5 UPLOAD ID — THE GUARD (Final Save)
@auth.route('/upload-id', methods=['GET', 'POST'])
def upload_id():
    if 'reg_data' not in session or not session.get('otp_verified'):
        return redirect(url_for('auth.register'))

    if request.method == 'POST':
        id_file = request.files.get('valid_id')
        selfie_b64 = request.form.get('selfie_base64', '')

        # ✅ HARD SECURITY CHECK: Only trust the session result (cannot be faked by user)
        gemini_result = session.get('gemini_result', 'reject')
        gemini_approved = session.get('gemini_approved', False)

        if gemini_result not in ('approve', 'review'):
            flash('ID Verification rejected. Please try again with clear documents.', 'danger')
            return render_template('upload_id.html')

        verification_status = 'verified' if (gemini_result == 'approve' and gemini_approved) else 'pending'

        # File Handling
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        id_fn = secure_filename(f"id_{uuid.uuid4().hex}_{id_file.filename}")
        id_file.save(os.path.join(UPLOAD_FOLDER, id_fn))
        selfie_data = _base64.b64decode(selfie_b64.split(',')[-1])
        selfie_fn = secure_filename(f"selfie_{uuid.uuid4().hex}.jpg")
        with open(os.path.join(UPLOAD_FOLDER, selfie_fn), 'wb') as f: f.write(selfie_data)

        reg = session['reg_data']
        try:
            conn = get_db(); cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO users
                    (full_name, email, date_of_birth, age, password, contact_number,
                     role, id_document_path, selfie_path, id_verification_status, 
                     terms_version, terms_accepted_at, failed_attempts, created_at, is_active)
                VALUES (%s,%s,%s,%s,%s,%s,'borrower',%s,%s,%s,%s,%s,0,%s,1)
            """, (
                reg['full_name'], reg['email'], reg['dob'], reg['age'],
                reg['password'], reg['contact_number'], id_fn, selfie_fn, 
                verification_status, reg['terms_version'], reg['terms_timestamp'],
                datetime.datetime.now()
            ))
            conn.commit(); cursor.close(); conn.close()

            log_activity(None, "user_registration", "success", {"email": reg['email']})
            session.clear()
            flash('Success! Account created. Verification Status: ' + verification_status, 'success')
            return redirect(url_for('auth.login'))
        except Exception as e: flash(f'Database error: {str(e)}', 'danger')

    return render_template('upload_id.html')


# ================================================================
# SECTION 5: PASSWORD RESET FLOW
# ================================================================
@auth.route('/forgot-password', methods=['GET', 'POST'])
def forgot_password():
    if request.method == 'POST':
        email = request.form.get('email', '').strip()
        try:
            conn = get_db(); cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
            user = cursor.fetchone()
            cursor.close(); conn.close()
            if user:
                otp = str(random.randint(100000, 999999))
                session.update({'reset_otp': otp, 'reset_email': email, 'reset_expiry': (datetime.datetime.now() + datetime.timedelta(minutes=15)).isoformat()})
                msg = Message('Password Reset', recipients=[email])
                msg.body = f"Reset code: {otp}"
                mail.send(msg)
            flash('If that email exists, a reset code has been sent.', 'info')
            return redirect(url_for('auth.reset_password'))
        except: flash("System error.", "danger")
    return render_template('forgot_password.html')

@auth.route('/reset-password', methods=['GET', 'POST'])
def reset_password():
    if 'reset_email' not in session: return redirect(url_for('auth.forgot_password'))
    if request.method == 'POST':
        entered_otp = request.form.get('otp', '').strip()
        new_pass = request.form.get('new_password', '').strip()
        if entered_otp == session.get('reset_otp') and datetime.datetime.now() <= datetime.datetime.fromisoformat(session.get('reset_expiry', '')):
            hashed = bcrypt.hashpw(new_pass.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            conn = get_db(); cursor = conn.cursor()
            # ✅ Success: Unlocks account automatically (failed_attempts = 0)
            cursor.execute("UPDATE users SET password = %s, failed_attempts = 0 WHERE email = %s", (hashed, session['reset_email']))
            conn.commit(); cursor.close(); conn.close()
            log_activity(None, "password_reset", "success", {"email": session['reset_email']})
            session.clear()
            flash('Password reset successful! Account unlocked.', 'success')
            return redirect(url_for('auth.login'))
        flash('Invalid or expired code.', 'danger')
    return render_template('reset_password.html')


# ================================================================
# SECTION 6/7: DASHBOARD & API
# ================================================================
@auth.route('/dashboard')
@login_required
def dashboard():
    role = session.get('role', 'borrower')
    if role in ('super_admin', 'admin'): return redirect(url_for('super_admin.admin_dashboard'))
    elif role == 'loan_officer': return redirect(url_for('officer.officer_dashboard')) 
    elif role == 'auditor': return redirect(url_for('super_admin.auditor_dashboard'))
    return redirect(url_for('borrower.borrower_dashboard'))

@auth.route('/api/check-email', methods=['POST'])
def check_email():
    email = request.json.get('email', '')
    try:
        conn = get_db(); cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
        exists = cursor.fetchone() is not None
        cursor.close(); conn.close()
        return jsonify({'exists': exists})
    except: return jsonify({'exists': False})