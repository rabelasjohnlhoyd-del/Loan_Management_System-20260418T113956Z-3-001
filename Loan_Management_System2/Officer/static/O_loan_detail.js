/* ================================================================
   O_LOAN_DETAIL.JS — Officer Loan Detail Page
   Core (sidebar / dropdown / flash-dismiss) handled by hiraya_officer_core.js
   ================================================================ */

(function () {
  'use strict';

  /* ── ANIMATE PROGRESS BARS ON LOAD ─────────────────────────── */
  window.addEventListener('load', () => {
    document.querySelectorAll('.progress-bar-fill').forEach(bar => {
      const target = bar.style.width;
      bar.style.width = '0';
      requestAnimationFrame(() => {
        bar.style.transition = 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)';
        bar.style.width = target;
      });
    });

    document.querySelectorAll('.balance-bar-fill').forEach(bar => {
      const target = bar.style.width;
      bar.style.width = '0';
      requestAnimationFrame(() => {
        bar.style.transition = 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
        bar.style.width = target;
      });
    });
  });

})();