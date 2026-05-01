/* ================================================================
   penalties.js — Penalties & Overdue Page Scripts
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
     FLASH MESSAGE — auto-dismiss after 5 seconds
     ================================================================ */
  function dismissFlash(btnOrEl) {
    const msg = btnOrEl.closest ? btnOrEl.closest('.flash-msg') : btnOrEl;
    if (!msg) return;
    msg.style.opacity = '0';
    msg.style.transform = 'translateY(-6px)';
    setTimeout(() => {
      msg.remove();
      const stack = document.getElementById('flashStack');
      if (stack && !stack.children.length) stack.remove();
    }, 400);
  }
  window.dismissFlash = dismissFlash;

  // Auto-dismiss all flash messages after 5 seconds
  document.querySelectorAll('.flash-msg').forEach((msg, i) => {
    setTimeout(() => dismissFlash(msg), 5000 + i * 300);
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
  const tbody      = document.querySelector('.data-table tbody');
  const pgInfo     = document.getElementById('paginationInfo');
  const pgControls = document.getElementById('paginationControls');

  if (tbody && pgInfo && pgControls) {
    const allRows   = Array.from(tbody.querySelectorAll('tr'));
    const totalRows = allRows.length;
    let currentPage = 1;
    const totalPages = () => Math.ceil(totalRows / ROWS_PER_PAGE);

    function showPage(page) {
      currentPage = Math.max(1, Math.min(page, totalPages()));
      const start = (currentPage - 1) * ROWS_PER_PAGE;
      const end   = start + ROWS_PER_PAGE;
      allRows.forEach((row, i) => {
        row.style.display = (i >= start && i < end) ? '' : 'none';
      });
      const showing = Math.min(end, totalRows);
      pgInfo.textContent = `Showing ${start + 1}–${showing} of ${totalRows} record${totalRows !== 1 ? 's' : ''}`;
      renderControls();
    }

    function renderControls() {
      pgControls.innerHTML = '';
      const tp = totalPages();
      if (tp <= 1) { pgControls.style.display = 'none'; return; }
      pgControls.style.display = '';

      pgControls.appendChild(makeBtn('‹', currentPage === 1, () => showPage(currentPage - 1), 'pg-btn--arrow', 'Previous page'));

      getPageNumbers(currentPage, tp).forEach(p => {
        if (p === '…') {
          const el = document.createElement('span');
          el.textContent = '…';
          el.style.cssText = 'padding:0 4px;color:var(--gray-400);font-size:13px;align-self:center;';
          pgControls.appendChild(el);
        } else {
          const btn = makeBtn(p, false, () => showPage(p), '', `Page ${p}`);
          if (p === currentPage) btn.classList.add('active');
          pgControls.appendChild(btn);
        }
      });

      pgControls.appendChild(makeBtn('›', currentPage === tp, () => showPage(currentPage + 1), 'pg-btn--arrow', 'Next page'));
    }

    function makeBtn(label, disabled, onClick, extraClass, ariaLabel) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pg-btn' + (extraClass ? ' ' + extraClass : '');
      btn.textContent = label;
      btn.disabled = disabled;
      btn.setAttribute('aria-label', ariaLabel || label);
      btn.addEventListener('click', onClick);
      return btn;
    }

    function getPageNumbers(cur, total) {
      if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
      const pages = [];
      if (cur <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push('…'); pages.push(total);
      } else if (cur >= total - 3) {
        pages.push(1); pages.push('…');
        for (let i = total - 4; i <= total; i++) pages.push(i);
      } else {
        pages.push(1); pages.push('…');
        pages.push(cur - 1); pages.push(cur); pages.push(cur + 1);
        pages.push('…'); pages.push(total);
      }
      return pages;
    }

    showPage(1);
  }

})();