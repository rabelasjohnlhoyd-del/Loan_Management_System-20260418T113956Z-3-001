from flask import Flask, redirect, url_for, render_template
from Loan_Management_System2 import reg_app

app = reg_app()

@app.route('/')
def Home():
    return redirect(url_for('auth.login'))

if __name__ == '__main__':
    app.run(debug=True, port=5000)