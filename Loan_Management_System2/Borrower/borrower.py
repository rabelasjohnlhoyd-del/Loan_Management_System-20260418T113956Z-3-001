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
 
    recent_loans    = []
    stats           = {'active_count': 0, 'total_outstanding': 0}
    next_payment    = {'next_due': None, 'next_amount': 0}
    total_paid      = 0
    overdue_loans   = []
    due_soon_loans  = []
    recent_activity = []
 
    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)
        today  = datetime.date.today()
 
        # ── 1. RECENT LOANS (with progress + standing) ────────────────────
        # loans.status valid values: 'active','paid','defaulted','restructured','written_off'
        # loans has next_due_date column built-in — no subquery needed for that
        cursor.execute("""
            SELECT
                l.id,
                l.loan_no,
                l.principal_amount,
                l.outstanding_balance,
                l.monthly_payment,
                l.next_due_date,
                l.status,
                l.created_at,
                lt.name      AS type_name,
                lp.plan_name,
 
                /* total confirmed payments for this loan */
                COALESCE((
                    SELECT SUM(p.amount_paid)
                    FROM payments p
                    WHERE p.loan_id = l.id
                      AND p.status IN ('approved', 'verified')
                ), 0) AS paid_amount,
 
                /* days until next due (negative = overdue) */
                DATEDIFF(l.next_due_date, CURDATE()) AS days_until_due
 
            FROM loans l
            JOIN loan_types lt ON l.loan_type_id = lt.id
            JOIN loan_plans  lp ON l.loan_plan_id  = lp.id
            WHERE l.borrower_id = %s
            ORDER BY l.created_at DESC
            LIMIT 5
        """, (session['user_id'],))
        raw_loans = cursor.fetchall()
 
        for loan in raw_loans:
            principal = float(loan.get('principal_amount') or 0)
            paid      = float(loan.get('paid_amount') or 0)
            days_due  = loan.get('days_until_due')  # int or None from DATEDIFF
 
            # percent paid
            loan['percent_paid'] = int((paid / principal * 100)) if principal > 0 else 0
 
            # reference_no alias so HTML template works unchanged
            loan['reference_no'] = loan['loan_no']
 
            # standing + countdown chips
            if loan['status'] == 'defaulted':
                loan['standing']       = 'overdue'
                loan['days_overdue']   = abs(int(days_due)) if days_due and days_due < 0 else 0
                loan['days_until_due'] = None
            elif days_due is not None and days_due < 0:
                loan['standing']       = 'overdue'
                loan['days_overdue']   = abs(int(days_due))
                loan['days_until_due'] = None
            elif days_due is not None and days_due <= 3:
                loan['standing']       = 'risk'
                loan['days_overdue']   = 0
                loan['days_until_due'] = int(days_due)
            else:
                loan['standing']       = 'good'
                loan['days_overdue']   = 0
                loan['days_until_due'] = int(days_due) if days_due is not None else None
 
            recent_loans.append(loan)
 
        # ── 2. STATS ──────────────────────────────────────────────────────
        cursor.execute("""
            SELECT
                COUNT(*)                               AS active_count,
                COALESCE(SUM(outstanding_balance), 0)  AS total_outstanding
            FROM loans
            WHERE borrower_id = %s
              AND status = 'active'
        """, (session['user_id'],))
        stats = cursor.fetchone() or {'active_count': 0, 'total_outstanding': 0}
 
        # ── 3. NEXT PAYMENT DUE ───────────────────────────────────────────
        # Use amortization_schedule for the exact next unpaid installment
        cursor.execute("""
            SELECT
                due_date AS next_due,
                total_due AS next_amount
            FROM amortization_schedule
            WHERE loan_id IN (SELECT id FROM loans WHERE borrower_id = %s AND status = 'active')
              AND is_paid = 0
            ORDER BY due_date ASC
            LIMIT 1
        """, (session['user_id'],))
        next_payment = cursor.fetchone() or {'next_due': None, 'next_amount': 0}
 
        # ── 4. TOTAL PAID (all time) ──────────────────────────────────────
        cursor.execute("""
            SELECT COALESCE(SUM(p.amount_paid), 0) AS total_paid
            FROM payments p
            JOIN loans l ON p.loan_id = l.id
            WHERE l.borrower_id = %s
              AND p.status IN ('approved', 'verified')
        """, (session['user_id'],))
        paid_row   = cursor.fetchone()
        total_paid = paid_row['total_paid'] if paid_row else 0
 
        # ── 5. OVERDUE LOANS — red alert banners ─────────────────────────
        # Unpaid amortization rows whose due_date has passed
        cursor.execute("""
            SELECT
                l.id,
                l.loan_no                 AS reference_no,
                MIN(a.due_date)           AS due_date,
                SUM(a.total_due)          AS overdue_amount
            FROM amortization_schedule a
            JOIN loans l ON a.loan_id = l.id
            WHERE l.borrower_id = %s
              AND l.status = 'active'
              AND a.is_paid  = 0
              AND a.due_date < CURDATE()
            GROUP BY l.id, l.loan_no
            ORDER BY due_date ASC
        """, (session['user_id'],))
        overdue_loans = cursor.fetchall()
 
        # ── 6. DUE-SOON LOANS — yellow alert banners (within 5 days) ─────
        cursor.execute("""
            SELECT
                l.id,
                l.loan_no                              AS reference_no,
                MIN(a.due_date)                        AS next_due,
                SUM(a.total_due)                       AS next_amount,
                DATEDIFF(MIN(a.due_date), CURDATE())   AS days_until_due
            FROM amortization_schedule a
            JOIN loans l ON a.loan_id = l.id
            WHERE l.borrower_id = %s
              AND l.status = 'active'
              AND a.is_paid  = 0
              AND a.due_date BETWEEN CURDATE()
                                 AND DATE_ADD(CURDATE(), INTERVAL 5 DAY)
            GROUP BY l.id, l.loan_no
            ORDER BY next_due ASC
        """, (session['user_id'],))
        due_soon_loans = cursor.fetchall()
 
        # ── 7. RECENT ACTIVITY FEED ───────────────────────────────────────
        cursor.execute("""
            SELECT
                'payment_received'                             AS type,
                CONCAT('Payment received — ', l.loan_no)      AS title,
                CONCAT('₱', FORMAT(p.amount_paid, 2),
                       ' via ', p.payment_method)             AS description,
                p.created_at                                   AS event_at
            FROM payments p
            JOIN loans l ON p.loan_id = l.id
            WHERE l.borrower_id = %s
              AND p.status IN ('approved', 'verified')
 
            UNION ALL
 
            SELECT
                CASE l.status
                    WHEN 'active'       THEN 'loan_approved'
                    WHEN 'paid'         THEN 'loan_closed'
                    WHEN 'defaulted'    THEN 'payment_overdue'
                    WHEN 'written_off'  THEN 'loan_rejected'
                    ELSE 'general'
                END                                            AS type,
                CASE l.status
                    WHEN 'active'      THEN CONCAT('Loan approved — ', l.loan_no)
                    WHEN 'paid'        THEN CONCAT('Loan fully paid — ', l.loan_no)
                    WHEN 'defaulted'   THEN CONCAT('Loan defaulted — ', l.loan_no)
                    WHEN 'written_off' THEN CONCAT('Loan written off — ', l.loan_no)
                    ELSE l.loan_no
                END                                            AS title,
                CONCAT(lt.name, ' · ₱',
                       FORMAT(l.principal_amount, 2))          AS description,
                l.updated_at                                   AS event_at
            FROM loans l
            JOIN loan_types lt ON l.loan_type_id = lt.id
            WHERE l.borrower_id = %s
 
            ORDER BY event_at DESC
            LIMIT 8
        """, (session['user_id'], session['user_id']))
        raw_activity = cursor.fetchall()
 
        def time_ago(dt):
            if dt is None:
                return ''
            now = datetime.datetime.now()
            if isinstance(dt, datetime.date) and not isinstance(dt, datetime.datetime):
                dt = datetime.datetime.combine(dt, datetime.time.min)
            diff = now - dt
            days = diff.days
            if days == 0:
                hours = diff.seconds // 3600
                return f'{hours}h ago' if hours > 0 else 'Just now'
            if days == 1:
                return 'Yesterday'
            if days < 7:
                return f'{days} days ago'
            return dt.strftime('%b %d, %Y')
 
        for item in raw_activity:
            item['time_ago'] = time_ago(item.get('event_at'))
        recent_activity = raw_activity
 
        cursor.close()
        conn.close()
 
    except Exception as e:
        print(f"[borrower_dashboard ERROR] {e}")
 
    return render_template(
        'dashboard_borrower.html',
        recent_loans    = recent_loans,
        stats           = stats,
        next_payment    = next_payment,
        total_paid      = total_paid,
        overdue_loans   = overdue_loans,
        due_soon_loans  = due_soon_loans,
        recent_activity = recent_activity,
    )


