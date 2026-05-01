# ================================================================
# LOGIN.PY — FIXED VERSION (ONLY ERRORS FIXED)
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

# Gemini AI model - FIXED: changed to stable version
GEMINI_MODEL = 'gemini-1.5-flash'

# ================================================================
# SECTION 2: HELPER FUNCTIONS
# ================================================================
def log_activity(user_id, action, status="success", details=None):
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
    if not dob_str: return 0
    try:
        birth_date = datetime.datetime.strptime(dob_str, '%Y-%m-%d').date()
        today = datetime.date.today()
        age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
        return max(age, 0)
    except: return 0

# ================================================================
# SECTION 3: AUTH CORE
# ================================================================
@auth.route('/login', methods=['GET', 'POST'])
def login():
    if is_logged_in():
        return redirect(url_for('auth.dashboard'))

    if request.method == 'POST':
        email = request.form.get('email', '').strip()
        password = request.form.get('password', '').strip()
        error_msg = "Invalid email or password."

        try:
            conn = get_db()
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT * FROM users WHERE email = %s AND is_active = 1", (email,))
            user = cursor.fetchone()
            cursor.close(); conn.close()

            if user:
                if user.get('failed_attempts', 0) >= 5:
                    log_activity(user['id'], "login_attempt", "locked", {"reason": "brute_force"})
                    flash('Account locked. Please reset your password to unlock.', 'danger')
                    return render_template('login.html')

                if bcrypt.checkpw(password.encode('utf-8'), user['password'].encode('utf-8')):
                    conn = get_db(); cursor = conn.cursor()
                    cursor.execute("UPDATE users SET failed_attempts = 0, last_login = %s WHERE id = %s",
                                   (datetime.datetime.now(), user['id']))
                    conn.commit(); cursor.close(); conn.close()

                    if user['id_verification_status'] == 'pending_otp':
                        session['otp_email'] = email
                        session['reg_data'] = {'email': email, 'full_name': user['full_name']} 
                        flash('Please verify your email to continue.', 'warning')
                        return redirect(url_for('auth.verify_otp'))
                    
                    elif user['id_verification_status'] == 'pending_id':
                        session['otp_verified'] = True 
                        session['otp_email'] = email
                        session['reg_data'] = {'email': email, 'full_name': user['full_name']}
                        flash('Complete your registration by uploading an ID.', 'info')
                        return redirect(url_for('auth.upload_id'))

                    session.clear()
                    session.update({
                        'logged_in': True,
                        'user_id': user['id'],
                        'user_name': user['full_name'],
                        'user_email': user['email'],
                        'role': user['role']
                    })
                    log_activity(user['id'], "login", "success")
                    flash(f'Welcome back, {user["full_name"]}!', 'success')
                    return redirect(url_for('auth.dashboard'))
                else:
                    conn = get_db(); cursor = conn.cursor()
                    cursor.execute("UPDATE users SET failed_attempts = failed_attempts + 1 WHERE id = %s", (user['id'],))
                    conn.commit(); cursor.close(); conn.close()
                    log_activity(user['id'], "login", "failed", {"reason": "incorrect_password"})
                    flash(error_msg, 'danger')
            else:
                flash(error_msg, 'danger')
        except:
            flash("System busy. Please try again later.", 'danger')

    return render_template('login.html')

@auth.route('/logout', methods=['GET', 'POST'])
def logout():
    user_id = session.get('user_id')
    if user_id:
        log_activity(user_id, 'logout', 'success', {"message": "User logged out"})
    session.clear()
    flash('You have been logged out successfully.', 'info')
    return redirect(url_for('auth.login'))

