from flask import Flask
from flask_mail import Mail
from dotenv import load_dotenv
from datetime import timedelta
import os

load_dotenv()

db_config = {
    'host': 'localhost',
    'user': 'root',
    'password': '',
    'database': 'Loan_management_db',
    'auth_plugin': 'mysql_native_password'
}

mail = Mail()

def reg_app():
    app = Flask(__name__, template_folder='templates')
    app.secret_key = 'Secret_LoanApp_2024'

    app.config['MAIL_SERVER'] = 'smtp.gmail.com'
    app.config['MAIL_PORT'] = 587
    app.config['MAIL_USE_TLS'] = True
    app.config['MAIL_USERNAME'] = 'rabelasjohnlhoyd@gmail.com'
    app.config['MAIL_PASSWORD'] = 'izsc mjnu owol phkg'
    app.config['MAIL_DEFAULT_SENDER'] = 'rabelasjohnlhoyd@gmail.com'
    app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)

    mail.init_app(app)

    from Loan_Management_System2.Auditor.auditor import auditor_bp
    app.register_blueprint(auditor_bp, url_prefix='/auditor')

    from Loan_Management_System2.Authentication.login import auth
    app.register_blueprint(auth, url_prefix='/auth')

    from Loan_Management_System2.Borrower.borrower import borrower_bp
    app.register_blueprint(borrower_bp, url_prefix='/borrower')

    from Loan_Management_System2.Officer.officer import officer_bp
    app.register_blueprint(officer_bp, url_prefix='/officer')

    from Loan_Management_System2.Super_admin.super_admin import super_admin_bp
    app.register_blueprint(super_admin_bp, url_prefix='/admin')

    from Loan_Management_System2.Loans.routes import loans_bp
    app.register_blueprint(loans_bp, url_prefix='/loans')



    return app