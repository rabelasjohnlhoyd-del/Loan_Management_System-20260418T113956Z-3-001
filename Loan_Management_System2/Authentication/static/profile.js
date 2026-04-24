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

// ── USER DROPDOWN TOGGLE ──
function initUserDropdown() {
  const toggle   = document.getElementById('userDropdownToggle');
  const dropdown = document.getElementById('userDropdown');

  if (!toggle || !dropdown) return;

  // Force pointer cursor and correct stacking via JS
  toggle.style.cursor   = 'pointer';
  toggle.style.position = 'relative';
  toggle.style.zIndex   = '200';

  toggle.addEventListener('click', function (e) {
    e.stopPropagation();
    const isOpen = dropdown.classList.contains('open');
    dropdown.classList.toggle('open', !isOpen);
    toggle.classList.toggle('open', !isOpen);
  });

  // Close when clicking outside
  document.addEventListener('click', function (e) {
    if (!toggle.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.remove('open');
      toggle.classList.remove('open');
    }
  });
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  initFlash();
  initActiveNav();
  initUserDropdown();
});