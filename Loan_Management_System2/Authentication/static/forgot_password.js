/* ============================================
   forgot_password.js — Loan Management System
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

// ── EMAIL VALIDATION ──
function initEmailValidation() {
  const email = document.getElementById('email');
  if (!email) return;

  email.addEventListener('input', () => {
    clearFieldError(email, 'email-error');

    const val = email.value.trim();
    if (val && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      email.classList.add('is-valid');
    } else {
      email.classList.remove('is-valid');
    }
  });
}

// ── FORM VALIDATION ──
function initFormValidation() {
  const form  = document.querySelector('form');
  const email = document.getElementById('email');
  if (!form || !email) return;

  form.addEventListener('submit', (e) => {
    let valid = true;

    if (!email.value.trim()) {
      showFieldError(email, 'email-error', 'Email address is required.');
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
      showFieldError(email, 'email-error', 'Enter a valid email address.');
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
      btn.disabled  = true;
      const original = btn.innerHTML;
      btn.innerHTML  = 'Sending...';
      setTimeout(() => { btn.disabled = false; btn.innerHTML = original; }, 8000);
    });
  });
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  initFlash();
  initEmailValidation();
  initFormValidation();
  initSubmitLoader();
});