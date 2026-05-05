/* ================================================================
   O_APPLICATION_DETAIL.JS — Application Detail Page
   Core (sidebar/notif/dropdown) handled by hiraya_officer_core.js
   ================================================================ */

(function () {
  'use strict';

  /* ── ANIMATE CREDIT SCORE BAR ON LOAD ──────────────────────── */
  window.addEventListener('load', () => {
    document.querySelectorAll('.score-bar-fill').forEach(bar => {
      const target = bar.style.width;
      bar.style.width = '0';
      requestAnimationFrame(() => {
        bar.style.transition = 'width 0.7s cubic-bezier(0.4,0,0.2,1)';
        bar.style.width = target;
      });
    });
  });

  /* ── RADIO OPTION HIGHLIGHT ──────────────────────────────────── */
  document.querySelectorAll('.radio-option input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', () => {
      document.querySelectorAll('.radio-option').forEach(opt => {
        opt.style.borderColor = '';
        opt.style.background  = '';
      });
      if (radio.checked) {
        const opt = radio.closest('.radio-option');
        if (opt) {
          opt.style.borderColor = 'var(--primary)';
          opt.style.background  = 'var(--primary-light)';
        }
      }
    });
  });

  /* ── CONFIRM BEFORE SUBMIT ──────────────────────────────────── */
  const form = document.querySelector('.recommend-form');
  form?.addEventListener('submit', (e) => {
    const selected = form.querySelector('input[name="recommendation"]:checked');
    if (!selected) return; // browser will show required validation
    const label = selected.value === 'under_review' ? 'Mark for Review' : 'Flag for Attention';
    if (!confirm(`Submit recommendation: "${label}"? This action will be logged.`)) {
      e.preventDefault();
    }
  });

})();