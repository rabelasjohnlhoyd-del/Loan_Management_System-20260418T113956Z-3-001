# ================================================================
# LOGIN.PY — ULTIMATE SECURE FINTECH VERSION (Full Update)
# ================================================================

# ================================================================
# SECTION 1: IMPORTS & CONFIGURATION
# ================================================================
from flask import Blueprint, render_template, request, redirect, url_for, session, flash, jsonify, make_response
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

def no_cache(response):
    """
    Adds strict no-cache headers so pressing the browser back/forward
    arrow NEVER shows a cached (logged-in) page after logout.
    """
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0'
    response.headers['Pragma']        = 'no-cache'
    response.headers['Expires']       = '-1'
    return response

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not is_logged_in():
            flash('Please log in to access this page.', 'warning')
            response = make_response(redirect(url_for('auth.login')))
            return no_cache(response)
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
        error_msg = "Invalid email or password."

        try:
            conn = get_db()
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT * FROM users WHERE email = %s AND is_active = 1", (email,))
            user = cursor.fetchone()
            cursor.close()
            conn.close()

            if user:
                # 1. Hard Lockout Check
                if user.get('failed_attempts', 0) >= 5:
                    log_activity(user['id'], "login_attempt", "locked", {"reason": "brute_force"})
                    flash('Account locked. Please reset your password to unlock.', 'danger')
                    return render_template('login.html')

                # 2. Verify Password
                if bcrypt.checkpw(password.encode('utf-8'), user['password'].encode('utf-8')):
                    
                    # ✅ SUCCESS: Reset failed attempts
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

                    # --- NORMAL LOGIN ---
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
                    # ❌ WRONG PASSWORD
                    conn = get_db(); cursor = conn.cursor()
                    cursor.execute("UPDATE users SET failed_attempts = failed_attempts + 1 WHERE id = %s", (user['id'],))
                    conn.commit(); cursor.close(); conn.close()
                    log_activity(user['id'], "login", "failed", {"reason": "incorrect_password"})
                    flash(error_msg, 'danger')
            else:
                flash(error_msg, 'danger')
        except:
            flash("System busy. Please try again later.", 'danger')

    response = make_response(render_template('login.html'))
    return no_cache(response)

@auth.route('/logout', methods=['GET', 'POST'])
def logout():
    user_id = session.get('user_id')
    if user_id:
        
        log_activity(user_id, 'logout', 'success', {"message": "User logged out"})
    session.clear()
    flash('You have been logged out successfully.', 'info')
    response = make_response(redirect(url_for('auth.login')))
    return no_cache(response)




# ================================================================
# ACCOUNT UNLOCK REQUEST
# ================================================================
@auth.route('/request-unlock', methods=['POST'])
def request_unlock():
    email = request.form.get('email', '').strip()

    if not email:
        flash('Please enter your email address to request an unlock.', 'warning')
        return redirect(url_for('auth.login'))

    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)

        # Check if user exists and is actually locked
        cursor.execute("""
            SELECT id, full_name, failed_attempts
            FROM users WHERE email = %s AND role = 'borrower'
        """, (email,))
        user = cursor.fetchone()

        if not user or user['failed_attempts'] < 5:
            # Vague response para hindi ma-enumerate ang accounts
            flash('If your account is locked, a request has been sent to our team.', 'info')
            cursor.close(); conn.close()
            return redirect(url_for('auth.login'))

        # Check kung may existing pending request na para hindi mag-spam
        cursor.execute("""
            SELECT id FROM unlock_requests
            WHERE user_id = %s AND status = 'pending'
        """, (user['id'],))
        existing = cursor.fetchone()

        if existing:
            flash('You already have a pending unlock request. Our team will contact you shortly.', 'info')
            cursor.close(); conn.close()
            return redirect(url_for('auth.login'))

        # Insert unlock request
        cursor.execute("""
            INSERT INTO unlock_requests (user_id, requested_at, status)
            VALUES (%s, NOW(), 'pending')
        """, (user['id'],))
        conn.commit()

        log_activity(user['id'], 'request_unlock', 'success',
                     {'message': 'Borrower requested account unlock'})

        cursor.close(); conn.close()
        flash('Unlock request sent! Our team will review and contact you within 24 hours.', 'success')

    except Exception as e:
        flash('System error. Please try again later.', 'danger')
        print(f"Unlock Request Error: {e}")

    return redirect(url_for('auth.login'))

