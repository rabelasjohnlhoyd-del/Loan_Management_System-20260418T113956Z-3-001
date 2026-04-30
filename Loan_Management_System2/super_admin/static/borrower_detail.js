/* ================================================================
   borrower_detail_ui.js — Sidebar, Notifications, User Dropdown
   Mirrors admin_applications_ui.js exactly
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
    if (isOpen && !notifLoaded) {
      loadNotifications();
    }
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
    if (unreadCount > 0) {
      notifDot.classList.remove('hidden');
    } else {
      notifDot.classList.add('hidden');
    }

    if (items.length === 0) {
      notifList.innerHTML = `
        <div class="notif-empty">
          <p>No notifications</p>
          <small>You're all caught up!</small>
        </div>`;
      return;
    }

    const bellIcon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z'/%3E%3C/svg%3E";

    notifList.innerHTML = items.map(n => `
      <div class="notif-item ${n.is_read ? '' : 'unread'}" data-id="${n.id}">
        <div class="notif-item-icon">
          <span style="
            -webkit-mask-image: url('${bellIcon}');
            mask-image: url('${bellIcon}');
            mask-size: contain; mask-repeat: no-repeat; mask-position: center;
            -webkit-mask-size: contain; -webkit-mask-repeat: no-repeat; -webkit-mask-position: center;
          "></span>
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
    .then(data => {
      if ((data.count ?? 0) > 0) notifDot?.classList.remove('hidden');
    })
    .catch(() => {});

  /* ================================================================
     HELPERS
     ================================================================ */
  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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

})();