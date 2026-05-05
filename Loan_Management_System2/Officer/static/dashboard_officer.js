/* ================================================================
   DASHBOARD_OFFICER.JS — Dashboard-specific JS only
   Sidebar/notif/dropdown handled by hiraya_officer_core.js
   ================================================================ */

(function () {
  'use strict';

  /* ── TABLE SEARCH + PAGINATION ──────────────────────────────── */
  const ROWS_PER_PAGE = 10;
  const tableBody     = document.getElementById('appTableBody');
  const paginWrap     = document.getElementById('paginationWrap');
  const paginInfo     = document.getElementById('paginationInfo');
  const pageNumbers   = document.getElementById('pageNumbers');
  const pagePrev      = document.getElementById('pagePrev');
  const pageNext      = document.getElementById('pageNext');
  const appSearch     = document.getElementById('appSearch');

  let currentPage  = 1;
  let allRows      = [];
  let filteredRows = [];

  function initPagination() {
    if (!tableBody) return;
    allRows = Array.from(tableBody.querySelectorAll('tr')).filter(
      r => !r.id || r.id !== 'emptyRow'
    );
    filteredRows = [...allRows];
    renderPage(1);
  }

  function renderPage(page) {
    currentPage = page;
    const total      = filteredRows.length;
    const totalPages = Math.ceil(total / ROWS_PER_PAGE) || 1;
    const start      = (page - 1) * ROWS_PER_PAGE;
    const end        = Math.min(start + ROWS_PER_PAGE, total);

    allRows.forEach(r => (r.style.display = 'none'));
    filteredRows.forEach((r, idx) => {
      r.style.display = idx >= start && idx < end ? '' : 'none';
    });

    const emptyRow = document.getElementById('emptyRow');
    if (emptyRow) emptyRow.style.display = total === 0 ? '' : 'none';

    if (total <= ROWS_PER_PAGE && !appSearch?.value.trim()) {
      paginWrap?.classList.add('hidden');
      return;
    }
    paginWrap?.classList.remove('hidden');

    if (paginInfo) {
      paginInfo.textContent = total === 0
        ? 'No results found'
        : `Showing ${start + 1}–${end} of ${total} application${total !== 1 ? 's' : ''}`;
    }

    if (pagePrev) pagePrev.disabled = page <= 1;
    if (pageNext) pageNext.disabled = page >= totalPages;

    if (pageNumbers) {
      pageNumbers.innerHTML = '';
      const maxV = 5;
      let sp = Math.max(1, page - Math.floor(maxV / 2));
      let ep = Math.min(totalPages, sp + maxV - 1);
      if (ep - sp < maxV - 1) sp = Math.max(1, ep - maxV + 1);

      for (let p = sp; p <= ep; p++) {
        const btn = document.createElement('button');
        btn.className = 'page-num' + (p === page ? ' active' : '');
        btn.textContent = p;
        btn.type = 'button';
        btn.addEventListener('click', () => renderPage(p));
        pageNumbers.appendChild(btn);
      }
    }
  }

  pagePrev?.addEventListener('click', () => { if (currentPage > 1) renderPage(currentPage - 1); });
  pageNext?.addEventListener('click', () => {
    const tp = Math.ceil(filteredRows.length / ROWS_PER_PAGE) || 1;
    if (currentPage < tp) renderPage(currentPage + 1);
  });

  appSearch?.addEventListener('input', () => {
    const q = appSearch.value.trim().toLowerCase();
    filteredRows = q ? allRows.filter(r => r.textContent.toLowerCase().includes(q)) : [...allRows];
    renderPage(1);
  });

  initPagination();

})();