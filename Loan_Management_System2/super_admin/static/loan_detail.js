/* ================================================================
   loan_detail.js — Sidebar, Notifications, Dropdown, Tabs, Pagination
   NOTIFICATIONS: Now uses localStorage (matches admin_applications)
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

  /* Close on nav click (mobile) */
  sidebar?.querySelectorAll('.nav-item, .user-dropdown a').forEach(link => {
    link.addEventListener('click', () => { if (isMobile()) closeSidebar(); });
  });

  /* Re-evaluate on resize */
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
     NOTIFICATIONS — localStorage (MATCHES admin_applications)
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

  /* Apply persisted read state to server-rendered items */
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

  document.addEventListener('click', (e) => {
    if (!notifWrap?.contains(e.target)) notifDropdown?.classList.remove('open');
  });

  /* Mark individual notif as read on click */
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
     TAB SWITCHING
     ================================================================ */
  window.showTab = function (tabId, clickedEl) {
    ['amort', 'payments', 'penalties', 'docs'].forEach(id => {
      const el = document.getElementById('tab-' + id);
      if (el) el.style.display = 'none';
    });

    const target = document.getElementById('tab-' + tabId);
    if (target) target.style.display = '';

    document.querySelectorAll('#detail-tabs .status-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    if (clickedEl) clickedEl.classList.add('active');

    /* Re-render pagination for newly shown tab */
    renderPage(tabId, 1);

    return false;
  };

  /* ================================================================
     CLIENT-SIDE PAGINATION (10 rows per page)
     ================================================================ */
  const ROWS_PER_PAGE = 10;
  const state = {};

  function initPagination(key) {
    const tbody = document.getElementById('tbody-' + key);
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll('tr'));
    if (rows.length === 0) return;

    state[key] = { rows, current: 1 };
    renderPage(key, 1);
  }

  function renderPage(key, page) {
    if (!state[key]) return;

    const { rows } = state[key];
    state[key].current = page;

    const total      = rows.length;
    const totalPages = Math.ceil(total / ROWS_PER_PAGE);
    const start      = (page - 1) * ROWS_PER_PAGE;
    const end        = start + ROWS_PER_PAGE;

    rows.forEach((row, i) => {
      row.style.display = (i >= start && i < end) ? '' : 'none';
    });

    const wrapEl = document.getElementById('pag-wrap-' + key);
    const infoEl = document.getElementById('pag-info-' + key);
    const btnsEl = document.getElementById('pag-btns-' + key);
    if (!wrapEl || !infoEl || !btnsEl) return;

    /* Show/hide wrap */
    wrapEl.style.display = total > ROWS_PER_PAGE ? 'flex' : 'none';
    if (total <= ROWS_PER_PAGE) return;

    const from = total === 0 ? 0 : start + 1;
    const to   = Math.min(end, total);
    infoEl.textContent = 'Showing ' + from + '–' + to + ' of ' + total + ' results';

    btnsEl.innerHTML = '';

    /* Prev */
    const prev = makeBtn('‹', page === 1, false, () => renderPage(key, page - 1));
    prev.classList.add('page-btn--wide');
    prev.title = 'Previous';
    btnsEl.appendChild(prev);

    /* Page numbers */
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
        btnsEl.appendChild(dots);
      }
      btnsEl.appendChild(makeBtn(p, false, p === page, () => renderPage(key, p)));
      last = p;
    });

    /* Next */
    const next = makeBtn('›', page === totalPages, false, () => renderPage(key, page + 1));
    next.classList.add('page-btn--wide');
    next.title = 'Next';
    btnsEl.appendChild(next);
  }

  function makeBtn(label, disabled, active, onClick) {
    const btn = document.createElement('button');
    btn.className = 'page-btn' + (active ? ' active' : '');
    btn.textContent = label;
    btn.disabled    = disabled;
    btn.addEventListener('click', onClick);
    return btn;
  }

  /* ================================================================
     INIT
     ================================================================ */
  initPagination('amort');
  initPagination('payments');
  initPagination('penalties');

})();