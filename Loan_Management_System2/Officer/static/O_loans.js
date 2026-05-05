/* ================================================================
   O_LOANS.JS — Officer Active Loans Page
   Core (sidebar / dropdown / flash-dismiss) handled by hiraya_officer_core.js
   ================================================================ */

(function () {
  'use strict';

  /* ── HIGHLIGHT OVERDUE ROWS ─────────────────────────────────── */
  document.querySelectorAll('.row-overdue').forEach(row => {
    row.style.borderLeft = '3px solid var(--danger)';
  });

})();