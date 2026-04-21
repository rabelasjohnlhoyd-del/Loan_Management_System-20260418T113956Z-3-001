/* ============================================
   LOGIN PAGE JS
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
    document.body.appendChild(stack);
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

// ── CLIENT-SIDE VALIDATION ──
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

function initLoginValidation() {
  const form     = document.querySelector('form');
  const email    = document.getElementById('email');
  const password = document.getElementById('password');
  if (!form || !email || !password) return;

  // Live clear errors on input
  email.addEventListener('input', () => clearFieldError(email, 'email-error'));
  password.addEventListener('input', () => clearFieldError(password, 'password-error'));

  form.addEventListener('submit', (e) => {
    let valid = true;

    if (!email.value.trim()) {
      showFieldError(email, 'email-error', 'Email is required.');
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
      showFieldError(email, 'email-error', 'Enter a valid email address.');
      valid = false;
    }

    if (!password.value) {
      showFieldError(password, 'password-error', 'Password is required.');
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
      btn.innerHTML  = 'Processing...';
      setTimeout(() => { btn.disabled = false; btn.innerHTML = original; }, 8000);
    });
  });
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  initFlash();
  initPasswordToggles();
  initLoginValidation();
  initSubmitLoader();
});