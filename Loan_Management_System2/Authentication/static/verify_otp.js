/* ============================================
   verify_otp.js — Loan Management System
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

// ── OTP BOX NAVIGATION ──
function initOtpBoxes() {
  const boxes = Array.from(document.querySelectorAll('.otp-box'));
  if (!boxes.length) return;

  // Auto-focus first box
  boxes[0].focus();

  boxes.forEach((box, idx) => {
    // Allow digits only
    box.addEventListener('keydown', (e) => {
      const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight'];
      if (allowed.includes(e.key)) return;
      if (/^\d$/.test(e.key)) return;
      e.preventDefault();
    });

    box.addEventListener('input', () => {
      // Strip non-digits, keep only last char
      box.value = box.value.replace(/\D/g, '').slice(-1);

      if (box.value) {
        box.classList.add('is-filled');
        box.classList.remove('is-error');
        // Advance to next
        if (idx < boxes.length - 1) boxes[idx + 1].focus();
      } else {
        box.classList.remove('is-filled');
      }

      clearOtpError();
    });

    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && idx > 0) {
        boxes[idx - 1].focus();
        boxes[idx - 1].value = '';
        boxes[idx - 1].classList.remove('is-filled');
      }
      if (e.key === 'ArrowLeft' && idx > 0)               boxes[idx - 1].focus();
      if (e.key === 'ArrowRight' && idx < boxes.length - 1) boxes[idx + 1].focus();
    });

    // Handle paste on any box — distribute digits
    box.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData || window.clipboardData)
        .getData('text').replace(/\D/g, '').slice(0, 6);
      pasted.split('').forEach((char, i) => {
        if (boxes[i]) {
          boxes[i].value = char;
          boxes[i].classList.add('is-filled');
        }
      });
      // Focus last filled or next empty
      const nextEmpty = boxes.find(b => !b.value);
      (nextEmpty || boxes[boxes.length - 1]).focus();
      clearOtpError();
    });
  });
}

// ── WIRE HIDDEN INPUTS BEFORE SUBMIT ──
function initFormSubmit() {
  const form   = document.querySelector('form');
  const boxes  = document.querySelectorAll('.otp-box');
  const verBtn = document.getElementById('verify-btn');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    const vals = Array.from(boxes).map(b => b.value);
    const complete = vals.every(v => /^\d$/.test(v));

    if (!complete) {
      e.preventDefault();
      showOtpError('Please fill in all 6 digits.');
      boxes.forEach(b => {
        if (!b.value) b.classList.add('is-error');
      });
      boxes.find(b => !b.value)?.focus();
      return;
    }

    // Populate hidden inputs
    vals.forEach((v, i) => {
      const h = document.getElementById('h' + (i + 1));
      if (h) h.value = v;
    });

    // Loader state
    if (verBtn) {
      verBtn.disabled  = true;
      verBtn.innerHTML = 'Verifying...';
      setTimeout(() => {
        verBtn.disabled  = false;
        verBtn.innerHTML = 'VERIFY &amp; CONTINUE';
      }, 8000);
    }
  });
}

// ── OTP ERROR ──
function showOtpError(msg) {
  const err = document.getElementById('otp-error');
  if (!err) return;
  err.textContent = msg;
  err.style.display = 'block';
}

function clearOtpError() {
  const err = document.getElementById('otp-error');
  if (err) { err.textContent = ''; err.style.display = 'none'; }
}

// ── COUNTDOWN TIMER ──
function initTimer() {
  const display   = document.getElementById('timer-display');
  const resendBtn = document.getElementById('resend-btn');
  if (!display || !resendBtn) return;

  let seconds = 120; // 2:00

  const tick = () => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    display.textContent = `${m}:${s.toString().padStart(2, '0')}`;

    if (seconds <= 0) {
      display.textContent = '0:00';
      display.classList.add('expired');
      resendBtn.disabled = false;
      clearInterval(interval);
    } else {
      seconds--;
    }
  };

  tick();
  const interval = setInterval(tick, 1000);

  // Resend click — reset timer
  resendBtn.addEventListener('click', () => {
    resendBtn.disabled = true;
    display.classList.remove('expired');
    seconds = 120;

    // Show toast confirmation
    showToast('A new OTP has been sent to your email.', 'success');

    const newInterval = setInterval(() => {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      display.textContent = `${m}:${s.toString().padStart(2, '0')}`;
      if (seconds <= 0) {
        display.textContent = '0:00';
        display.classList.add('expired');
        resendBtn.disabled = false;
        clearInterval(newInterval);
      } else {
        seconds--;
      }
    }, 1000);
  });
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

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  initFlash();
  initOtpBoxes();
  initFormSubmit();
  initTimer();
});