# ================================================================
# SECTION 4: REGISTRATION — ANTI-BYPASS VERIFICATION
# ================================================================
@auth.route('/register', methods=['GET', 'POST'])
def register():
    if is_logged_in(): return redirect(url_for('auth.dashboard'))

    if request.method == 'POST':
        # --- 1. BASIC INFO ---
        email = request.form.get('email', '').strip()
        password = request.form.get('password', '')
        confirm = request.form.get('confirm_password', '')
        contact = request.form.get('contact_number', '').strip()
        dob = request.form.get('dob', '').strip()
        age = calculate_age(dob)
        
        # Names
        fn = request.form.get('first_name', '').strip()
        mn = request.form.get('middle_name', '').strip()
        ln = request.form.get('last_name', '').strip()
        full_name = f"{fn} {mn} {ln}".replace('  ', ' ').strip()

        # --- 2. ADDRESS INFO ---
        province = request.form.get('province', '').strip()
        city = request.form.get('city', '').strip()
        barangay = request.form.get('barangay', '').strip()
        zip_code = request.form.get('zip_code', '').strip()
        house_street = request.form.get('house_street', '').strip()

        # --- 3. EMPLOYMENT/FINANCIAL ---
        emp_type = request.form.get('employment_type', 'Unemployed').strip()
        job_role = request.form.get('job_role', '').strip()
        employer = request.form.get('employer_business', '').strip()
        nature_work = request.form.get('nature_of_work', '').strip()
        funds = request.form.get('source_of_funds', '').strip()
        transactions = request.form.get('monthly_transactions', '0').strip()
        birth_country = request.form.get('birth_country', '').strip()
        birth_province = request.form.get('birth_province_ph') or request.form.get('birth_province_intl', '')
        birth_city = request.form.get('birth_city_ph') or request.form.get('birth_city_intl', '')

        # Security Check
        if not password or len(password) < 8 or password != confirm:
            flash('Check your password details.', 'danger')
            return render_template('register.html', form_data=request.form, active_step=3)

        hashed_pw = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        conn = None
        cursor = None
        try:
            conn = get_db()
            cursor = conn.cursor()
            
            # --- 4. THE INSERT QUERY ---
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
            
         
            new_user_id = cursor.lastrowid
            
            
            cursor.execute("INSERT INTO borrower_profiles (user_id) VALUES (%s)", (new_user_id,))
            default_wallets = [
            ('gcash',    'GC-' + str(new_user_id).zfill(10), 50000.00),
            ('maya',     'MY-' + str(new_user_id).zfill(10), 50000.00),
            ('bdo',      'BD-' + str(new_user_id).zfill(10), 50000.00),
            ('bpi',      'BP-' + str(new_user_id).zfill(10), 50000.00),
            ('landbank', 'LB-' + str(new_user_id).zfill(10), 50000.00),
            ('visa',     'VS-' + str(new_user_id).zfill(10), 50000.00),
            ]
            cursor.executemany("""
            INSERT INTO dummy_wallets (user_id, method, account_number, balance)
            VALUES (%s, %s, %s, %s)
            """, [(new_user_id, m, acct, bal) for m, acct, bal in default_wallets])
            conn.commit() 
            
            
            try:
                from Loan_Management_System2.Borrower.borrower import recalculate_borrower_metrics
                recalculate_borrower_metrics(new_user_id)
            except Exception as e:
                print(f"Metrics Sync Error during Registration: {e}")
            
            # --- 6. OTP SENDING ---
            otp = str(random.randint(100000, 999999))
            expiry_time = datetime.datetime.now() + datetime.timedelta(minutes=5)
            session.update({
                'otp': otp,
                'otp_email': email,
                'otp_expiry': expiry_time.timestamp()
            })
            
            try:
                msg = Message('Verification Code', recipients=[email])
                msg.body = f"Your OTP is: {otp}"
                mail.send(msg)
                flash('Account created! Please verify your email.', 'success')
            except:
                flash("Account created, but OTP failed to send. Please try logging in to resend.", "warning")

            return redirect(url_for('auth.verify_otp'))

        except Exception as e:
            if conn: conn.rollback()
            print(f"REGISTRATION ERROR: {str(e)}")
            flash(f"Registration failed: {str(e)}", "danger")
            return render_template('register.html', form_data=request.form, active_step=3)
        finally:
            if cursor: cursor.close()
            if conn: conn.close()

    # Reset session for fresh registration
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

        # 2. CHECK EXPIRATION FIRST
        if otp_expiry and current_time > otp_expiry:
            flash('This OTP has already expired. Please request a new one.', 'danger')
            
            session.pop('otp', None) 
            return render_template('verify_otp.html', email=email)

        # 3. CHECK IF MATCH
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
            except Exception as e:
                flash("Database error.", "danger")
        else:
            flash('Invalid OTP code.', 'danger')

    return render_template('verify_otp.html', email=email)  

