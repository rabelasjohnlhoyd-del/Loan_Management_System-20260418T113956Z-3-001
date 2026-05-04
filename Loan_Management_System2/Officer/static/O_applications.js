/* ================================================================
   O_APPLICATIONS.JS — Loan Officer Applications Page
   ================================================================ */

(function () {
  'use strict';

  /* ================================================================
     SIDEBAR TOGGLE
     ================================================================ */
  const burgerBtn = document.getElementById('burgerBtn');
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const SIDEBAR_KEY = 'hiraya_officer_sidebar_open';
  const isMobile = () => window.innerWidth <= 768;

  function openSidebar() {
    document.body.classList.add('sidebar-open');
    if (isMobile()) sidebarOverlay?.classList.add('active');
    if (!isMobile()) localStorage.setItem(SIDEBAR_KEY, '1');
  }

  function closeSidebar() {
    document.body.classList.remove('sidebar-open');
    if (isMobile()) sidebarOverlay?.classList.remove('active');
    if (!isMobile()) localStorage.setItem(SIDEBAR_KEY, '0');
  }

  function toggleSidebar() {
    document.body.classList.contains('sidebar-open') ? closeSidebar() : openSidebar();
  }

  if (!isMobile() && localStorage.getItem(SIDEBAR_KEY) !== '0') {
    openSidebar();
  }

  burgerBtn?.addEventListener('click', toggleSidebar);
  sidebarOverlay?.addEventListener('click', closeSidebar);

  sidebar?.querySelectorAll('.nav-item, .user-dropdown a').forEach(link => {
    link.addEventListener('click', () => { if (isMobile()) closeSidebar(); });
  });

  window.addEventListener('resize', () => {
    if (!isMobile()) {
      sidebarOverlay?.classList.remove('active');
      if (localStorage.getItem(SIDEBAR_KEY) !== '0') openSidebar();
    } else {
      closeSidebar();
    }
  });

  /* ================================================================
     USER DROPDOWN
     ================================================================ */
  const userToggle = document.getElementById('userDropdownToggle');
  const userDropdown = document.getElementById('userDropdown');

  userToggle?.addEventListener('click', function (e) {
    e.stopPropagation();
    userDropdown?.classList.toggle('open');
    userToggle?.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (!userToggle?.contains(e.target) && !userDropdown?.contains(e.target)) {
      userDropdown?.classList.remove('open');
      userToggle?.classList.remove('open');
    }
  });

  /* ================================================================
     NOTIFICATIONS
     ================================================================ */
  const NOTIF_READ_KEY = 'hiraya_officer_read_notifs';
  const notifBtn = document.getElementById('notifBtn');
  const notifDropdown = document.getElementById('notifDropdown');
  const notifDot = document.getElementById('notifDot');
  const notifMarkAll = document.getElementById('notifMarkAll');
  const notifWrap = document.getElementById('notifWrap');
  const notifList = document.getElementById('notifList');

  function getReadSet() {
    try { return new Set(JSON.parse(localStorage.getItem(NOTIF_READ_KEY) || '[]')); }
    catch (e) { return new Set(); }
  }

  function saveReadSet(set) {
    try { localStorage.setItem(NOTIF_READ_KEY, JSON.stringify([...set])); }
    catch (e) { }
  }

  function markNotifItemRead(el) {
    el.classList.remove('unread');
    el.classList.add('read-local');
    el.querySelectorAll('.notif-unread-dot').forEach(d => d.remove());
  }

  function refreshNotifDot() {
    const stillUnread = notifList?.querySelectorAll('.notif-item.unread').length ?? 0;
    stillUnread > 0 ? notifDot?.classList.remove('hidden') : notifDot?.classList.add('hidden');
  }

  const readSet = getReadSet();
  notifList?.querySelectorAll('.notif-item[data-notif-id]').forEach(item => {
    if (readSet.has(item.dataset.notifId)) markNotifItemRead(item);
  });
  refreshNotifDot();

  notifBtn?.addEventListener('click', function (e) {
    e.stopPropagation();
    notifDropdown?.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (!notifWrap?.contains(e.target)) notifDropdown?.classList.remove('open');
  });

  notifList?.addEventListener('click', function (e) {
    const item = e.target.closest('.notif-item[data-notif-id]');
    if (!item || !item.classList.contains('unread')) return;
    markNotifItemRead(item);
    readSet.add(item.dataset.notifId);
    saveReadSet(readSet);
    refreshNotifDot();
  });

  notifMarkAll?.addEventListener('click', () => {
    notifList?.querySelectorAll('.notif-item[data-notif-id]').forEach(item => {
      markNotifItemRead(item);
      readSet.add(item.dataset.notifId);
    });
    saveReadSet(readSet);
    refreshNotifDot();
  });

  /* ================================================================
     ACTIVE NAV HIGHLIGHT
     ================================================================ */
  const currentPath = window.location.pathname;
  document.querySelectorAll('.nav-item[href]').forEach((el) => {
    const href = el.getAttribute('href');
    if (href && href !== '#' && currentPath.startsWith(href) && href !== '/') {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      el.classList.add('active');
    }
  });

  /* ================================================================
     APPLICATIONS PAGINATION — 10 rows per page
     ================================================================ */
  function initAppPagination() {
    const tbody = document.getElementById('appTableBody');
    if (!tbody) return;
    
    const rows = Array.from(tbody.querySelectorAll('tr.app-row'));
    if (rows.length === 0) return;
    
    const ROWS_PER_PAGE = 10;
    let currentPage = 1;
    const totalPages = Math.ceil(rows.length / ROWS_PER_PAGE);
    
    const container = document.getElementById('appPaginationContainer');
    const infoDiv = document.getElementById('appPaginationInfo');
    const btnsDiv = document.getElementById('appPaginationButtons');
    
    if (!container || !infoDiv || !btnsDiv) return;
    
    function renderPage(page) {
      currentPage = Math.min(Math.max(page, 1), totalPages);
      const start = (currentPage - 1) * ROWS_PER_PAGE;
      const end = start + ROWS_PER_PAGE;
      
      rows.forEach((row, index) => {
        row.style.display = (index >= start && index < end) ? '' : 'none';
      });
      
      const from = start + 1;
      const to = Math.min(end, rows.length);
      infoDiv.textContent = `Showing ${from}–${to} of ${rows.length} applications`;
      
      btnsDiv.innerHTML = '';
      
      // Prev button
      const prevBtn = document.createElement('button');
      prevBtn.textContent = '‹ Prev';
      prevBtn.className = 'page-btn';
      prevBtn.disabled = currentPage === 1;
      prevBtn.onclick = () => renderPage(currentPage - 1);
      btnsDiv.appendChild(prevBtn);
      
      // Page numbers
      const maxVisible = 5;
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
      
      // Show/hide container
      if (rows.length <= ROWS_PER_PAGE) {
        container.style.display = 'none';
      } else {
        container.style.display = 'flex';
      }
      
      // Update result count
      const resultCount = document.getElementById('resultCount');
      if (resultCount) {
        resultCount.textContent = rows.length;
      }
    }
    
    renderPage(1);
  }
  
  // Run pagination when page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAppPagination);
  } else {
    initAppPagination();
  }

  /* ================================================================
     AUTO-DISMISS FLASH MESSAGES
     ================================================================ */
  setTimeout(() => {
    document.querySelectorAll('.flash-msg').forEach(el => el.remove());
  }, 5000);

})();