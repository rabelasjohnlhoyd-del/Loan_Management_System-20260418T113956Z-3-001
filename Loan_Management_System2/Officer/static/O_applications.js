/* ================================================================
   O_APPLICATIONS.JS — Applications Page
   Core (sidebar/notif/dropdown) handled by hiraya_officer_core.js
   ================================================================ */

(function () {
  'use strict';

  /* ── CLIENT-SIDE PAGINATION — 10 rows/page ──────────────────── */
  const ROWS_PER_PAGE = 10;

  function initAppPagination() {
    const tbody = document.getElementById('appTableBody');
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll('tr.app-row'));
    if (rows.length === 0) return;

    const totalPages = Math.ceil(rows.length / ROWS_PER_PAGE);
    if (totalPages <= 1) return; // no pagination needed

    const container  = document.getElementById('appPaginationContainer');
    const infoDiv    = document.getElementById('appPaginationInfo');
    const btnsDiv    = document.getElementById('appPaginationButtons');

    if (!container) return;
    container.style.display = 'flex';

    let currentPage = 1;

    function renderPage(page) {
      currentPage = Math.min(Math.max(page, 1), totalPages);
      const start = (currentPage - 1) * ROWS_PER_PAGE;
      const end   = start + ROWS_PER_PAGE;

      rows.forEach((row, i) => {
        row.style.display = i >= start && i < end ? '' : 'none';
      });

      if (infoDiv) {
        infoDiv.textContent =
          `Showing ${start + 1}–${Math.min(end, rows.length)} of ${rows.length} applications`;
      }

      // Rebuild buttons
      if (!btnsDiv) return;
      btnsDiv.innerHTML = '';

      // Prev
      const prev = document.createElement('button');
      prev.textContent = '‹ Prev';
      prev.className   = 'page-btn';
      prev.type        = 'button';
      prev.disabled    = currentPage === 1;
      prev.onclick     = () => renderPage(currentPage - 1);
      btnsDiv.appendChild(prev);

      // Page numbers (window of 5)
      const maxV = 5;
      let sp = Math.max(1, currentPage - Math.floor(maxV / 2));
      let ep = Math.min(totalPages, sp + maxV - 1);
      if (ep - sp < maxV - 1) sp = Math.max(1, ep - maxV + 1);

      for (let p = sp; p <= ep; p++) {
        const btn = document.createElement('button');
        btn.textContent = p;
        btn.className   = 'page-num' + (p === currentPage ? ' active' : '');
        btn.type        = 'button';
        btn.onclick     = () => renderPage(p);
        btnsDiv.appendChild(btn);
      }

      // Next
      const next = document.createElement('button');
      next.textContent = 'Next ›';
      next.className   = 'page-btn';
      next.type        = 'button';
      next.disabled    = currentPage === totalPages;
      next.onclick     = () => renderPage(currentPage + 1);
      btnsDiv.appendChild(next);

      // Update result count chip
      const resultCount = document.getElementById('resultCount');
      if (resultCount) resultCount.textContent = rows.length;
    }

    renderPage(1);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAppPagination);
  } else {
    initAppPagination();
  }

})();