# ================================================================
# SECTION 4: USER PROFILE
# ================================================================
@borrower_bp.route('/profile')
@login_required
def profile():
    user = {}
    interest_saved = 0  # <--- Initialize natin default sa 0
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)

        # 1. Kunin ang basic info ni User
        cursor.execute("SELECT * FROM users WHERE id = %s", (session['user_id'],))
        user = cursor.fetchone() or {}

        # 2. FIXED QUERY: Isinama na natin ang 'total_interest_saved'
        cursor.execute("""
            SELECT credit_score, risk_level, paid_loans, active_loans, defaulted_loans, total_interest_saved
            FROM borrower_profiles 
            WHERE user_id = %s
        """, (session['user_id'],))
        metrics = cursor.fetchone()

        if metrics:
            credit_score = metrics['credit_score']
            interest_saved = metrics['total_interest_saved'] # <--- Eto yung kailangan ng HTML
            
            # Para makuha ang "Verified Payments" count
            cursor.execute("SELECT COUNT(*) as cnt FROM payments WHERE borrower_id = %s AND status='verified'", (session['user_id'],))
            on_time_count = cursor.fetchone()['cnt']

            # Para makuha ang "Overdue Incidents"
            cursor.execute("""
                SELECT COUNT(*) as cnt FROM amortization_schedule a 
                JOIN loans l ON a.loan_id = l.id 
                WHERE l.borrower_id = %s AND a.is_paid = 0 AND a.due_date < CURDATE()
            """, (session['user_id'],))
            overdue_count = cursor.fetchone()['cnt']

            credit_factors = {
                'on_time_payments': on_time_count,
                'paid_loans': metrics['paid_loans'],
                'overdue_count': overdue_count,
                'active_loans': metrics['active_loans']
            }
        else:
            credit_score = 500
            interest_saved = 0
            credit_factors = {'on_time_payments': 0, 'paid_loans': 0, 'overdue_count': 0, 'active_loans': 0}

        cursor.close()
        conn.close()

    except Exception as e:
        print(f"[profile SYNC ERROR] {e}")
        credit_score = 500
        interest_saved = 0
        credit_factors = {'on_time_payments': 0, 'paid_loans': 0, 'overdue_count': 0, 'active_loans': 0}

    # 3. I-PASS ANG interest_saved SA HTML
    return render_template('B_profile.html',
                           user=user,
                           credit_score=credit_score,
                           credit_factors=credit_factors,
                           interest_saved=interest_saved) # <--- Importante ito!


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
                   (SELECT MIN(a.due_date) FROM amortization_schedule a WHERE a.loan_id = l.id AND a.is_paid = 0) AS next_due,
                   (SELECT SUM(a.total_due) FROM amortization_schedule a WHERE a.loan_id = l.id AND a.is_paid = 0
                      AND a.due_date = (SELECT MIN(a2.due_date) FROM amortization_schedule a2 WHERE a2.loan_id = l.id AND a2.is_paid = 0)
                   ) AS next_amount
            FROM loans l
            JOIN loan_types lt ON l.loan_type_id = lt.id
            WHERE l.borrower_id = %s AND l.status IN ('active', 'disbursed')
            ORDER BY l.created_at DESC
        """, (session['user_id'],))
        active_loans = cursor.fetchall()

       
        cursor.execute("SELECT method, balance FROM dummy_wallets WHERE user_id = %s", (session['user_id'],))
        wallets = {w['method']: float(w['balance']) for w in cursor.fetchall()}

        cursor.close()
        conn.close()

    except Exception as e:
        flash(f'Error loading payment data: {str(e)}', 'danger')
        return redirect(url_for('borrower.borrower_dashboard'))

    return render_template('make_payment.html',
                           active_loans=active_loans,
                           wallets=wallets, 
                           today=datetime.date.today())

def build_amortization(principal, annual_rate, months, start_date, starting_period=1):
    from decimal import Decimal
    import datetime
    schedule = []
    r = (Decimal(str(annual_rate)) / 100) / 12
    principal_dec = Decimal(str(principal))
    
    if r > 0:
        monthly = principal_dec * (r * (1 + r)**months) / ((1 + r)**months - 1)
        monthly = round(monthly, 2)
    else:
        monthly = round(principal_dec / months, 2)
        
    balance = principal_dec

    for i in range(1, months + 1):
        interest = round(float(balance) * float(r), 2)
        
        if i == months: # Last month
            principal_portion = round(float(balance), 2)
        else:
            principal_portion = round(float(monthly) - interest, 2)
            
        balance = balance - Decimal(str(principal_portion))
        
        due_date = start_date + datetime.timedelta(days=30 * i)
        
        schedule.append({
            'period_no':     starting_period + (i - 1),
            'due_date':      due_date,
            'principal_due': principal_portion,
            'interest_due':  interest,
            'total_due':     round(principal_portion + interest, 2),
            'balance_after': max(float(balance), 0)
        })
    return schedule

@borrower_bp.route('/payments/make/<int:loan_id>', methods=['GET', 'POST'])
@login_required
@role_required('borrower')
def make_payment(loan_id):
    from decimal import Decimal
    import datetime
    
    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    # 1. KUNIN ANG DETALYE NG LOAN
    cursor.execute("""
        SELECT l.*, lt.name AS type_name, lp.plan_name, lp.interest_rate
        FROM loans l
        JOIN loan_types lt ON l.loan_type_id = lt.id
        JOIN loan_plans lp ON l.loan_plan_id = lp.id
        WHERE l.id = %s AND l.borrower_id = %s
    """, (loan_id, session['user_id']))
    loan = cursor.fetchone()

    if not loan:
        flash('Loan record not found.', 'danger')
        return redirect(url_for('borrower.borrower_dashboard'))

    if request.method == 'POST':
        amount_paid = Decimal(str(request.form.get('amount_paid')))
        payment_method = request.form.get('payment_method') 
        reference_number = request.form.get('reference_number')
        payment_date = request.form.get('payment_date')
        
        try:
            # 2. WALLET CHECK
            cursor.execute("SELECT balance FROM dummy_wallets WHERE user_id = %s AND method = %s", (session['user_id'], payment_method))
            wallet = cursor.fetchone()
            if not wallet or Decimal(str(wallet['balance'])) < amount_paid:
                flash(f'Insufficient balance in your {payment_method.upper()} wallet.', 'danger')
                return redirect(url_for('borrower.select_loan_to_pay'))

            # 3. PAYMENT PROCESSING PER PERIOD
            remaining_to_process = amount_paid
            total_principal_paid = Decimal('0.00')
            total_interest_paid = Decimal('0.00')
            total_rebate_given = Decimal('0.00')
            REBATE_RATE = Decimal('0.20') # 20% Rebate para sa Advance Payment

            cursor.execute("SELECT * FROM amortization_schedule WHERE loan_id = %s AND is_paid = 0 ORDER BY period_no ASC", (loan_id,))
            unpaid_rows = cursor.fetchall()
            today = datetime.date.today()

            for row in unpaid_rows:
                if remaining_to_process <= 0: break
                
                p_due = Decimal(str(row['principal_due']))
                i_due = Decimal(str(row['interest_due']))
                
                # Check kung "Advance" (> 25 days) para bigyan ng 20% Rebate
                is_advance = row['due_date'] > (today + datetime.timedelta(days=25))
                
                if is_advance:
                    rebate = i_due * REBATE_RATE
                    actual_i_to_pay = i_due - rebate
                    total_rebate_given += rebate
                else:
                    actual_i_to_pay = i_due
                
                period_total = p_due + actual_i_to_pay

                if remaining_to_process >= period_total:
                    # Markahan bilang PAID ang buong period
                    cursor.execute("UPDATE amortization_schedule SET is_paid = 1, paid_at = NOW() WHERE id = %s", (row['id'],))
                    remaining_to_process -= period_total
                    total_principal_paid += p_due
                    total_interest_paid += actual_i_to_pay
                else:
                    # Partial payment logic: Sobra sa interest pero kulang sa full period
                    if remaining_to_process > actual_i_to_pay:
                        total_principal_paid += (remaining_to_process - actual_i_to_pay)
                        total_interest_paid += actual_i_to_pay
                    else:
                        total_interest_paid += remaining_to_process
                    remaining_to_process = 0

            # --- FIX SA "BUTAL" (The 25.77 / 118.16 Fix) ---
            if remaining_to_process > 0:
                total_principal_paid += remaining_to_process
                remaining_to_process = 0

            # 4. UPDATE LOAN BALANCE & NEXT DUE DATE
            current_ob = Decimal(str(loan['outstanding_balance']))
            actual_deduction = total_principal_paid + total_rebate_given
            new_ob_dec = max(Decimal('0.00'), current_ob - actual_deduction)

            # Hanapin ang susunod na unpaid due date pagkatapos ng bayad
            cursor.execute("SELECT due_date FROM amortization_schedule WHERE loan_id = %s AND is_paid = 0 ORDER BY due_date ASC LIMIT 1", (loan_id,))
            next_due_row = cursor.fetchone()
            next_due = next_due_row['due_date'] if next_due_row else None

            loan_status = 'paid' if new_ob_dec <= 0 else 'active'
            cursor.execute("UPDATE loans SET outstanding_balance = %s, next_due_date = %s, status = %s WHERE id = %s", 
                           (new_ob_dec, next_due, loan_status, loan_id))

            # --- TRANSPARENCY FIX: Sync huling paid row balance sa Dashboard ---
            cursor.execute("""
                UPDATE amortization_schedule 
                SET balance_after = %s 
                WHERE loan_id = %s AND is_paid = 1 
                ORDER BY period_no DESC LIMIT 1
            """, (new_ob_dec, loan_id))

            # 5. WALLET & SYSTEM FUNDS UPDATE
            cursor.execute("UPDATE dummy_wallets SET balance = balance - %s WHERE user_id = %s AND method = %s", (amount_paid, session['user_id'], payment_method))
            
            year = datetime.datetime.now().year
            cursor.execute("SELECT COUNT(*) AS total FROM payments WHERE YEAR(created_at) = %s", (year,))
            pay_no = f"PAY-{year}-{str(cursor.fetchone()['total'] + 1).zfill(6)}"
            cursor.execute("""
                INSERT INTO payments (payment_no, loan_id, borrower_id, amount_paid, principal_portion, interest_portion, 
                                     payment_method, reference_number, payment_date, status, verified_at, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'verified', NOW(), NOW())
            """, (pay_no, loan_id, session['user_id'], amount_paid, total_principal_paid, total_interest_paid, 
                  payment_method, reference_number, payment_date))

            cursor.execute("UPDATE system_funds SET total_capital = total_capital + %s, total_interest_earned = total_interest_earned + %s WHERE id = 1", 
                           (total_principal_paid, total_interest_paid))
            
            if total_rebate_given > 0:
                cursor.execute("UPDATE borrower_profiles SET total_interest_saved = total_interest_saved + %s WHERE user_id = %s", 
                               (total_rebate_given, session['user_id']))

            conn.commit()

            # 6. RE-AMORTIZATION (Triggered if user paid extra)
            if new_ob_dec > 0 and (total_principal_paid > Decimal(str(loan['monthly_payment'])) * Decimal('0.5')):
                cursor.execute("SELECT MAX(period_no) as last_p FROM amortization_schedule WHERE loan_id = %s AND is_paid = 1", (loan_id,))
                last_period = cursor.fetchone()['last_p'] or 0
                
                cursor.execute("SELECT COUNT(*) as rem FROM amortization_schedule WHERE loan_id = %s AND is_paid = 0", (loan_id,))
                rem_months = cursor.fetchone()['rem']

                if rem_months > 0:
                    cursor.execute("DELETE FROM amortization_schedule WHERE loan_id = %s AND is_paid = 0", (loan_id,))
                    
                    # --- FIX: ADJUST REFERENCE DATE ---
                    # Dahil ang build_amortization ay laging nag-a-add ng 30 days para sa unang row,
                    # kailangan nating i-set ang start_date pabalik ng 30 days mula sa saktong target due date.
                    if next_due:
                        reference_date = next_due - datetime.timedelta(days=30)
                    else:
                        reference_date = today

                    new_sched = build_amortization(float(new_ob_dec), float(loan['interest_rate']), rem_months, 
                                                   reference_date, starting_period=last_period + 1)
                    
                    for s in new_sched:
                        cursor.execute("""
                            INSERT INTO amortization_schedule 
                            (loan_id, period_no, due_date, principal_due, interest_due, total_due, balance_after)
                            VALUES (%s, %s, %s, %s, %s, %s, %s)
                        """, (loan_id, s['period_no'], s['due_date'], s['principal_due'], s['interest_due'], s['total_due'], s['balance_after']))
                    
                    if new_sched:
                        cursor.execute("UPDATE loans SET monthly_payment = %s WHERE id = %s", (new_sched[0]['total_due'], loan_id))
                    conn.commit()

            recalculate_borrower_metrics(session['user_id'])
            flash(f'Payment Successful! Interest saved: ₱{total_rebate_given:,.2f}', 'success')
            return redirect(url_for('borrower.select_loan_to_pay') + f'?success=1&ref={pay_no}')

        except Exception as e:
            conn.rollback()
            flash(f'Error: {str(e)}', 'danger')

    cursor.close(); conn.close()
    return redirect(url_for('borrower.borrower_dashboard'))

def re_amortize_loan(loan_id, new_balance, start_date):
    """
    Buburahin ang mga unpaid schedule at gagawa ng bago 
    base sa lumiit na balance.
    """
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    
    # 1. Kunin ang loan details at plans
    cursor.execute("""
        SELECT l.*, lp.interest_rate, lp.interest_type 
        FROM loans l 
        JOIN loan_plans lp ON l.loan_plan_id = lp.id 
        WHERE l.id = %s
    """, (loan_id,))
    loan = cursor.fetchone()
    
    # 2. Ilang months pa ang natitira?
    cursor.execute("SELECT COUNT(*) as rem FROM amortization_schedule WHERE loan_id = %s AND is_paid = 0", (loan_id,))
    remaining_months = cursor.fetchone()['rem']
    
    if remaining_months > 0:
        # 3. Burahin ang lahat ng lumang schedule na hindi pa bayad
        cursor.execute("DELETE FROM amortization_schedule WHERE loan_id = %s AND is_paid = 0", (loan_id,))
        
        # 4. Gawa ng bagong schedule base sa bagong balance
        # Gagamit tayo ng built-in function niyo na build_amortization (sa routes.py)
        from Loan_Management_System2.Loans.routes import build_amortization
        new_sched = build_amortization(new_balance, float(loan['interest_rate']), remaining_months, start_date)
        
        for s in new_sched:
            cursor.execute("""
                INSERT INTO amortization_schedule 
                (loan_id, period_no, due_date, principal_due, interest_due, total_due, balance_after)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (loan_id, s['period_no'], s['due_date'], s['principal_due'], s['interest_due'], s['total_due'], s['balance_after']))
            
    conn.commit()
    cursor.close()
    conn.close()


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

    return render_template('e_receipt_page.html', payment=payment)



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

