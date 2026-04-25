/**
 * payment_history.js
 * Features: filter (status + date range), search, sort by column,
 *           pagination, print, export CSV, amount tooltip, rejected reason tooltip.
 */

(function () {
  'use strict';

  /* ─────────────────────────────────────────────────────────────
     STATE
  ───────────────────────────────────────────────────────────── */
  let currentPage  = 1;
  let pageSize     = 10;
  let sortCol      = -1;      // -1 = no sort
  let sortDir      = 'asc';   // 'asc' | 'desc'
  let filteredRows = [];      // rows that pass current filters

  /* ─────────────────────────────────────────────────────────────
     APPLY FILTERS  (status + date range + search)
  ───────────────────────────────────────────────────────────── */
  window.applyFilters = function () {
    const status    = document.getElementById('filterStatus').value.toLowerCase();
    const query     = document.getElementById('searchInput').value.toLowerCase().trim();
    const dateFrom  = document.getElementById('dateFrom').value;   // 'YYYY-MM-DD' or ''
    const dateTo    = document.getElementById('dateTo').value;

    const allRows = Array.from(document.querySelectorAll('.ph-row'));

    filteredRows = allRows.filter(row => {
      const rowStatus = (row.dataset.status  || '').toLowerCase();
      const rowSearch = (row.dataset.search  || '').toLowerCase();
      const rowDate   = (row.dataset.date    || '');               // 'YYYY-MM-DD'

      const matchStatus = !status   || rowStatus === status;
      const matchSearch = !query    || rowSearch.includes(query);
      const matchFrom   = !dateFrom || rowDate >= dateFrom;
      const matchTo     = !dateTo   || rowDate <= dateTo;

      return matchStatus && matchSearch && matchFrom && matchTo;
    });

    // Reset to page 1 on any filter change, then re-render
    currentPage = 1;
    renderPage();
  };

  /* ─────────────────────────────────────────────────────────────
     CLEAR DATE FILTER
  ───────────────────────────────────────────────────────────── */
  window.clearDateFilter = function () {
    document.getElementById('dateFrom').value = '';
    document.getElementById('dateTo').value   = '';
    applyFilters();
  };

  /* ─────────────────────────────────────────────────────────────
     SORT BY COLUMN
  ───────────────────────────────────────────────────────────── */
  function initSortHeaders () {
    document.querySelectorAll('.th-sort').forEach(th => {
      th.addEventListener('click', () => {
        const col = parseInt(th.dataset.col, 10);

        if (sortCol === col) {
          // Toggle direction
          sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          sortCol = col;
          sortDir = 'asc';
        }

        // Update header classes
        document.querySelectorAll('.th-sort').forEach(h => {
          h.classList.remove('asc', 'desc');
        });
        th.classList.add(sortDir);

        sortRows();
        renderPage();
      });
    });
  }

  function sortRows () {
    if (sortCol < 0) return;

    filteredRows.sort((a, b) => {
      const cellA = a.querySelectorAll('td')[sortCol];
      const cellB = b.querySelectorAll('td')[sortCol];
      if (!cellA || !cellB) return 0;

      let valA = cellA.textContent.trim();
      let valB = cellB.textContent.trim();

      // For the date column (index 5), use raw ISO date stored in data-raw-date
      if (sortCol === 5) {
        valA = cellA.dataset.rawDate || valA;
        valB = cellB.dataset.rawDate || valB;
      }

      // For the amount column (index 3), strip currency symbols and parse as number
      if (sortCol === 3) {
        const numA = parseFloat(valA.replace(/[₱P,]/g, '')) || 0;
        const numB = parseFloat(valB.replace(/[₱P,]/g, '')) || 0;
        return sortDir === 'asc' ? numA - numB : numB - numA;
      }

      // Default: string compare
      return sortDir === 'asc'
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    });
  }

  /* ─────────────────────────────────────────────────────────────
     RENDER PAGE  (applies current filteredRows + currentPage)
  ───────────────────────────────────────────────────────────── */
  function renderPage () {
    const tbody  = document.getElementById('historyBody');
    const noRes  = document.getElementById('noResults');
    const count  = document.getElementById('recordCount');
    const allRows = Array.from(document.querySelectorAll('.ph-row'));

    // Hide ALL rows first
    allRows.forEach(r => r.style.display = 'none');

    if (filteredRows.length === 0) {
      noRes && noRes.classList.remove('hidden');
      count && (count.textContent = '0 record(s)');
      renderPagination(0);
      return;
    }

    noRes && noRes.classList.add('hidden');

    // Pagination slice
    const start = (currentPage - 1) * pageSize;
    const end   = start + pageSize;
    const pageRows = filteredRows.slice(start, end);

    // Move rows into tbody in sorted order, then show visible slice
    // We re-append to preserve sort order in DOM
    filteredRows.forEach(row => tbody.appendChild(row));

    // Show only the page slice
    pageRows.forEach(r => r.style.display = '');

    count && (count.textContent = filteredRows.length + ' record(s)');
    renderPagination(filteredRows.length);
  }

  /* ─────────────────────────────────────────────────────────────
     PAGINATION CONTROLS
  ───────────────────────────────────────────────────────────── */
  function renderPagination (total) {
    const totalPages = Math.ceil(total / pageSize) || 1;
    const info       = document.getElementById('paginationInfo');
    const pageNums   = document.getElementById('pageNums');
    const btnPrev    = document.getElementById('btnPrev');
    const btnNext    = document.getElementById('btnNext');
    const wrap       = document.getElementById('paginationControls');

    if (!wrap) return;

    // Hide pagination entirely if everything fits on one page
    wrap.style.display = total <= pageSize ? 'none' : 'flex';

    if (info) {
      const start = Math.min((currentPage - 1) * pageSize + 1, total);
      const end   = Math.min(currentPage * pageSize, total);
      info.textContent = `Showing ${start}–${end} of ${total} records`;
    }

    if (btnPrev) btnPrev.disabled = currentPage <= 1;
    if (btnNext) btnNext.disabled = currentPage >= totalPages;

    if (pageNums) {
      pageNums.innerHTML = '';

      // Show max 5 page number buttons centered around current page
      let startPage = Math.max(1, currentPage - 2);
      let endPage   = Math.min(totalPages, startPage + 4);
      if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);

      for (let p = startPage; p <= endPage; p++) {
        const btn = document.createElement('button');
        btn.className = 'ph-page-num' + (p === currentPage ? ' active' : '');
        btn.textContent = p;
        btn.addEventListener('click', () => {
          currentPage = p;
          renderPage();
        });
        pageNums.appendChild(btn);
      }
    }
  }

  window.changePage = function (delta) {
    const total      = filteredRows.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    currentPage = Math.max(1, Math.min(currentPage + delta, totalPages));
    renderPage();
  };

  window.changePageSize = function () {
    pageSize    = parseInt(document.getElementById('pageSize').value, 10);
    currentPage = 1;
    renderPage();
  };

  /* ─────────────────────────────────────────────────────────────
     PRINT
  ───────────────────────────────────────────────────────────── */
  window.printHistory = function () {
    // Populate print header meta line
    const meta = document.getElementById('printMeta');
    if (meta) {
      const borrower = document.querySelector('.s-user-info h4')?.textContent?.trim() || '';
      const now = new Date().toLocaleDateString('en-PH', {
        year: 'numeric', month: 'long', day: 'numeric'
      });
      meta.textContent = (borrower ? borrower + '  •  ' : '') + 'Printed on: ' + now;
    }
    window.print();
  };

  /* ─────────────────────────────────────────────────────────────
     EXPORT CSV
  ───────────────────────────────────────────────────────────── */
  window.exportCSV = function () {
    const headers = [
      'Payment No.',
      'Loan Reference',
      'Loan Type',
      'Amount (PHP)',
      'Payment Method',
      'Payment Date',
      'Status',
    ];

    const now      = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
    const titleRow = ['"Hiraya Management System — Payment History"'];
    const dateRow  = ['"Exported on: ' + now + '"'];
    const blank    = [''];

    const clean = v => '"' + (v || '—').replace(/"/g, '""').trim() + '"';

    const lines = [
      titleRow.join(','),
      dateRow.join(','),
      blank.join(','),
      headers.map(clean).join(','),
    ];

    // Export only currently filtered rows (all pages, not just current page)
    filteredRows.forEach(row => {
      const cells  = row.querySelectorAll('td');
      const amount = (cells[3]?.textContent.trim() || '').replace(/[₱P,]/g, '').trim();
      const rowData = [
        cells[0]?.textContent.trim(),
        cells[1]?.textContent.trim(),
        cells[2]?.textContent.trim(),
        amount,
        cells[4]?.textContent.trim(),
        cells[5]?.textContent.trim(),
        cells[6]?.textContent.trim(),
      ].map(clean);
      lines.push(rowData.join(','));
    });

    const BOM  = '\uFEFF';
    const blob = new Blob([BOM + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'Hiraya_PaymentHistory_' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ─────────────────────────────────────────────────────────────
     AUTO-HIDE FLASH MESSAGES
  ───────────────────────────────────────────────────────────── */
  setTimeout(() => {
    document.querySelectorAll('.flash-msg').forEach(el => el.remove());
  }, 4000);

  /* ─────────────────────────────────────────────────────────────
     INIT
  ───────────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    // Populate filteredRows with ALL rows at start
    filteredRows = Array.from(document.querySelectorAll('.ph-row'));
    initSortHeaders();
    renderPage();
  });

})();