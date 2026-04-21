/* ============================================
   reset_password.js — Loan Management System
   ============================================ */

// ── FLASH MESSAGE AUTO-DISMISS ──
function initFlash() {
  document.querySelectorAll('.flash-msg').forEach((el, i) => {
    setTimeout(() => dismissFlash(el), 5000 + i * 400);
    const btn = el.querySelector('.f-close');
    if (btn) btn.addEventListener('click', () => dismissFlash(el));
  });
}

function dismissFlash(el) {
  el.style.transition = 'all 0.3s ease';
  el.style.opacity    = '0';
  el.style.transform  = 'translateX(16px)';
  setTimeout(() => el.remove(), 300);
}

// ── TOAST ──
function showToast(message, type = 'info') {
  let stack = document.querySelector('.flash-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'flash-stack';
    const card = document.querySelector('.card');
    const form = card.querySelector('form');
    card.insertBefore(stack, form);
  }
  const el = document.createElement('div');
  el.className = `flash-msg ${type}`;
  el.innerHTML = `<span>${message}</span><button class="f-close" aria-label="Close">&times;</button>`;
  el.querySelector('.f-close').addEventListener('click', () => dismissFlash(el));
  stack.appendChild(el);
  setTimeout(() => dismissFlash(el), 5000);
}

// ── PASSWORD TOGGLE ──
function initPasswordToggles() {
  document.querySelectorAll('.pw-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const field = btn.closest('.field');
      if (!field) return;
      const input = field.querySelector('input[type="password"], input[type="text"]');
      if (!input) return;
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.classList.toggle('is-visible', isPassword);
      btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
    });
  });
}

// ── OTP — DIGITS ONLY ──
function initOtpInput() {
  const otp = document.getElementById('otp');
  if (!otp) return;

  otp.addEventListener('input', () => {
    // Strip non-digits
    otp.value = otp.value.replace(/\D/g, '').slice(0, 6);
    clearFieldError(otp, 'otp-error');

    if (otp.value.length === 6) {
      otp.classList.add('is-valid');
      otp.classList.remove('is-invalid');
    } else {
      otp.classList.remove('is-valid');
    }
  });

  otp.addEventListener('keydown', (e) => {
    // Allow: backspace, delete, tab, arrows, ctrl+a, ctrl+c, ctrl+v
    const allowed = ['Backspace','Delete','Tab','ArrowLeft','ArrowRight','Home','End'];
    if (allowed.includes(e.key)) return;
    if ((e.ctrlKey || e.metaKey) && ['a','c','v','x'].includes(e.key.toLowerCase())) return;
    // Block non-digits
    if (!/^\d$/.test(e.key)) e.preventDefault();
  });

  // Handle paste — keep only digits
  otp.addEventListener('paste', (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData || window.clipboardData).getData('text');
    otp.value = pasted.replace(/\D/g, '').slice(0, 6);
    otp.dispatchEvent(new Event('input'));
  });
}

// ── PASSWORD STRENGTH METER ──
function getPasswordStrength(pw) {
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { level: 'weak',   label: 'Weak' };
  if (score === 2) return { level: 'fair',   label: 'Fair' };
  if (score === 3) return { level: 'good',   label: 'Good' };
  return               { level: 'strong', label: 'Strong' };
}

function initPasswordMeter() {
  const pwInput = document.getElementById('new_password');
  const meter   = document.getElementById('pw-meter');
  const fill    = document.getElementById('pw-fill');
  const label   = document.getElementById('pw-label');
  if (!pwInput || !meter || !fill || !label) return;

  pwInput.addEventListener('input', () => {
    const val = pwInput.value;

    if (!val) {
      meter.classList.remove('visible');
      fill.className  = 'pw-meter-fill';
      label.className = 'pw-meter-label';
      label.textContent = '';
      return;
    }

    meter.classList.add('visible');
    const { level, label: text } = getPasswordStrength(val);

    fill.className  = `pw-meter-fill ${level}`;
    label.className = `pw-meter-label ${level}`;
    label.textContent = text;

    clearFieldError(pwInput, 'password-error');
  });
}

// ── FIELD ERROR HELPERS ──
function showFieldError(input, errorId, message) {
  const err = document.getElementById(errorId);
  input.classList.add('is-invalid');
  input.classList.remove('is-valid');
  if (err) { err.textContent = message; err.style.display = 'block'; }
}

function clearFieldError(input, errorId) {
  const err = document.getElementById(errorId);
  input.classList.remove('is-invalid');
  if (err) { err.textContent = ''; err.style.display = 'none'; }
}

// ── CONFIRM PASSWORD LIVE CHECK ──
function initConfirmMatch() {
  const pw      = document.getElementById('new_password');
  const confirm = document.getElementById('confirm_password');
  if (!pw || !confirm) return;

  confirm.addEventListener('input', () => {
    if (!confirm.value) {
      clearFieldError(confirm, 'confirm-error');
      return;
    }
    if (confirm.value !== pw.value) {
      showFieldError(confirm, 'confirm-error', 'Passwords do not match.');
    } else {
      clearFieldError(confirm, 'confirm-error');
      confirm.classList.add('is-valid');
    }
  });

  // Also re-check confirm when new_password changes
  pw.addEventListener('input', () => {
    if (confirm.value && confirm.value !== pw.value) {
      showFieldError(confirm, 'confirm-error', 'Passwords do not match.');
      confirm.classList.remove('is-valid');
    } else if (confirm.value && confirm.value === pw.value) {
      clearFieldError(confirm, 'confirm-error');
      confirm.classList.add('is-valid');
    }
  });
}

// ── FORM VALIDATION ──
function initFormValidation() {
  const form    = document.querySelector('form');
  const otp     = document.getElementById('otp');
  const pw      = document.getElementById('new_password');
  const confirm = document.getElementById('confirm_password');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    let valid = true;

    // OTP
    if (!otp.value.trim()) {
      showFieldError(otp, 'otp-error', 'OTP code is required.');
      valid = false;
    } else if (!/^\d{6}$/.test(otp.value.trim())) {
      showFieldError(otp, 'otp-error', 'OTP must be a 6-digit number.');
      valid = false;
    }

    // New password
    if (!pw.value) {
      showFieldError(pw, 'password-error', 'New password is required.');
      valid = false;
    } else if (pw.value.length < 8) {
      showFieldError(pw, 'password-error', 'Password must be at least 8 characters.');
      valid = false;
    }

    // Confirm password
    if (!confirm.value) {
      showFieldError(confirm, 'confirm-error', 'Please confirm your new password.');
      valid = false;
    } else if (confirm.value !== pw.value) {
      showFieldError(confirm, 'confirm-error', 'Passwords do not match.');
      valid = false;
    }

    if (!valid) e.preventDefault();
  });
}

// ── SUBMIT LOADER ──
function initSubmitLoader() {
  document.querySelectorAll('form').forEach(form => {
    form.addEventListener('submit', (e) => {
      if (e.defaultPrevented) return;
      const btn = form.querySelector('button[type="submit"]');
      if (!btn) return;
      btn.disabled = true;
      const original = btn.innerHTML;
      btn.innerHTML  = 'Processing...';
      setTimeout(() => { btn.disabled = false; btn.innerHTML = original; }, 8000);
    });
  });
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  initFlash();
  initPasswordToggles();
  initOtpInput();
  initPasswordMeter();
  initConfirmMatch();
  initFormValidation();
  initSubmitLoader();
});