# ================================================================
# SECTION 7: NOTIFICATION API (FOR FRONTEND DROPDOWN)
# ================================================================

@borrower_bp.route('/notifications/api/count')
@login_required
def notif_api_count():
    """Get unread notification count for badge dot"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT COUNT(*) AS cnt FROM notifications
            WHERE user_id = %s AND is_read = 0
        """, (session['user_id'],))
        count = cursor.fetchone()['cnt']
        cursor.close()
        conn.close()
        return jsonify({'count': count})
    except Exception as e:
        return jsonify({'count': 0, 'error': str(e)}), 500


@borrower_bp.route('/notifications/api/unread')
@login_required
def notif_api_unread():
    """Get unread and recent notifications for dropdown"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT id, type, title, message, link, is_read,
                   DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as created_at
            FROM notifications
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 10
        """, (session['user_id'],))
        notifs = cursor.fetchall()
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'notifications': notifs
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@borrower_bp.route('/notifications/api/mark-read/<int:notif_id>', methods=['POST'])
@login_required
def notif_api_mark_read(notif_id):
    """Mark a single notification as read"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE notifications SET is_read = 1
            WHERE id = %s AND user_id = %s
        """, (notif_id, session['user_id']))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@borrower_bp.route('/notifications/api/mark-all-read', methods=['POST'])
