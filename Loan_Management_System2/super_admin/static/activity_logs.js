/* ================================================================
   activity_logs.js — Sidebar, Notifications, Pagination
   Pagination: 20 rows per page, client-side
   ================================================================ */

(function () {
  'use strict';

  /* ================================================================
     SIDEBAR TOGGLE
     ================================================================ */
  const burgerBtn      = document.getElementById('burgerBtn');
  const sidebar        = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const SIDEBAR_KEY    = 'hiraya_admin_sidebar_open';
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

  /* Restore desktop preference on page load */
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

  userToggle?.addEventListener('click', function (e) {
    e.stopPropagation();
    userDropdown.classList.toggle('open');
    userToggle.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (!userToggle?.contains(e.target) && !userDropdown?.contains(e.target)) {
      userDropdown?.classList.remove('open');
      userToggle?.classList.remove('open');
    }
  });

  /* ================================================================
     NOTIFICATIONS — localStorage persistence
     ================================================================ */
  const NOTIF_READ_KEY = 'hiraya_admin_read_notifs';
  const notifBtn       = document.getElementById('notifBtn');
  const notifDropdown  = document.getElementById('notifDropdown');
  const notifDot       = document.getElementById('notifDot');
  const notifMarkAll   = document.getElementById('notifMarkAll');
  const notifWrap      = document.getElementById('notifWrap');
  const notifList      = document.getElementById('notifList');

  function getReadSet() {
    try { return new Set(JSON.parse(localStorage.getItem(NOTIF_READ_KEY) || '[]')); }
    catch (e) { return new Set(); }
  }

  function saveReadSet(set) {
    try { localStorage.setItem(NOTIF_READ_KEY, JSON.stringify([...set])); }
    catch (e) { /* quota */ }
  }

  function markNotifItemRead(el) {
    el.classList.remove('unread');
    el.classList.add('read-local');
    el.querySelectorAll('.notif-unread-dot').forEach(d => d.remove());
  }

  function refreshNotifDot() {
    const stillUnread = notifList?.querySelectorAll('.notif-item.unread').length ?? 0;
    stillUnread > 0
      ? notifDot?.classList.remove('hidden')
      : notifDot?.classList.add('hidden');
  }

  /* Apply persisted read state on load */
  const readSet = getReadSet();
  notifList?.querySelectorAll('.notif-item[data-notif-id]').forEach(item => {
    if (readSet.has(item.dataset.notifId)) markNotifItemRead(item);
  });
  refreshNotifDot();

  /* Toggle dropdown */
  notifBtn?.addEventListener('click', function (e) {
    e.stopPropagation();
    notifDropdown?.classList.toggle('open');
  });

  /* Close when clicking outside */
  document.addEventListener('click', (e) => {
    if (!notifWrap?.contains(e.target)) notifDropdown?.classList.remove('open');
  });

  /* Mark individual as read on click */
  notifList?.addEventListener('click', function (e) {
    const item = e.target.closest('.notif-item[data-notif-id]');
    if (!item || !item.classList.contains('unread')) return;
    markNotifItemRead(item);
    readSet.add(item.dataset.notifId);
    saveReadSet(readSet);
    refreshNotifDot();
  });

  /* Mark all as read */
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
  document.querySelectorAll('.nav-item[href]').forEach(el => {
    const href = el.getAttribute('href');
    if (href && href !== '#' && currentPath.startsWith(href) && href !== '/') {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      el.classList.add('active');
    }
  });

  /* ================================================================
     PAGINATION — 20 rows per page
     ================================================================ */
  const ROWS_PER_PAGE = 20;

  const tableBody      = document.getElementById('logsTableBody');
  const paginationWrap = document.getElementById('logsPaginationWrap');
  const paginationInfo = document.getElementById('logsPaginationInfo');
  const pageNumbers    = document.getElementById('logsPageNumbers');
  const pagePrev       = document.getElementById('logsPrev');
  const pageNext       = document.getElementById('logsNext');

  let currentPage = 1;
  let allRows     = [];

  function initPagination() {
    if (!tableBody) return;
    allRows = Array.from(tableBody.querySelectorAll('tr'));
    if (allRows.length === 0) return;
    renderPage(1);
  }

  function renderPage(page) {
    currentPage = page;
    const total      = allRows.length;
    const totalPages = Math.ceil(total / ROWS_PER_PAGE) || 1;
    const start      = (page - 1) * ROWS_PER_PAGE;
    const end        = Math.min(start + ROWS_PER_PAGE, total);

    /* Show/hide rows */
    allRows.forEach((row, idx) => {
      row.style.display = (idx >= start && idx < end) ? '' : 'none';
    });

    /* Show/hide pagination wrap */
    if (!paginationWrap) return;
    paginationWrap.style.display = total > ROWS_PER_PAGE ? 'flex' : 'none';
    if (total <= ROWS_PER_PAGE) return;

    /* Info text */
    if (paginationInfo) {
      paginationInfo.textContent = `Showing ${start + 1}–${end} of ${total} records`;
    }

    /* Prev / Next state */
    if (pagePrev) pagePrev.disabled = page <= 1;
    if (pageNext) pageNext.disabled = page >= totalPages;

    /* Page number buttons — max 5 visible */
    if (pageNumbers) {
      pageNumbers.innerHTML = '';
      const maxVisible = 5;
      let startPage = Math.max(1, page - Math.floor(maxVisible / 2));
      let endPage   = Math.min(totalPages, startPage + maxVisible - 1);
      if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
      }

      /* Leading ellipsis */
      if (startPage > 1) {
        pageNumbers.appendChild(makePageBtn(1, page));
        if (startPage > 2) pageNumbers.appendChild(makeEllipsis());
      }

      for (let p = startPage; p <= endPage; p++) {
        pageNumbers.appendChild(makePageBtn(p, page));
      }

      /* Trailing ellipsis */
      if (endPage < totalPages) {
        if (endPage < totalPages - 1) pageNumbers.appendChild(makeEllipsis());
        pageNumbers.appendChild(makePageBtn(totalPages, page));
      }
    }
  }

  function makePageBtn(p, currentPage) {
    const btn = document.createElement('button');
    btn.className = 'page-num' + (p === currentPage ? ' active' : '');
    btn.textContent = p;
    btn.type = 'button';
    btn.addEventListener('click', () => renderPage(p));
    return btn;
  }

  function makeEllipsis() {
    const span = document.createElement('button');
    span.className = 'page-num';
    span.textContent = '…';
    span.disabled = true;
    return span;
  }

  pagePrev?.addEventListener('click', () => {
    if (currentPage > 1) renderPage(currentPage - 1);
  });

  pageNext?.addEventListener('click', () => {
    const totalPages = Math.ceil(allRows.length / ROWS_PER_PAGE) || 1;
    if (currentPage < totalPages) renderPage(currentPage + 1);
  });

  /* Kick off */
  initPagination();

})();