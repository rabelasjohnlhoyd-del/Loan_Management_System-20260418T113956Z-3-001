/* ================================================================
   loan_detail.js — Sidebar, Notifications, Dropdown, Tabs, Pagination
   Mirrors admin_applications_ui.js pattern exactly
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
     NOTIFICATIONS
     ================================================================ */
  const notifBtn      = document.getElementById('notifBtn');
  const notifDropdown = document.getElementById('notifDropdown');
  const notifDot      = document.getElementById('notifDot');
  const notifList     = document.getElementById('notifList');
  const notifMarkAll  = document.getElementById('notifMarkAll');
  const notifWrap     = document.getElementById('notifWrap');

  let notifLoaded = false;

  notifBtn?.addEventListener('click', function (e) {
    e.stopPropagation();
    const isOpen = notifDropdown.classList.toggle('open');
    if (isOpen && !notifLoaded) loadNotifications();
  });

  document.addEventListener('click', (e) => {
    if (!notifWrap?.contains(e.target)) {
      notifDropdown?.classList.remove('open');
    }
  });

  function loadNotifications() {
    notifLoaded = true;
    notifList.innerHTML = '<div class="notif-loading">Loading...</div>';
    fetch('/super_admin/api/notifications')
      .then(res => res.json())
      .then(data => renderNotifications(data))
      .catch(() => {
        notifList.innerHTML = '<div class="notif-empty"><p>Could not load notifications.</p><small>Please try again later.</small></div>';
      });
  }

  function renderNotifications(data) {
    const items = Array.isArray(data) ? data : (data.notifications || []);
    const unreadCount = items.filter(n => !n.is_read).length;
    unreadCount > 0 ? notifDot.classList.remove('hidden') : notifDot.classList.add('hidden');

    if (items.length === 0) {
      notifList.innerHTML = `<div class="notif-empty"><p>No notifications</p><small>You're all caught up!</small></div>`;
      return;
    }

    const bellIcon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z'/%3E%3C/svg%3E";

    notifList.innerHTML = items.map(n => `
      <div class="notif-item ${n.is_read ? '' : 'unread'}" data-id="${n.id}">
        <div class="notif-item-icon">
          <span style="-webkit-mask-image:url('${bellIcon}');mask-image:url('${bellIcon}');mask-size:contain;mask-repeat:no-repeat;mask-position:center;-webkit-mask-size:contain;-webkit-mask-repeat:no-repeat;-webkit-mask-position:center;"></span>
        </div>
        <div class="notif-item-body">
          <div class="notif-item-title">${escHtml(n.title || 'Notification')}</div>
          <div class="notif-item-msg">${escHtml(n.message || '')}</div>
          <div class="notif-item-time">${formatTime(n.created_at)}</div>
        </div>
        ${!n.is_read ? '<span class="notif-unread-dot"></span>' : ''}
      </div>
    `).join('');

    notifList.querySelectorAll('.notif-item').forEach(el => {
      el.addEventListener('click', () => markAsRead(el.dataset.id, el));
    });
  }

  function markAsRead(id, el) {
    if (!el.classList.contains('unread')) return;
    fetch(`/super_admin/api/notifications/${id}/read`, { method: 'POST' })
      .then(res => res.ok && updateUnreadUI(el))
      .catch(() => {});
  }

  function updateUnreadUI(el) {
    el.classList.remove('unread');
    el.querySelector('.notif-unread-dot')?.remove();
    const remaining = notifList.querySelectorAll('.notif-item.unread').length;
    if (remaining === 0) notifDot.classList.add('hidden');
  }

  notifMarkAll?.addEventListener('click', () => {
    fetch('/super_admin/api/notifications/read-all', { method: 'POST' })
      .then(res => {
        if (res.ok) {
          notifList.querySelectorAll('.notif-item.unread').forEach(el => updateUnreadUI(el));
        }
      })
      .catch(() => {});
  });

  /* Check unread count on page load */
  fetch('/admin/api/notifications/count')
    .then(res => res.json())
    .then(data => { if ((data.count ?? 0) > 0) notifDot?.classList.remove('hidden'); })
    .catch(() => {});

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
     HELPERS
     ================================================================ */
  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatTime(ts) {
    if (!ts) return '';
    const date = new Date(ts);
    if (isNaN(date)) return ts;
    const now  = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60)    return 'Just now';
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  /* ================================================================
     INIT
     ================================================================ */
  initPagination('amort');
  initPagination('payments');
  initPagination('penalties');

})();