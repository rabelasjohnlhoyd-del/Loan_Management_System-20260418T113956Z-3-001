/* ============================================
   REGISTER PAGE JS
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

// ── FIELD STATE HELPERS ──
function showFieldError(input, errorId, message) {
  input.classList.add('is-invalid');
  input.classList.remove('is-valid');
  const err = document.getElementById(errorId);
  if (err) { err.textContent = message; err.style.display = 'block'; }
}

function clearFieldError(input, errorId) {
  input.classList.remove('is-invalid', 'is-valid');
  const err = document.getElementById(errorId);
  if (err) { err.textContent = ''; err.style.display = 'none'; }
}

function setFieldValid(input) {
  input.classList.add('is-valid');
  input.classList.remove('is-invalid');
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

// ── PASSWORD STRENGTH ──
function initPasswordStrength() {
  const pwInput = document.getElementById('password');
  const fill    = document.getElementById('pw-fill');
  const label   = document.getElementById('pw-label');
  if (!pwInput || !fill || !label) return;

  pwInput.addEventListener('input', () => {
    const val = pwInput.value;
    let score = 0;
    if (val.length >= 8)           score++;
    if (/[A-Z]/.test(val))         score++;
    if (/[0-9]/.test(val))         score++;
    if (/[^A-Za-z0-9]/.test(val))  score++;

    const levels = [
      { pct: '0%',   color: '#e2eeec', text: '' },
      { pct: '25%',  color: '#e05252', text: 'Weak' },
      { pct: '50%',  color: '#f59e0b', text: 'Fair' },
      { pct: '75%',  color: '#3b82f6', text: 'Good' },
      { pct: '100%', color: '#3ab5a0', text: 'Strong' },
    ];

    const lvl = val.length === 0 ? 0 : score;
    fill.style.width      = levels[lvl].pct;
    fill.style.background = levels[lvl].color;
    label.textContent     = levels[lvl].text;
    label.style.color     = levels[lvl].color;
  });
}

// ── DOB → AUTO AGE ──
function initAgeCompute() {
  const dob   = document.getElementById('dob');
  const badge = document.getElementById('age-badge');
  if (!dob || !badge) return;

  dob.addEventListener('change', () => {
    const val = dob.value;
    if (!val) { badge.textContent = ''; badge.style.display = 'none'; return; }
    const d     = new Date(val);
    const today = new Date();
    let age = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
    badge.textContent   = age >= 0 ? `Age: ${age}` : '';
    badge.style.display = age >= 0 ? 'inline-flex' : 'none';
  });
}

// ── EMAIL CHECK ──
function initEmailCheck() {
  const emailInput = document.getElementById('email');
  const hint       = document.getElementById('email-hint');
  if (!emailInput || !hint) return;

  let debounceTimer;
  emailInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const val = emailInput.value.trim();

    if (!val.includes('@')) {
      hint.textContent   = '';
      hint.style.display = 'none';
      clearFieldError(emailInput, 'email-error');
      return;
    }

    debounceTimer = setTimeout(async () => {
      try {
        const res  = await fetch('/auth/api/check-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: val }),
        });
        const data = await res.json();
        hint.style.display = 'block';
        if (data.exists) {
          hint.textContent = '✕ This email is already registered.';
          hint.style.color = '#e05252';
          showFieldError(emailInput, 'email-error', 'This email is already registered.');
        } else {
          hint.textContent = '✓ Email is available.';
          hint.style.color = '#3ab5a0';
          clearFieldError(emailInput, 'email-error');
          setFieldValid(emailInput);
        }
      } catch (_) {
        hint.textContent   = '';
        hint.style.display = 'none';
      }
    }, 500);
  });
}

// ── PASSWORD CONFIRM MATCH ──
function initConfirmPassword() {
  const pw1 = document.getElementById('password');
  const pw2 = document.getElementById('confirm_password');
  const err = document.getElementById('confirm-error');
  if (!pw1 || !pw2 || !err) return;

  function check() {
    if (!pw2.value) {
      err.classList.remove('visible');
      clearFieldError(pw2, null);
      return;
    }
    if (pw1.value !== pw2.value) {
      err.classList.add('visible');
      pw2.classList.add('is-invalid');
      pw2.classList.remove('is-valid');
    } else {
      err.classList.remove('visible');
      pw2.classList.remove('is-invalid');
      pw2.classList.add('is-valid');
    }
  }

  pw1.addEventListener('input', check);
  pw2.addEventListener('input', check);
}

// ── CLIENT-SIDE VALIDATION ON SUBMIT ──
function initRegisterValidation() {
  const form    = document.querySelector('form');
  if (!form) return;

  const fullName = document.getElementById('full_name');
  const email    = document.getElementById('email');
  const dob      = document.getElementById('dob');
  const contact  = document.getElementById('contact_number');
  const pw       = document.getElementById('password');
  const pw2      = document.getElementById('confirm_password');
  const terms    = form.querySelector('input[name="terms"]');

  // Live clear on input
  fullName?.addEventListener('input', () => clearFieldError(fullName, 'full-name-error'));
  email?.addEventListener('input',    () => clearFieldError(email,    'email-error'));
  dob?.addEventListener('change',     () => clearFieldError(dob,      'dob-error'));
  contact?.addEventListener('input',  () => clearFieldError(contact,  'contact-error'));
  pw?.addEventListener('input',       () => clearFieldError(pw,       'pw-error'));

  form.addEventListener('submit', (e) => {
    let valid = true;

    if (!fullName?.value.trim()) {
      showFieldError(fullName, 'full-name-error', 'Full name is required.');
      valid = false;
    }

    if (!email?.value.trim()) {
      showFieldError(email, 'email-error', 'Email is required.');
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
      showFieldError(email, 'email-error', 'Enter a valid email address.');
      valid = false;
    }

    if (!dob?.value) {
      showFieldError(dob, 'dob-error', 'Date of birth is required.');
      valid = false;
    }

    if (!contact?.value.trim()) {
      showFieldError(contact, 'contact-error', 'Contact number is required.');
      valid = false;
    } else if (!/^(09|\+639)\d{9}$/.test(contact.value.trim())) {
      showFieldError(contact, 'contact-error', 'Enter a valid PH number (09XXXXXXXXX).');
      valid = false;
    }

    if (!pw?.value) {
      showFieldError(pw, 'pw-error', 'Password is required.');
      valid = false;
    } else if (pw.value.length < 8) {
      showFieldError(pw, 'pw-error', 'Password must be at least 8 characters.');
      valid = false;
    }

    if (pw?.value && pw2?.value && pw.value !== pw2.value) {
      const err = document.getElementById('confirm-error');
      if (err) err.classList.add('visible');
      pw2.classList.add('is-invalid');
      valid = false;
    }

    if (terms && !terms.checked) {
      showToast('You must agree to the Terms & Conditions.', 'danger');
      valid = false;
    }

    if (!valid) e.preventDefault();
  });
}

// ── OTP INPUT BEHAVIOR ──
function initOTPInput() {
  const boxes = document.querySelectorAll('.otp-box');
  if (!boxes.length) return;

  boxes.forEach((box, i) => {
    box.addEventListener('input', (e) => {
      const val = e.target.value.replace(/\D/g, '');
      box.value = val.slice(-1);
      if (val && i < boxes.length - 1) boxes[i + 1].focus();
      boxes.forEach(b => b.classList.toggle('filled', !!b.value));
      syncHiddenOTP(boxes);
    });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && i > 0) {
        boxes[i - 1].focus();
        boxes[i - 1].value = '';
      }
    });
    box.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
      boxes.forEach((b, j) => { b.value = text[j] || ''; b.classList.toggle('filled', !!text[j]); });
      syncHiddenOTP(boxes);
      boxes[Math.min(text.length, boxes.length - 1)].focus();
    });
  });
}

function syncHiddenOTP(boxes) {
  const hidden = document.getElementById('otp-combined');
  if (hidden) hidden.value = Array.from(boxes).map(b => b.value).join('');
}

// ── OTP TIMER ──
function initOTPTimer() {
  const display   = document.getElementById('timer-display');
  const resendBtn = document.getElementById('resend-btn');
  if (!display) return;

  let secs = 120;
  function tick() {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    display.textContent = `${m}:${s.toString().padStart(2, '0')}`;
    if (secs <= 0) { if (resendBtn) resendBtn.disabled = false; return; }
    secs--;
    setTimeout(tick, 1000);
  }
  tick();
}

// ── RESEND OTP ──
function initResendOTP() {
  const btn = document.getElementById('resend-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    btn.disabled    = true;
    btn.textContent = 'Sending...';
    try {
      const res  = await fetch('/auth/resend-otp', { method: 'POST' });
      const data = await res.json();
      showToast(data.message, data.success ? 'success' : 'danger');
      if (data.success) {
        btn.textContent = 'Resend OTP';
        const disp = document.getElementById('timer-display');
        if (disp) {
          let s = 120;
          const t = setInterval(() => {
            const m = Math.floor(s / 60), sec = s % 60;
            disp.textContent = `${m}:${sec.toString().padStart(2, '0')}`;
            if (s-- <= 0) { clearInterval(t); btn.disabled = false; }
          }, 1000);
        }
      } else {
        btn.disabled    = false;
        btn.textContent = 'Resend OTP';
      }
    } catch (_) {
      showToast('Network error. Try again.', 'danger');
      btn.disabled    = false;
      btn.textContent = 'Resend OTP';
    }
  });
}

// ── FILE UPLOAD PREVIEW ──
function initFileUpload() {
  document.querySelectorAll('.upload-zone').forEach(zone => {
    const input   = zone.querySelector('input[type="file"]');
    const preview = zone.querySelector('.upload-preview');
    if (!input) return;
    input.addEventListener('change', () => {
      const file = input.files[0];
      if (file && preview) { preview.querySelector('.preview-name').textContent = file.name; preview.classList.add('show'); }
    });
    zone.addEventListener('dragover',  (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault(); zone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) { input.files = e.dataTransfer.files; if (preview) { preview.querySelector('.preview-name').textContent = file.name; preview.classList.add('show'); } }
    });
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
  initPasswordStrength();
  initAgeCompute();
  initEmailCheck();
  initConfirmPassword();
  initRegisterValidation();
  initOTPInput();
  initOTPTimer();
  initResendOTP();
  initFileUpload();
  initSubmitLoader();
});