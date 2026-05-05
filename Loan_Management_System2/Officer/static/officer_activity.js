/* ================================================================
   OFFICER_ACTIVITY.JS — Officer Activity Log Page
   Core (sidebar / dropdown / flash-dismiss) handled by hiraya_officer_core.js
   ================================================================ */

(function () {
  'use strict';

  /* ── TIMELINE ENTRANCE ANIMATION ───────────────────────────── */
  window.addEventListener('load', () => {
    const items = document.querySelectorAll('.timeline-item');
    items.forEach((item, i) => {
      item.style.opacity = '0';
      item.style.transform = 'translateX(-12px)';
      setTimeout(() => {
        item.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
        item.style.opacity = '1';
        item.style.transform = 'translateX(0)';
      }, i * 30);
    });
  });

})();