@login_required
def notif_api_mark_all_read():
    """Mark all notifications as read"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE notifications SET is_read = 1
            WHERE user_id = %s AND is_read = 0
        """, (session['user_id'],))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ================================================================
# SECTION 8: PAYMENT STATUS & RECEIPT API
# ================================================================

@borrower_bp.route('/payments/status-by-id/<int:payment_id>')
@login_required
def payment_status_by_id(payment_id):
    """Get payment status and check if proof exists"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT status, payment_no, screenshot_path 
            FROM payments 
            WHERE id = %s AND borrower_id = %s
        """, (payment_id, session['user_id']))
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if row:
            return jsonify({
                'status': row['status'],
                'payment_no': row['payment_no'],
                'has_proof': bool(row.get('screenshot_path'))
            })
        return jsonify({'error': 'not_found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ================================================================
# SECTION 9: E-RECEIPT PAGE (HTML VIEW)
# ================================================================

@borrower_bp.route('/payments/receipt/<string:pay_no>')
@login_required
@role_required('borrower')
def view_receipt_page(pay_no):
    """View e-receipt as HTML page (for approved payments)"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT p.payment_no,
                   p.amount_paid,
                   p.payment_method,
                   p.reference_number,
                   p.payment_date,
                   p.updated_at,
                   p.status,
                   l.loan_no AS loan_ref,
                   lt.name   AS type_name,
                   u.full_name AS borrower_name
            FROM payments p
            JOIN loans l      ON p.loan_id      = l.id
            JOIN loan_types lt ON l.loan_type_id = lt.id
            JOIN users u       ON p.borrower_id  = u.id
            WHERE p.payment_no  = %s
              AND p.borrower_id = %s
        """, (pay_no, session['user_id']))
        payment = cursor.fetchone()
        cursor.close()
        conn.close()

        if not payment:
            flash('Receipt not found.', 'warning')
            return redirect(url_for('borrower.payment_history'))
            
        if payment['status'] not in ['approved', 'verified', 'completed']:
            flash('Payment not yet approved. No official receipt available.', 'warning')
            return redirect(url_for('borrower.payment_history'))

    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')
        return redirect(url_for('borrower.payment_history'))

    return render_template('e_receipt_page.html', payment=payment)

def recalculate_borrower_metrics(user_id):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    
    # 1. Kunin ang Work Details, Verification Status, at yung na-save na Interest (Rebates)
    cursor.execute("""
        SELECT u.employment_type, u.job_role, u.monthly_transactions, u.id_verification_status,
               COALESCE(bp.total_interest_saved, 0) as total_interest_saved
        FROM users u
        LEFT JOIN borrower_profiles bp ON u.id = bp.user_id
        WHERE u.id = %s
    """, (user_id,))
    user_info = cursor.fetchone()
    
    if not user_info:
        cursor.close()
        conn.close()
        return

    # 2. INCOME STABILITY LOGIC (Max 150 points)
    stability = 0
    # Base on Employment Type
    emp_scores = {"Government": 60, "Private": 50, "Self-Employed": 40, "OFW": 55}
    stability += emp_scores.get(user_info['employment_type'], 20)
    
    # Base on Job Role
    role_scores = {"Permanent": 60, "Contractual": 30, "JO": 20, "Business Owner": 50}
    stability += role_scores.get(user_info['job_role'], 10)
    
    # Base on Transaction Volume
    trans_scores = {"Above 100k": 30, "50k-100k": 20, "Below 50k": 10}
    stability += trans_scores.get(user_info['monthly_transactions'], 5)

    # 3. CREDIT SCORE LOGIC
    base_score = 500 
    
    # Bonus points for finishing ID Verification
    verification_bonus = 50 if user_info['id_verification_status'] == 'verified' else 0

    # Kunin ang stats ng payments
    cursor.execute("SELECT COUNT(*) as on_time FROM payments WHERE borrower_id = %s AND status='verified'", (user_id,))
    on_time_count = cursor.fetchone()['on_time']
    
    cursor.execute("""
        SELECT COUNT(*) as overdue FROM amortization_schedule a 
        JOIN loans l ON a.loan_id = l.id 
        WHERE l.borrower_id = %s AND a.is_paid = 0 AND a.due_date < CURDATE()
    """, (user_id,))
    overdue_count = cursor.fetchone()['overdue']

    # EARLY PAYMENT / REBATE BONUS
    interest_saved = float(user_info['total_interest_saved'] or 0)
    early_pay_bonus = int(interest_saved / 100) * 5

    # FINAL FORMULA
    final_score = base_score + stability + verification_bonus + (on_time_count * 15) + early_pay_bonus - (overdue_count * 100)
    final_score = max(300, min(850, final_score)) 

    # ─── FIXED 4. RISK LEVEL & LOAN LIMIT LOGIC ───
    if final_score >= 750:   # Excellent Standing
        risk_level = 'low'
        loan_limit = 150000.00
    elif final_score >= 650: # Good Standing
        risk_level = 'medium'
        loan_limit = 50000.00
    elif final_score >= 550: # Fair Standing
        risk_level = 'medium'
        loan_limit = 20000.00
    else:                    # Poor Standing
        risk_level = 'high'
        loan_limit = 10000.00

    # ─── FIXED 5. I-SAVE SA DB (Isinama na ang risk_level sa UPDATE) ───
    cursor.execute("""
        UPDATE borrower_profiles 
        SET credit_score = %s, 
            income_stability_score = %s, 
            max_loan_limit = %s,
            risk_level = %s
        WHERE user_id = %s
    """, (final_score, stability, loan_limit, risk_level, user_id))
    
    conn.commit()
    cursor.close()
    conn.close()