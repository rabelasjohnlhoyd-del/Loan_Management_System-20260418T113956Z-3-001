/* ================================================================
   loan_detail.js
   ================================================================ */

(function () {
  'use strict';

  /* ── Sidebar Toggle ─────────────────────────────────────────── */
  const burgerBtn      = document.getElementById('burgerBtn');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const sidebar        = document.getElementById('sidebar');
  const SIDEBAR_KEY    = 'hiraya_sidebar_open';
  const isMobile       = () => window.innerWidth <= 768;

  function openSidebar()  {
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

  /* ── User Dropdown ──────────────────────────────────────────── */
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

  /* ── Progress Bar Animation ─────────────────────────────────── */
  document.querySelectorAll('.progress-fill').forEach(function (fill) {
    const target = fill.getAttribute('data-width') || '0';
    fill.style.width = '0%';
    setTimeout(function () {
      fill.style.width = target + '%';
    }, 200);
  });

  /* ── Amortization Schedule Filter ──────────────────────────── */
  const filterBtns = document.querySelectorAll('.filter-tab');
  const schedRows  = document.querySelectorAll('.sched-row');

  filterBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filterBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');

      const filter = btn.getAttribute('data-filter');

      schedRows.forEach(function (row) {
        const status = row.getAttribute('data-status') || 'upcoming';

        if (filter === 'all') {
          row.classList.remove('hidden');
        } else if (filter === 'upcoming') {
          if (status === 'paid') {
            row.classList.add('hidden');
          } else {
            row.classList.remove('hidden');
          }
        } else if (filter === 'paid') {
          if (status === 'paid') {
            row.classList.remove('hidden');
          } else {
            row.classList.add('hidden');
          }
        }
      });
    });
  });

  /* ── Highlight current (first upcoming) period row ─────────── */
  const firstUpcoming = document.querySelector('.sched-row[data-status="upcoming"]');
  if (firstUpcoming) {
    firstUpcoming.classList.add('current-period');
  }

  /* ── Notification Icons ─────────────────────────────────────── */
  const NOTIF_ICONS = {
    loan_approved:    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'/%3E%3C/svg%3E\")",
    loan_rejected:    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z'/%3E%3C/svg%3E\")",
    loan_disbursed:   "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l6.59-6.59L18 9l-9 9z'/%3E%3C/svg%3E\")",
    payment_due:      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'/%3E%3C/svg%3E\")",
    payment_received: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'/%3E%3C/svg%3E\")",
    id_verified:      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z'/%3E%3C/svg%3E\")",
    id_rejected:      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z'/%3E%3C/svg%3E\")",
    general:          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z'/%3E%3C/svg%3E\")",
  };

  /* ── Notifications ──────────────────────────────────────────── */
  const notifBtn      = document.getElementById('notifBtn');
  const notifDropdown = document.getElementById('notifDropdown');
  const notifDot      = document.getElementById('notifDot');
  const notifList     = document.getElementById('notifList');
  const notifMarkAll  = document.getElementById('notifMarkAll');

  function fetchUnreadCount() {
    fetch('/loans/api/notifications/count')
      .then(r => r.json())
      .then(data => {
        if (data.count > 0) {
          notifDot?.classList.remove('hidden');
          if (notifDot) notifDot.textContent = data.count > 9 ? '9+' : data.count;
        } else {
          notifDot?.classList.add('hidden');
        }
      })
      .catch(() => {});
  }

  fetchUnreadCount();
  setInterval(fetchUnreadCount, 60000);

  function fetchNotifications() {
    if (!notifList) return;
    notifList.innerHTML = `<div class="notif-loading"><div class="notif-spinner"></div><span>Loading notifications...</span></div>`;
    fetch('/loans/api/notifications')
      .then(r => r.json())
      .then(data => {
        const items = data.notifications || [];
        if (!items.length) {
          notifList.innerHTML = `<div class="notif-empty"><p>You're all caught up!</p><small>No new notifications</small></div>`;
          return;
        }
        notifList.innerHTML = items.map(renderNotifItem).join('');
        notifList.querySelectorAll('.notif-item').forEach(el => {
          el.addEventListener('click', function () {
            const id   = this.dataset.id;
            const link = this.dataset.link;
            if (this.classList.contains('unread')) {
              markRead(id, () => {
                this.classList.remove('unread');
                this.querySelector('.notif-unread-dot')?.remove();
                fetchUnreadCount();
              });
            }
            if (link && link !== 'null' && link !== '') {
              notifDropdown.classList.remove('open');
              window.location.href = link;
            }
          });
        });
      })
      .catch(() => {
        notifList.innerHTML = '<div class="notif-empty"><p>Could not load notifications.</p></div>';
      });
  }

  function renderNotifItem(n) {
    const iconPath = NOTIF_ICONS[n.type] || NOTIF_ICONS['general'];
    const unread   = !n.is_read;
    return `<div class="notif-item${unread ? ' unread' : ''}" data-id="${n.id}" data-link="${n.link || ''}">
      <div class="notif-item-icon notif-icon--${n.type}">
        <span style="-webkit-mask-image:${iconPath};mask-image:${iconPath};"></span>
      </div>
      <div class="notif-item-body">
        <div class="notif-item-title">${escHtml(n.title)}</div>
        <div class="notif-item-msg">${escHtml(n.message || '')}</div>
        <div class="notif-item-time">${escHtml(n.time_ago)}</div>
      </div>
      ${unread ? '<span class="notif-unread-dot"></span>' : ''}
    </div>`;
  }

  function markRead(id, cb) {
    fetch(`/loans/api/notifications/${id}/read`, { method: 'POST' })
      .then(() => cb && cb())
      .catch(() => cb && cb());
  }

  notifBtn?.addEventListener('click', function (e) {
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
  notifMarkAll?.addEventListener('click', () => {
    fetch('/loans/api/notifications/read-all', { method: 'POST' })
      .then(() => {
        notifList.querySelectorAll('.notif-item.unread').forEach(el => {
          el.classList.remove('unread');
          el.querySelector('.notif-unread-dot')?.remove();
        });
        notifDot?.classList.add('hidden');
      })
      .catch(() => {});
  });

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

})();