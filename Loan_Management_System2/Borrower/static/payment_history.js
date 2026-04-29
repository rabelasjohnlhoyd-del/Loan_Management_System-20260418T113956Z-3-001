/**
 * payment_history.js
 * Features: filter (status + date range), search, sort by column,
 *           pagination, print, export CSV, amount tooltip, rejected reason tooltip.
 *           NOTIFICATIONS DROPDOWN + PAYMENT RECEIPT VIEWING
 */

(function () {
  'use strict';

  /* ================================================================
     SIDEBAR TOGGLE — same logic as dashboard
  ================================================================ */
  const burgerBtn      = document.getElementById('burgerBtn');
  const sidebar        = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const SIDEBAR_KEY    = 'hiraya_sidebar_open';
  const isMobile       = () => window.innerWidth <= 768;

  function openSidebar() {
    document.body.classList.add('sidebar-open');
    if (isMobile()) sidebarOverlay.classList.add('active');
    if (!isMobile()) localStorage.setItem(SIDEBAR_KEY, '1');
  }

  function closeSidebar() {
    document.body.classList.remove('sidebar-open');
    sidebarOverlay.classList.remove('active');
    if (!isMobile()) localStorage.setItem(SIDEBAR_KEY, '0');
  }

  function toggleSidebar() {
    document.body.classList.contains('sidebar-open') ? closeSidebar() : openSidebar();
  }

  if (!isMobile() && localStorage.getItem(SIDEBAR_KEY) !== '0') openSidebar();

  burgerBtn?.addEventListener('click', toggleSidebar);
  sidebarOverlay?.addEventListener('click', closeSidebar);

  sidebar?.querySelectorAll('.nav-item, .user-dropdown a').forEach(link => {
    link.addEventListener('click', () => { if (isMobile()) closeSidebar(); });
  });

  window.addEventListener('resize', () => {
    if (!isMobile()) {
      sidebarOverlay.classList.remove('active');
      if (localStorage.getItem(SIDEBAR_KEY) !== '0') openSidebar();
    } else {
      closeSidebar();
    }
  });

  /* ================================================================
     USER DROPDOWN
  ================================================================ */
  const userToggle   = document.getElementById('userDropdownToggle');
  const userDropdown = document.getElementById('userDropdown');

  if (userToggle && userDropdown) {
    userToggle.addEventListener('click', function (e) {
      e.stopPropagation();
      userDropdown.classList.toggle('open');
      userToggle.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (!userToggle.contains(e.target) && !userDropdown.contains(e.target)) {
        userDropdown.classList.remove('open');
        userToggle.classList.remove('open');
      }
    });
  }

  /* ================================================================
     NOTIFICATIONS DROPDOWN
  ================================================================ */
  /* ================================================================
     NOTIFICATIONS DROPDOWN - (COPY FROM WORKING make_payment.js)
  ================================================================ */
  const notifBtn      = document.getElementById('notifBtn');
  const notifDropdown = document.getElementById('notifDropdown');
  const notifDot      = document.getElementById('notifDot');
  const notifList     = document.getElementById('notifList');
  const notifMarkAll  = document.getElementById('notifMarkAll');

  function fetchUnreadCount() {
    fetch('/loans/api/notifications/count')
      .then(r => r.json())
      .then(data => {
        if (data.count > 0) notifDot?.classList.remove('hidden');
        else                notifDot?.classList.add('hidden');
      }).catch(() => {});
  }

  fetchUnreadCount();
  setInterval(fetchUnreadCount, 60000);

  function fetchNotifications() {
    if (!notifList) return;
    notifList.innerHTML = '<div class="notif-loading"><div class="notif-spinner"></div><span>Loading...</span></div>';
    fetch('/loans/api/notifications')
      .then(r => r.json())
      .then(data => {
        const items = data.notifications || [];
        if (items.length === 0) {
          notifList.innerHTML = '<div class="notif-empty"><p>You\'re all caught up!</p><small>No new notifications</small></div>';
          return;
        }
        notifList.innerHTML = items.map(n => {
          const unread = !n.is_read;
          return `<div class="notif-item${unread ? ' unread' : ''}" data-id="${n.id}" data-link="${n.link || ''}">
            <div class="notif-item-body">
              <div class="notif-item-title">${escapeHtml(n.title)}</div>
              <div class="notif-item-msg">${escapeHtml(n.message || '')}</div>
              <div class="notif-item-time">${escapeHtml(n.time_ago)}</div>
            </div>
            ${unread ? '<span class="notif-unread-dot"></span>' : ''}
          </div>`;
        }).join('');
        notifList.querySelectorAll('.notif-item').forEach(el => {
          el.addEventListener('click', function () {
            const id   = this.dataset.id;
            const link = this.dataset.link;
            if (this.classList.contains('unread')) {
              fetch(`/loans/api/notifications/${id}/read`, { method: 'POST' }).catch(() => {});
              this.classList.remove('unread');
              this.querySelector('.notif-unread-dot')?.remove();
              fetchUnreadCount();
            }
            if (link && link !== 'null' && link !== '') {
              notifDropdown.classList.remove('open');
              window.location.href = link;
            }
          });
        });
      }).catch(() => {
        notifList.innerHTML = '<div class="notif-empty"><p>Could not load notifications.</p></div>';
      });
  }

  if (notifBtn && notifDropdown) {
    notifBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      const opening = !notifDropdown.classList.contains('open');
      notifDropdown.classList.toggle('open');
      if (opening) fetchNotifications();
    });

    document.addEventListener('click', (e) => {
      if (!document.getElementById('notifWrap')?.contains(e.target)) {
        notifDropdown?.classList.remove('open');
      }
    });
  }

  if (notifMarkAll) {
    notifMarkAll.addEventListener('click', () => {
      fetch('/loans/api/notifications/read-all', { method: 'POST' })
        .then(() => {
          notifList.querySelectorAll('.notif-item.unread').forEach(el => {
            el.classList.remove('unread');
            el.querySelector('.notif-unread-dot')?.remove();
          });
          notifDot?.classList.add('hidden');
        }).catch(() => {});
    });
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatTimeAgo(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  }

  /* ================================================================
     PAYMENT RECEIPT VIEWING FUNCTIONS
  ================================================================ */
  
  // For approved payments - view e-receipt
  window.viewPaymentReceipt = function(paymentId, paymentNo) {
    console.log('viewPaymentReceipt called:', { paymentId, paymentNo });
    if (!paymentId && !paymentNo) {
      console.error('No payment ID or reference provided');
      alert('No payment reference found.');
      return;
    }
    
    if (paymentNo) {
      window.open('/borrower/payments/receipt/' + paymentNo, '_blank');
    } else {
      window.open('/borrower/payments/receipt/' + paymentId, '_blank');
    }
  };
  
  // For pending payments - view proof screenshot
  window.viewPaymentProof = function(paymentId) {
    console.log('viewPaymentProof called:', paymentId);
    if (!paymentId) {
      console.error('No payment ID provided');
      alert('No payment ID found.');
      return;
    }
    
    window.open('/loans/payment-proof/' + paymentId, '_blank');
  };

  /* ================================================================
     ADD NOTIFICATION STYLES
  ================================================================ */
  const notifStyles = document.createElement('style');
  notifStyles.textContent = `
    .notif-spinner {
      width: 16px;
      height: 16px;
      border: 2px solid #deecea;
      border-top-color: #3ab5a0;
      border-radius: 50%;
      animation: notifSpin 0.7s linear infinite;
      flex-shrink: 0;
    }
    @keyframes notifSpin {
      to { transform: rotate(360deg); }
    }
    .notif-empty {
      padding: 32px 16px;
      text-align: center;
      color: #8aaeaa;
    }
    .notif-empty p {
      font-size: 13px;
      font-weight: 600;
      color: #4a6b67;
      margin: 0 0 4px;
    }
    .notif-empty small {
      font-size: 12px;
    }
    .notif-item { cursor: pointer; position: relative; }
    .notif-item.unread { background: #eaf8f5; }
    .notif-unread-dot {
      width: 8px;
      height: 8px;
      background: #1e6e60;
      border-radius: 50%;
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
    }
    .notif-loading { 
      display: flex; 
      align-items: center; 
      gap: 10px; 
      padding: 20px 16px; 
      font-size: 13px; 
      color: #8aaeaa; 
    }
  `;
  if (!document.querySelector('#notif-styles')) {
    notifStyles.id = 'notif-styles';
    document.head.appendChild(notifStyles);
  }

  /* ================================================================
     TABLE FILTER & SORT FUNCTIONS
  ================================================================ */
  let currentPage  = 1;
  let pageSize     = 10;
  let sortCol      = -1;
  let sortDir      = 'asc';
  let filteredRows = [];

  window.applyFilters = function () {
    const status    = document.getElementById('filterStatus').value.toLowerCase();
    const query     = document.getElementById('searchInput').value.toLowerCase().trim();
    const dateFrom  = document.getElementById('dateFrom').value;
    const dateTo    = document.getElementById('dateTo').value;

    const allRows = Array.from(document.querySelectorAll('.ph-row'));

    filteredRows = allRows.filter(row => {
      const rowStatus = (row.dataset.status || '').toLowerCase();
      const rowSearch = (row.dataset.search || '').toLowerCase();
      const rowDate   = (row.dataset.date || '');

      const matchStatus = !status || rowStatus === status;
      const matchSearch = !query || rowSearch.includes(query);
      const matchFrom   = !dateFrom || rowDate >= dateFrom;
      const matchTo     = !dateTo || rowDate <= dateTo;

      return matchStatus && matchSearch && matchFrom && matchTo;
    });

    currentPage = 1;
    renderPage();
  };

  window.clearDateFilter = function () {
    document.getElementById('dateFrom').value = '';
    document.getElementById('dateTo').value = '';
    applyFilters();
  };

  function getCleanCellText(cell) {
    if (!cell) return '';
    const clone = cell.cloneNode(true);
    const infoSpan = clone.querySelector('.td-amount-info');
    if (infoSpan) infoSpan.remove();
    return clone.textContent.trim();
  }

  function initSortHeaders() {
    document.querySelectorAll('.th-sort').forEach(th => {
      th.addEventListener('click', () => {
        const col = parseInt(th.dataset.col, 10);

        if (sortCol === col) {
          sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          sortCol = col;
          sortDir = 'asc';
        }

        document.querySelectorAll('.th-sort').forEach(h => {
          h.classList.remove('asc', 'desc');
        });
        th.classList.add(sortDir);

        sortRows();
        renderPage();
      });
    });
  }

  function sortRows() {
    if (sortCol < 0 || filteredRows.length === 0) return;

    filteredRows.sort((a, b) => {
      const cellsA = a.querySelectorAll('td');
      const cellsB = b.querySelectorAll('td');
      
      if (!cellsA[sortCol] || !cellsB[sortCol]) return 0;

      let valA, valB;

      if (sortCol === 5) {
        valA = cellsA[sortCol].dataset.rawDate || getCleanCellText(cellsA[sortCol]);
        valB = cellsB[sortCol].dataset.rawDate || getCleanCellText(cellsB[sortCol]);
      } else if (sortCol === 3) {
        const rawA = getCleanCellText(cellsA[sortCol]);
        const rawB = getCleanCellText(cellsB[sortCol]);
        valA = parseFloat(rawA.replace(/[₱P,]/g, '')) || 0;
        valB = parseFloat(rawB.replace(/[₱P,]/g, '')) || 0;
        return sortDir === 'asc' ? valA - valB : valB - valA;
      } else {
        valA = getCleanCellText(cellsA[sortCol]);
        valB = getCleanCellText(cellsB[sortCol]);
        return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      
      if (sortDir === 'asc') {
        return valA > valB ? 1 : (valA < valB ? -1 : 0);
      } else {
        return valA < valB ? 1 : (valA > valB ? -1 : 0);
      }
    });
  }

  function renderPage() {
    const tbody = document.getElementById('historyBody');
    const noRes = document.getElementById('noResults');
    const count = document.getElementById('recordCount');
    const allRows = Array.from(document.querySelectorAll('.ph-row'));

    allRows.forEach(r => r.style.display = 'none');

    if (filteredRows.length === 0) {
      if (noRes) noRes.classList.remove('hidden');
      if (count) count.textContent = '0 record(s)';
      renderPagination(0);
      return;
    }

    if (noRes) noRes.classList.add('hidden');

    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageRows = filteredRows.slice(start, end);

    filteredRows.forEach(row => tbody.appendChild(row));
    pageRows.forEach(r => r.style.display = '');

    if (count) count.textContent = filteredRows.length + ' record(s)';
    renderPagination(filteredRows.length);
  }

  function renderPagination(total) {
    const totalPages = Math.ceil(total / pageSize) || 1;
    const info = document.getElementById('paginationInfo');
    const pageNums = document.getElementById('pageNums');
    const btnPrev = document.getElementById('btnPrev');
    const btnNext = document.getElementById('btnNext');
    const wrap = document.getElementById('paginationControls');

    if (!wrap) return;

    wrap.style.display = total <= pageSize ? 'none' : 'flex';

    if (info) {
      const start = Math.min((currentPage - 1) * pageSize + 1, total);
      const end = Math.min(currentPage * pageSize, total);
      info.textContent = `Showing ${start}–${end} of ${total} records`;
    }

    if (btnPrev) btnPrev.disabled = currentPage <= 1;
    if (btnNext) btnNext.disabled = currentPage >= totalPages;

    if (pageNums) {
      pageNums.innerHTML = '';

      let startPage = Math.max(1, currentPage - 2);
      let endPage = Math.min(totalPages, startPage + 4);
      if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);

      for (let p = startPage; p <= endPage; p++) {
        const btn = document.createElement('button');
        btn.className = 'ph-page-num' + (p === currentPage ? ' active' : '');
        btn.textContent = p;
        btn.addEventListener('click', (function(page) {
          return function() {
            currentPage = page;
            renderPage();
          };
        })(p));
        pageNums.appendChild(btn);
      }
    }
  }

  window.changePage = function (delta) {
    const total = filteredRows.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    currentPage = Math.max(1, Math.min(currentPage + delta, totalPages));
    renderPage();
  };

  window.changePageSize = function () {
    pageSize = parseInt(document.getElementById('pageSize').value, 10);
    currentPage = 1;
    renderPage();
  };

  window.printHistory = function () {
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

  window.exportCSV = function () {
    const headers = ['Payment No.', 'Loan Reference', 'Loan Type', 'Amount (PHP)', 'Payment Method', 'Payment Date', 'Status'];
    const now = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
    const titleRow = ['"Hiraya Management System — Payment History"'];
    const dateRow = ['"Exported on: ' + now + '"'];
    const blank = [''];
    const clean = v => '"' + (v || '—').replace(/"/g, '""').trim() + '"';
    const lines = [titleRow.join(','), dateRow.join(','), blank.join(','), headers.map(clean).join(',')];

    filteredRows.forEach(row => {
      const cells = row.querySelectorAll('td');
      let amount = getCleanCellText(cells[3]) || '';
      amount = amount.replace(/[₱P,]/g, '').trim();
      const rowData = [
        cells[0]?.textContent.trim(),
        cells[1]?.textContent.trim(),
        cells[2]?.textContent.trim(),
        amount,
        cells[4]?.textContent.trim(),
        cells[5]?.textContent.trim(),
        cells[6]?.querySelector('.pay-status')?.textContent.trim() || cells[6]?.textContent.trim(),
      ].map(clean);
      lines.push(rowData.join(','));
    });

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Hiraya_PaymentHistory_' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  function initTooltips() {
    document.querySelectorAll('.td-amount[data-tippy]').forEach(el => {
      el.setAttribute('title', el.getAttribute('data-tippy'));
    });
  }

  setTimeout(() => {
    document.querySelectorAll('.flash-msg').forEach(el => el.remove());
  }, 4000);

  document.addEventListener('DOMContentLoaded', () => {
    filteredRows = Array.from(document.querySelectorAll('.ph-row'));
    initSortHeaders();
    initTooltips();
    renderPage();
  });

})();