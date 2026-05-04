/* ================================================================
   O_BORROWERS.JS — Loan Officer Borrower Management
   ================================================================ */

(function () {
  'use strict';

  /* ================================================================
     PAGINATION
     ================================================================ */
  const ROWS_PER_PAGE = 10;
  const tableBody = document.getElementById('tableBody');
  const paginationWrap = document.getElementById('paginationWrap');
  const paginationInfo = document.getElementById('paginationInfo');
  const paginationBtns = document.getElementById('paginationBtns');

  let currentPage = 1;
  let allRows = [];

  function initPagination() {
    if (!tableBody) return;
    allRows = Array.from(tableBody.querySelectorAll('tr')).filter(r => r.id !== 'emptyRow');
    renderPage(1);
  }

  function renderPage(page) {
    const total = allRows.length;
    const totalPages = Math.ceil(total / ROWS_PER_PAGE) || 1;
    currentPage = Math.min(page, totalPages);

    const start = (currentPage - 1) * ROWS_PER_PAGE;
    const end = start + ROWS_PER_PAGE;

    allRows.forEach((row, idx) => {
      row.style.display = (idx >= start && idx < end) ? '' : 'none';
    });

    if (!paginationWrap) return;
    paginationWrap.style.display = total > ROWS_PER_PAGE ? 'flex' : 'none';
    if (total <= ROWS_PER_PAGE) return;

    const from = start + 1;
    const to = Math.min(end, total);
    paginationInfo.textContent = `Showing ${from}–${to} of ${total} borrowers`;

    paginationBtns.innerHTML = '';

    // Prev button
    const prev = document.createElement('button');
    prev.className = 'page-btn';
    prev.innerHTML = '‹ Prev';
    prev.disabled = currentPage <= 1;
    prev.addEventListener('click', () => renderPage(currentPage - 1));
    paginationBtns.appendChild(prev);

    // Page numbers
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    for (let p = startPage; p <= endPage; p++) {
      const btn = document.createElement('button');
      btn.className = 'page-btn' + (p === currentPage ? ' active' : '');
      btn.textContent = p;
      btn.addEventListener('click', () => renderPage(p));
      paginationBtns.appendChild(btn);
    }

    // Next button
    const next = document.createElement('button');
    next.className = 'page-btn';
    next.innerHTML = 'Next ›';
    next.disabled = currentPage >= totalPages;
    next.addEventListener('click', () => renderPage(currentPage + 1));
    paginationBtns.appendChild(next);
  }

  initPagination();

})();

