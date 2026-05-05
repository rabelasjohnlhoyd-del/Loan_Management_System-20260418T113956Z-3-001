/* ================================================================
   O_BORROWER_DETAIL.JS — Borrower Detail Page
   Core (sidebar/notif/dropdown) handled by hiraya_officer_core.js
   ================================================================ */

(function () {
  'use strict';

  const ROWS_PER_PAGE = 8;

  /* ── LOAN HISTORY PAGINATION ─────────────────────────────── */
  function initLoanPagination() {
    const tbody      = document.getElementById('loanHistoryBody');
    const paginWrap  = document.getElementById('loanPaginationContainer');
    const paginInfo  = document.getElementById('loanPaginationInfo');
    const paginBtns  = document.getElementById('loanPaginationButtons');

    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll('tr.loan-row'));
    if (rows.length === 0 || rows.length <= ROWS_PER_PAGE) return;

    if (paginWrap) paginWrap.style.display = 'flex';

    let currentPage = 1;
    const totalPages = Math.ceil(rows.length / ROWS_PER_PAGE);

    // Update total count chip
    const countChip = document.getElementById('loanTotalCount');
    if (countChip) countChip.textContent = `${rows.length} loan(s)`;

    function renderPage(page) {
      currentPage = Math.min(Math.max(page, 1), totalPages);
      const start = (currentPage - 1) * ROWS_PER_PAGE;
      const end   = start + ROWS_PER_PAGE;

      rows.forEach((row, i) => {
        row.style.display = i >= start && i < end ? '' : 'none';
      });

      if (paginInfo) {
        paginInfo.textContent =
          `Showing ${start + 1}–${Math.min(end, rows.length)} of ${rows.length} loans`;
      }

      if (!paginBtns) return;
      paginBtns.innerHTML = '';

      // Prev button
      const prev = document.createElement('button');
      prev.textContent = '‹ Prev';
      prev.className   = 'page-btn';
      prev.type        = 'button';
      prev.disabled    = currentPage === 1;
      prev.onclick     = () => renderPage(currentPage - 1);
      paginBtns.appendChild(prev);

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
        paginBtns.appendChild(btn);
      }

      // Next button
      const next = document.createElement('button');
      next.textContent = 'Next ›';
      next.className   = 'page-btn';
      next.type        = 'button';
      next.disabled    = currentPage === totalPages;
      next.onclick     = () => renderPage(currentPage + 1);
      paginBtns.appendChild(next);
    }

    renderPage(1);
  }

  /* ── SCORE BAR ANIMATION ─────────────────────────────────── */
  function animateScoreBars() {
    document.querySelectorAll('.score-bar-fill').forEach(bar => {
      const target = bar.style.width;
      bar.style.width = '0';
      requestAnimationFrame(() => {
        bar.style.transition = 'width 0.75s cubic-bezier(0.4,0,0.2,1)';
        bar.style.width = target;
      });
    });
  }

  /* ── SAVE CONFIRM (update score form) ───────────────────── */
  const updateForm = document.querySelector('.update-form');
  updateForm?.addEventListener('submit', (e) => {
    const scoreInput = updateForm.querySelector('input[name="credit_score"]');
    const score      = parseInt(scoreInput?.value || 0);

    if (score < 300 || score > 850) {
      e.preventDefault();
      alert('Credit score must be between 300 and 850.');
      scoreInput?.focus();
      return;
    }

    if (!confirm('Save changes to credit score and risk level?')) {
      e.preventDefault();
    }
  });

  /* ── INIT ────────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initLoanPagination();
    });
  } else {
    initLoanPagination();
  }

  window.addEventListener('load', animateScoreBars);

})();