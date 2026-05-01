/* ================================================================
   borrowers.js — Borrowers Page Scripts
   NOTIFICATIONS: localStorage version (matches all_loans.js)
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
     NOTIFICATIONS — localStorage (MATCHES all_loans.js)
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
  const path = window.location.pathname;
  document.querySelectorAll('.nav-item').forEach(function (el) {
    const href = el.getAttribute('href');
    if (href && href !== '#' && path.startsWith(href)) {
      el.classList.add('active');
    }
  });

  /* ================================================================
     CLIENT-SIDE PAGINATION — 10 rows per page
     ================================================================ */
  const ROWS_PER_PAGE = 10;
  const tableBody      = document.getElementById('tableBody');
  const paginationWrap = document.getElementById('paginationWrap');
  const paginationInfo = document.getElementById('paginationInfo');
  const paginationBtns = document.getElementById('paginationBtns');
  const resultCount    = document.getElementById('resultCount');

  if (tableBody) {
    const allRows    = Array.from(tableBody.querySelectorAll('tr'));
    const totalRows  = allRows.length;
    const totalPages = Math.ceil(totalRows / ROWS_PER_PAGE);
    let   currentPage = 1;

    if (resultCount) resultCount.textContent = totalRows + ' result(s)';

    function showPage(page) {
      currentPage = page;
      const start = (page - 1) * ROWS_PER_PAGE;
      const end   = start + ROWS_PER_PAGE;

      allRows.forEach((row, i) => {
        row.style.display = (i >= start && i < end) ? '' : 'none';
      });

      const from = totalRows === 0 ? 0 : start + 1;
      const to   = Math.min(end, totalRows);
      paginationInfo.textContent = totalRows === 0
        ? 'No results'
        : 'Showing ' + from + '–' + to + ' of ' + totalRows + ' results';

      paginationBtns.innerHTML = '';

      if (totalPages <= 1) {
        paginationWrap.style.display = totalRows === 0 ? 'none' : 'flex';
        return;
      }

      // Prev button
      const prev = makeBtn('‹', page === 1, false, () => showPage(page - 1));
      prev.classList.add('page-btn--wide');
      prev.title = 'Previous';
      paginationBtns.appendChild(prev);

      // Page number buttons with ellipsis
      const delta = 2;
      let pages = [];
      for (let p = 1; p <= totalPages; p++) {
        if (p === 1 || p === totalPages || (p >= page - delta && p <= page + delta)) {
          pages.push(p);
        }
      }

      let last = 0;
      pages.forEach(p => {
        if (last && p - last > 1) {
          const dots = document.createElement('button');
          dots.className = 'page-btn';
          dots.textContent = '…';
          dots.disabled = true;
          paginationBtns.appendChild(dots);
        }
        paginationBtns.appendChild(makeBtn(p, false, p === page, () => showPage(p)));
        last = p;
      });

      // Next button
      const next = makeBtn('›', page === totalPages, false, () => showPage(page + 1));
      next.classList.add('page-btn--wide');
      next.title = 'Next';
      paginationBtns.appendChild(next);
    }

    function makeBtn(label, disabled, active, onClick) {
      const btn = document.createElement('button');
      btn.className = 'page-btn' + (active ? ' active' : '');
      btn.textContent = label;
      btn.disabled    = disabled;
      btn.addEventListener('click', onClick);
      return btn;
    }

    showPage(1);
  }

})();