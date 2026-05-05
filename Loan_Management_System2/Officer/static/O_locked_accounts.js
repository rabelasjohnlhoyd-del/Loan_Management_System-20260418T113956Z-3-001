/* ================================================================
   O_LOCKED_ACCOUNTS.JS — Officer Locked Accounts Page
   Core logic (sidebar / user dropdown / notifications / flash-dismiss)
   is fully handled by hiraya_officer_core.js — do NOT duplicate here.
   ================================================================ */
(function () {
  'use strict';

  /* ── TABLE ROW HOVER HIGHLIGHT ──────────────────────────────── */
  document.querySelectorAll('.locked-table tbody tr').forEach(row => {
    row.addEventListener('mouseenter', () => row.style.background = 'var(--gray-50, #f9fafb)');
    row.addEventListener('mouseleave', () => row.style.background = '');
  });

})();