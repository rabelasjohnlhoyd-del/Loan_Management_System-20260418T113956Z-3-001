/* ================================================================
   O_BORROWER_DETAIL.JS — Loan Officer Borrower Detail
   ================================================================ */

(function () {
  'use strict';

  // Active nav highlight
  const currentPath = window.location.pathname;
  document.querySelectorAll('.nav-item[href]').forEach((el) => {
    const href = el.getAttribute('href');
    if (href && href !== '#' && currentPath.startsWith(href) && href !== '/') {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      el.classList.add('active');
    }
  });

  /* ================================================================
     LOAN HISTORY PAGINATION - 5 rows per page
     ================================================================ */
  function initLoanPagination() {
    const tbody = document.getElementById('loanHistoryBody');
    if (!tbody) return;
    
    const rows = Array.from(tbody.querySelectorAll('tr.loan-row'));
    if (rows.length === 0) return;
    
    const ROWS_PER_PAGE = 5;
    let currentPage = 1;
    const totalPages = Math.ceil(rows.length / ROWS_PER_PAGE);
    
    const container = document.getElementById('loanPaginationContainer');
    const infoDiv = document.getElementById('loanPaginationInfo');
    const btnsDiv = document.getElementById('loanPaginationButtons');
    
    if (!container || !infoDiv || !btnsDiv) return;
    
    function renderPage(page) {
      currentPage = Math.min(Math.max(page, 1), totalPages);
      const start = (currentPage - 1) * ROWS_PER_PAGE;
      const end = start + ROWS_PER_PAGE;
      
      // Show/hide rows
      rows.forEach((row, index) => {
        row.style.display = (index >= start && index < end) ? '' : 'none';
      });
      
      // Update info
      const from = start + 1;
      const to = Math.min(end, rows.length);
      infoDiv.textContent = `Showing ${from}–${to} of ${rows.length} loans`;
      
      // Update buttons
      btnsDiv.innerHTML = '';
      
      // Prev button
      const prevBtn = document.createElement('button');
      prevBtn.textContent = '‹ Prev';
      prevBtn.className = 'page-btn';
      prevBtn.disabled = currentPage === 1;
      prevBtn.onclick = () => renderPage(currentPage - 1);
      btnsDiv.appendChild(prevBtn);
      
      // Page numbers
      const maxVisible = 3;
      let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
      let endPage = Math.min(totalPages, startPage + maxVisible - 1);
      
      if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
      }
      
      for (let p = startPage; p <= endPage; p++) {
        const btn = document.createElement('button');
        btn.textContent = p;
        btn.className = 'page-btn' + (p === currentPage ? ' active' : '');
        btn.onclick = () => renderPage(p);
        btnsDiv.appendChild(btn);
      }
      
      // Next button
      const nextBtn = document.createElement('button');
      nextBtn.textContent = 'Next ›';
      nextBtn.className = 'page-btn';
      nextBtn.disabled = currentPage === totalPages;
      nextBtn.onclick = () => renderPage(currentPage + 1);
      btnsDiv.appendChild(nextBtn);
      
      // Show/hide pagination container
      if (rows.length <= ROWS_PER_PAGE) {
        container.style.display = 'none';
      } else {
        container.style.display = 'flex';
      }
    }
    
    renderPage(1);
  }
  
  // Run pagination when page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLoanPagination);
  } else {
    initLoanPagination();
  }

  // Auto-dismiss flash messages
  setTimeout(() => {
    document.querySelectorAll('.flash-msg').forEach(el => el.remove());
  }, 5000);

})();