@auth.route('/resend-otp', methods=['POST'])
def resend_otp():
    email = session.get('otp_email')
    if not email:
        return jsonify({'success': False, 'message': 'Session expired. Please register again.'}), 400

    # Generate new OTP
    otp = str(random.randint(100000, 999999))

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


# 4.4 VALIDATE ID (GEMINI AI — IDENTITY CROSS-CHECK)
@auth.route('/validate-id-api', methods=['POST'])
def validate_id_api():
    if 'reg_data' not in session or not session.get('otp_verified'):
        return jsonify({'error': 'Unauthorized'}), 401

    gemini_key = ''
    data = request.json or {}
    id_b64 = data.get('id_image')
    selfie_b64 = data.get('selfie_image')
    id_type = data.get('id_type', 'Unknown')
    
    registered_name = session['reg_data'].get('full_name', 'Unknown')

    prompt = f"""
    You are a STRICT identity verification officer for a Philippine Fintech Loan System.
    Your job is to REJECT suspicious submissions. When in doubt, REJECT.

    APPLICANT'S REGISTERED NAME: "{registered_name}"
    DECLARED ID TYPE: "{id_type}"

    IMAGE 1: Physical Government ID Card
    IMAGE 2: Live Selfie of the applicant

    STRICT VERIFICATION RULES:

    RULE 1 — ID TYPE MATCH (CRITICAL):
    - The ID in IMAGE 1 MUST match the declared type: "{id_type}"
    - If the applicant declared "National ID (PhilSys)" but uploaded a Passport, Driver's License, or any other ID → AUTOMATIC REJECT
    - Check for official Philippine government ID markings, logos, and format
    - If you cannot confidently identify the ID type → REJECT

    RULE 2 — NAME MATCH (CRITICAL):
    - Extract the FULL NAME from IMAGE 1
    - Compare with registered name: "{registered_name}"
    - Accept ONLY if names match at least 95% (minor middle name abbreviation is okay)
    - Any significant name difference → REJECT
    - If name on ID is unreadable or blurry → REJECT

    RULE 3 — FACE MATCH (CRITICAL):
    - The face in IMAGE 2 MUST clearly match the portrait in IMAGE 1
    - If IMAGE 2 is blurry, dark, or face is not clearly visible → REJECT
    - If the person in IMAGE 2 looks different from IMAGE 1 → REJECT
    - If IMAGE 2 is a photo of a screen, printed paper, or photo of a photo → REJECT
    - Minimum face clarity required: face must be well-lit and clearly visible

    RULE 4 — ID AUTHENTICITY:
    - IMAGE 1 must be a PHYSICAL card, not a screenshot or photocopy
    - ID must not be expired, damaged, or tampered
    - If ID appears fake or digitally altered → REJECT

    RULE 5 — SELFIE LIVENESS:
    - IMAGE 2 must be a LIVE photo, not a printed photo or screen capture
    - Person must be looking at camera with neutral expression
    - Background must be real environment, not suspicious
    - If selfie quality is too poor to verify identity → REJECT

    STRICT DECISION RULES:
    - "approve": ALL 5 rules pass with HIGH confidence (90%+)
    - "review": Minor issues only (slight blur but still readable, minor name abbreviation)
    - "reject": ANY critical rule fails — wrong ID type, name mismatch, face mismatch, fake ID, blurry selfie

    IMPORTANT: Be STRICT. It is better to reject a legitimate user than to approve a fraudulent one.

    Respond in JSON only — no other text:
    {{
      "valid_id": true/false,
      "id_type_match": true/false,
      "name_match": true/false,
      "face_match": true/false,
      "liveness_pass": true/false,
      "id_authentic": true/false,
      "confidence_score": 0-100,
      "extracted_id_number": "exact ID number extracted from the card, or null if unreadable",
      "action": "approve" or "review" or "reject",
      "rejection_reasons": ["reason1", "reason2"],
      "overall_reason": "One sentence summary"
    }}
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
        
        # ✅ HARD RULES — override AI kung may critical failure
        rejection_reasons = []

        if not result.get('id_type_match'):
            rejection_reasons.append("ID type does not match declared document type.")

        if not result.get('name_match'):
            rejection_reasons.append("Name on ID does not match registered name.")

        if not result.get('face_match'):
            rejection_reasons.append("Face in selfie does not match ID portrait.")

        if not result.get('liveness_pass'):
            rejection_reasons.append("Selfie failed liveness check — use a live photo.")

        if not result.get('id_authentic'):
            rejection_reasons.append("ID appears to be invalid, fake, or a screenshot.")

        if result.get('confidence_score', 0) < 85:
            rejection_reasons.append(f"Confidence score too low: {result.get('confidence_score')}%")

        if rejection_reasons:
            result['action'] = 'reject'
            result['rejection_reasons'] = rejection_reasons
            result['overall_reason'] = " | ".join(rejection_reasons)

        session['gemini_approved'] = (result['action'] == 'approve')
        session['gemini_result'] = result['action']
     
        session['extracted_id_number'] = result.get('extracted_id_number', None)
        return jsonify(result)

    except Exception as e:
        print(f"GEMINI ERROR: {e}")
        session['gemini_result'] = 'review'
        session['gemini_approved'] = False
        return jsonify({'action': 'review', 'overall_reason': f'AI check failed: {str(e)}'})
# 4.5 UPLOAD ID — THE GUARD (Final Save)
# 4.5 UPLOAD ID — THE GUARD (Final Save)
# ================================================================
# 4.5 UPLOAD ID — THE GUARD (Final Save)
# ================================================================
@auth.route('/upload-id', methods=['GET', 'POST'])
def upload_id():
   
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

       
        id_number = session.get('extracted_id_number', '') or ''

        if not id_file or not selfie_b64:
            flash("Please provide both ID and Selfie.", "warning")
            return render_template('upload_id.html')

     
        if not id_number:
            flash("Could not extract ID number from your ID. Please upload a clearer photo.", "danger")
            return render_template('upload_id.html')

    
        if id_number:
            conn = get_db(); cursor = conn.cursor()
            cursor.execute("SELECT id FROM users WHERE id_number = %s", (id_number,))
            if cursor.fetchone():
                cursor.close(); conn.close()
                flash("This ID number is already registered. Please use a different ID.", "danger")
                return render_template('upload_id.html')
            cursor.close(); conn.close()

        # ✅ SECURITY CHECK 2: Duplicate ID Photo (via image hash)
        import hashlib
        id_file_bytes = id_file.read()
        id_photo_hash = hashlib.sha256(id_file_bytes).hexdigest()
        id_file.seek(0)

        conn = get_db(); cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE id_photo_hash = %s", (id_photo_hash,))
        if cursor.fetchone():
            cursor.close(); conn.close()
            flash("This ID photo is already registered. Please use a different ID.", "danger")
            return render_template('upload_id.html')
        cursor.close(); conn.close()

        try:
            # 1. Generate unique filenames
            os.makedirs(UPLOAD_FOLDER, exist_ok=True)
            id_fn = secure_filename(f"id_{uuid.uuid4().hex}_{id_file.filename}")
            selfie_fn = secure_filename(f"selfie_{uuid.uuid4().hex}.jpg")
            
            # 2. Save files
            id_file.save(os.path.join(UPLOAD_FOLDER, id_fn))
            selfie_data = _base64.b64decode(selfie_b64.split(',')[-1])
            with open(os.path.join(UPLOAD_FOLDER, selfie_fn), 'wb') as f:
                f.write(selfie_data)

        
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
            # 4. ONE execute lang
            conn = get_db(); cursor = conn.cursor()
            query = """
            UPDATE users 
            SET id_document_path = %s, selfie_path = %s, 
            id_verification_status = %s, id_number = %s,
            id_photo_hash = %s,
            verified_at = CASE WHEN %s = 'verified' THEN NOW() ELSE NULL END
            WHERE email = %s
            """
            cursor.execute(query, (id_fn, selfie_fn, final_status, id_number, id_photo_hash, final_status, target_email))
            conn.commit(); cursor.close(); conn.close()

            # Clear session after successful submission
            session.clear()
            flash('Success! Verification documents submitted for review.', 'success')
            return redirect(url_for('auth.login'))
            
        except Exception as e:
            flash(f"Database error: {str(e)}", "danger")

    # Kapag GET request (Load the page)
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