/* ============================================
   profile.js — Loan Management System
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

// ── ACTIVE NAV HIGHLIGHT ──
function initActiveNav() {
  const path = window.location.pathname;
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.href && item.href.includes(path)) {
      item.classList.add('active');
    }
  });
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  initFlash();
  initActiveNav();
});