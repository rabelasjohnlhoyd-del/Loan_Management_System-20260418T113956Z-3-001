from flask import Flask, redirect, url_for, render_template
from Loan_Management_System2 import reg_app

app = reg_app()

@app.route('/')
def Home():
    return redirect(url_for('auth.login'))

@app.after_request
def add_no_cache_headers(response):
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

if __name__ == '__main__':
    app.run(debug=True, port=5000)