# ================================================================
# SECTION 4: REGISTRATION
# ================================================================
@auth.route('/register', methods=['GET', 'POST'])
def register():
    if is_logged_in(): return redirect(url_for('auth.dashboard'))

    if request.method == 'POST':
        email = request.form.get('email', '').strip()
        password = request.form.get('password', '')
        confirm = request.form.get('confirm_password', '')
        contact = request.form.get('contact_number', '').strip()
        dob = request.form.get('dob', '').strip()
        age = calculate_age(dob)
        
        fn = request.form.get('first_name', '').strip()
        mn = request.form.get('middle_name', '').strip()
        ln = request.form.get('last_name', '').strip()
        full_name = f"{fn} {mn} {ln}".replace('  ', ' ').strip()

        province = request.form.get('province', '').strip()
        city = request.form.get('city', '').strip()
        barangay = request.form.get('barangay', '').strip()
        zip_code = request.form.get('zip_code', '').strip()
        house_street = request.form.get('house_street', '').strip()

        emp_type = request.form.get('employment_type', 'Unemployed').strip()
        job_role = request.form.get('job_role', '').strip()
        employer = request.form.get('employer_business', '').strip()
        nature_work = request.form.get('nature_of_work', '').strip()
        funds = request.form.get('source_of_funds', '').strip()
        transactions = request.form.get('monthly_transactions', '0').strip()
        birth_country = request.form.get('birth_country', '').strip()
        birth_province = request.form.get('birth_province_ph') or request.form.get('birth_province_intl', '')
        birth_city = request.form.get('birth_city_ph') or request.form.get('birth_city_intl', '')

        if not password or len(password) < 8 or password != confirm:
            flash('Check your password details.', 'danger')
            return render_template('register.html', form_data=request.form, active_step=3)

        hashed_pw = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        try:
            conn = get_db(); cursor = conn.cursor()
            query = """
                INSERT INTO users 
                (full_name, first_name, middle_name, last_name, email, password, 
 contact_number, date_of_birth, age, 
 gender, nationality, civil_status,
 birth_country, birth_province, birth_city,
 province, city, barangay, zip_code, house_street,
                 employment_type, job_role, employer_business, nature_of_work, 
                 source_of_funds, monthly_transactions,
                 role, id_verification_status, is_active, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'borrower', 'pending_otp', 1, %s)
            """
            
            cursor.execute(query, (
    full_name, fn, mn, ln, email, hashed_pw, 
    contact, dob, age, 
    request.form.get('gender', ''), 
    request.form.get('nationality', ''), 
    request.form.get('civil_status', ''),
    birth_country, birth_province, birth_city,
    province, city, barangay, zip_code, house_street,
                emp_type, job_role, employer, nature_work, 
                funds, transactions,
                datetime.datetime.now()
            ))
            conn.commit(); cursor.close(); conn.close()
            
            otp = str(random.randint(100000, 999999))
<<<<<<< HEAD
            session.update({'otp': otp, 'otp_email': email, 'reg_data': {'email': email, 'full_name': full_name}})
=======
            expiry_time = datetime.datetime.now() + datetime.timedelta(minutes=5)
            session.update({
                'otp': otp,
                'otp_email': email,
                'otp_expiry': expiry_time.timestamp()
            })
>>>>>>> 9ed63ea03f2b21f3f1a23269242e8092df93e57e
            try:
                msg = Message('Verification Code', recipients=[email])
                msg.body = f"Your OTP is: {otp}"
                mail.send(msg)
                flash('OTP sent to your email.', 'success')
            except:
                flash("OTP failed to send, but account created.", "warning")

            return redirect(url_for('auth.verify_otp'))

        except Exception as e:
            flash(f"Database Error: {str(e)}", "danger")
            return render_template('register.html', form_data=request.form, active_step=3)

    session.pop('otp', None)
    session.pop('otp_email', None)
    session.pop('otp_verified', None)
    session.pop('reg_data', None) 
    return render_template('register.html', form_data={}, active_step=0)

@auth.route('/verify-otp', methods=['GET', 'POST'])
def verify_otp():
    if 'otp_email' not in session: 
        return redirect(url_for('auth.login'))
    
    email = session.get('otp_email')

    if request.method == 'POST':
        entered_otp = ''.join([request.form.get(f'otp{i}', '') for i in range(1, 7)])
        otp_expiry = session.get('otp_expiry')
        current_time = datetime.datetime.now().timestamp()

        if otp_expiry and current_time > otp_expiry:
            flash('This OTP has already expired. Please request a new one.', 'danger')
            session.pop('otp', None) 
            return render_template('verify_otp.html', email=email)

        if entered_otp == session.get('otp'):
            try:
                conn = get_db(); cursor = conn.cursor()
                cursor.execute("UPDATE users SET id_verification_status = 'pending_id' WHERE email = %s", (email,))
                conn.commit(); cursor.close(); conn.close()
                session.pop('otp', None)
                session.pop('otp_expiry', None)
                session['otp_verified'] = True
                flash('Email verified! Proceed to ID upload.', 'success')
                return redirect(url_for('auth.upload_id'))
            except: flash("Database error.", "danger")
        else:
            flash('Invalid OTP code.', 'danger')

    return render_template('verify_otp.html', email=email)  

@auth.route('/resend-otp', methods=['POST'])
def resend_otp():
    email = session.get('otp_email')
    if not email:
        return jsonify({'success': False, 'message': 'Session expired. Please register again.'}), 400

<<<<<<< HEAD
    otp = str(random.randint(100000, 999999)) # FIXED Indentation
=======
    # Generate new OTP
    otp = str(random.randint(100000, 999999))

>>>>>>> 9ed63ea03f2b21f3f1a23269242e8092df93e57e
    expiry_time = datetime.datetime.now() + datetime.timedelta(minutes=5)

    session.update({
        'otp': otp, 
        'otp_email': email,
        'otp_expiry': expiry_time.timestamp() 
    })

    try:
        msg = Message('Your NEW Verification Code', recipients=[email])
        msg.body = f"Your new OTP is: {otp}. Use this to verify your account."
        mail.send(msg)
        return jsonify({'success': True, 'message': 'New OTP sent to your email.'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@auth.route('/validate-id-api', methods=['POST'])
def validate_id_api():
    if 'reg_data' not in session or not session.get('otp_verified'):
        return jsonify({'error': 'Unauthorized'}), 401

    gemini_key = 'AIzaSyBAL665tU2XxTIkwmFPO7zcMJAQnlwYfQ4'
    data = request.json or {}
    id_b64 = data.get('id_image')
    selfie_b64 = data.get('selfie_image')
    registered_name = session['reg_data'].get('full_name', 'Unknown')

<<<<<<< HEAD
=======
  
>>>>>>> 9ed63ea03f2b21f3f1a23269242e8092df93e57e
    prompt = f"""
    You are an expert identity verifier for a Philippine Fintech system.
    APPLICANT'S REGISTERED NAME: {registered_name}
<<<<<<< HEAD
    TASKS:
    1. NAME CHECK: Extract the name from IMAGE 1. Does it match "{registered_name}"? 
    2. BIOMETRIC CHECK: Does the face in IMAGE 2 match the portrait in IMAGE 1? 
    3. LIVENESS CHECK: Is IMAGE 2 a live person?
=======
    IMAGE 1: Government ID Card (Check for PhilSys, Driver's License, etc.)
    IMAGE 2: Live Selfie
    
    TASKS:
    1. NAME CHECK: Compare the name on IMAGE 1 with "{registered_name}".
       - Accept if they match exactly.
       - Accept if one has a Middle Initial and the other has a Full Middle Name.
       - Note: Philippine IDs like PhilSys often use 'Last Name, Given Name, Middle Name' format. Be smart in matching.
    2. BIOMETRIC: Does the face in IMAGE 2 match the ID portrait in IMAGE 1?
    3. LIVENESS: Is IMAGE 2 a real person? (Reject if it's a photo of a screen or paper).

    DECISION LOGIC:
    - ACTION "approve": If name and face match 90%-100%.
    - ACTION "review": If the face matches but the name has a slight typo, or if the ID is a bit blurry but looks authentic.
    - ACTION "reject": Only if the names are completely different people or the face definitely doesn't match.

>>>>>>> 9ed63ea03f2b21f3f1a23269242e8092df93e57e
    JSON Output Only:
    {{
      "valid_id": true/false,
      "name_match": true/false,
      "face_match": true/false,
<<<<<<< HEAD
      "action": "approve" or "reject",
      "overall_reason": "Summary"
=======
      "action": "approve", "reject", or "review",
      "overall_reason": "One sentence summary of your decision"
>>>>>>> 9ed63ea03f2b21f3f1a23269242e8092df93e57e
    }}
    """
    try:
        client = genai.Client(api_key=gemini_key)
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=[
                types.Part.from_text(text=prompt),
                types.Part.from_bytes(data=_base64.b64decode(id_b64), mime_type='image/jpeg'),
                types.Part.from_bytes(data=_base64.b64decode(selfie_b64), mime_type='image/jpeg'),
            ]
        )
        result = json.loads(response.text.strip().replace('```json', '').replace('```', ''))
        if result.get('name_match') is False or result.get('face_match') is False:
            result['action'] = 'reject'
<<<<<<< HEAD
=======
            result['overall_reason'] = "ID name or face mismatch with registration data."

     
>>>>>>> 9ed63ea03f2b21f3f1a23269242e8092df93e57e
        session['gemini_approved'] = (result['action'] == 'approve')
        return jsonify(result)
<<<<<<< HEAD
    except:
        return jsonify({'action': 'review', 'overall_reason': 'AI check failed. Manual review required.'})
=======
    except Exception as e:
        print(f"GEMINI ERROR: {e}")  
        session['gemini_result'] = 'review'
        session['gemini_approved'] = False
        return jsonify({'action': 'review', 'overall_reason': f'AI check failed: {str(e)}'})
>>>>>>> 9ed63ea03f2b21f3f1a23269242e8092df93e57e

@auth.route('/upload-id', methods=['GET', 'POST'])
def upload_id():
<<<<<<< HEAD
=======
   
>>>>>>> 9ed63ea03f2b21f3f1a23269242e8092df93e57e
    if not session.get('otp_verified'):
        return redirect(url_for('auth.login'))

    # ✅ 
    if 'reg_data' not in session:
        email = session.get('otp_email', '')
        try:
            conn = get_db(); cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT full_name, email FROM users WHERE email = %s", (email,))
            user = cursor.fetchone()
            cursor.close(); conn.close()
            if user:
                session['reg_data'] = {
                    'email': user['email'],
                    'full_name': user['full_name']
                }
        except:
            pass

    if request.method == 'POST':
        id_file = request.files.get('valid_id')
        selfie_b64 = request.form.get('selfie_base64', '')
<<<<<<< HEAD
=======
        id_number = request.form.get('id_number', '').strip()

>>>>>>> 9ed63ea03f2b21f3f1a23269242e8092df93e57e
        if not id_file or not selfie_b64:
            flash("Please provide both ID and Selfie.", "warning")
            return render_template('upload_id.html')

        try:
            os.makedirs(UPLOAD_FOLDER, exist_ok=True)
            id_fn = secure_filename(f"id_{uuid.uuid4().hex}_{id_file.filename}")
            selfie_fn = secure_filename(f"selfie_{uuid.uuid4().hex}.jpg")
            id_file.save(os.path.join(UPLOAD_FOLDER, id_fn))
            selfie_data = _base64.b64decode(selfie_b64.split(',')[-1])
            with open(os.path.join(UPLOAD_FOLDER, selfie_fn), 'wb') as f:
                f.write(selfie_data)

<<<<<<< HEAD
            conn = get_db(); cursor = conn.cursor()
            target_email = session.get('otp_email') or session.get('reg_data', {}).get('email')
            cursor.execute("UPDATE users SET id_document_path = %s, selfie_path = %s, id_verification_status = 'pending' WHERE email = %s", (id_fn, selfie_fn, target_email))
=======
        
            target_email = session.get('otp_email') or session.get('reg_data', {}).get('email')

            gemini_result = session.get('gemini_result', 'pending')
            # Map: approve = verified, reject = rejected, review/pending = pending
            if gemini_result == 'approve':
                final_status = 'verified'
            elif gemini_result == 'reject':
                final_status = 'rejected'
            else:
                final_status = 'pending'

            # 4. ONE execute lang
            conn = get_db(); cursor = conn.cursor()
            query = """
            UPDATE users 
            SET id_document_path = %s, selfie_path = %s, 
            id_verification_status = %s, id_number = %s
            WHERE email = %s
            """
            cursor.execute(query, (id_fn, selfie_fn, final_status, id_number, target_email))
>>>>>>> 9ed63ea03f2b21f3f1a23269242e8092df93e57e
            conn.commit(); cursor.close(); conn.close()
            session.clear()
            flash('Success! Verification documents submitted for review.', 'success')
            return redirect(url_for('auth.login'))
        except Exception as e:
            flash(f"Database error: {str(e)}", "danger")

    return render_template('upload_id.html')

<<<<<<< HEAD
=======
# ================================================================
# SECTION 5: PASSWORD RESET FLOW
# ================================================================
>>>>>>> 9ed63ea03f2b21f3f1a23269242e8092df93e57e
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
            cursor.execute("UPDATE users SET password = %s, failed_attempts = 0 WHERE email = %s", (hashed, session['reset_email']))
            conn.commit(); cursor.close(); conn.close()
            session.clear()
            flash('Password reset successful! Account unlocked.', 'success')
            return redirect(url_for('auth.login'))
        flash('Invalid or expired code.', 'danger')
    return render_template('reset_password.html')

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