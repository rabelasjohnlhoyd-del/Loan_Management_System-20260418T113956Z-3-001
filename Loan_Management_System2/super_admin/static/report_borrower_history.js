/* ============================================================
   BORROWER HISTORY — report_borrower_history.js
   Handles: Notification bell dropdown + badge count
   ============================================================ */

(function () {
  'use strict';

  /* ── DOM refs ── */
  const notifBtn      = document.getElementById('notifBtn');
  const notifDropdown = document.getElementById('notifDropdown');
  const notifBadge    = document.getElementById('notifBadge');
  const notifList     = document.getElementById('notifList');
  const markAllRead   = document.getElementById('markAllRead');
  const notifWrapper  = document.getElementById('notifWrapper');

  if (!notifBtn || !notifDropdown) return;

  /* ── State ── */
  let isOpen        = false;
  let notifications = [];

  /* ── Icon map by type ── */
  const iconMap = {
    payment_due:   '🔔',
    loan_approved: '✅',
    loan_rejected: '❌',
    loan_disbursed:'💰',
    general:       '📋',
  };

  /* ────────────────────────────────────────
     Fetch notifications from API
  ──────────────────────────────────────── */
  async function fetchNotifications() {
    try {
      const res  = await fetch('/admin/api/notifications');
      const data = await res.json();
      notifications = data.notifications || [];
      renderNotifications();
      updateBadge();
    } catch (err) {
      notifList.innerHTML = '<div class="notif-empty">Could not load notifications.</div>';
    }
  }

  /* ────────────────────────────────────────
     Fetch unread count (badge)
  ──────────────────────────────────────── */
  async function fetchCount() {
    try {
      const res  = await fetch('/admin/api/notifications/count');
      const data = await res.json();
      const cnt  = data.count || 0;
      if (cnt > 0) {
        notifBadge.textContent = cnt > 99 ? '99+' : cnt;
        notifBadge.style.display = 'flex';
      } else {
        notifBadge.style.display = 'none';
      }
    } catch (err) {
      notifBadge.style.display = 'none';
    }
  }

  /* ────────────────────────────────────────
     Update badge from loaded notifications
  ──────────────────────────────────────── */
  function updateBadge() {
    const unread = notifications.filter(n => !n.is_read).length;
    if (unread > 0) {
      notifBadge.textContent  = unread > 99 ? '99+' : unread;
      notifBadge.style.display = 'flex';
    } else {
      notifBadge.style.display = 'none';
    }
  }

  /* ────────────────────────────────────────
     Render notifications list
  ──────────────────────────────────────── */
  function renderNotifications() {
    if (!notifications.length) {
      notifList.innerHTML = '<div class="notif-empty">No notifications yet.</div>';
      return;
    }

    /* Group by section */
    const groups = {};
    notifications.forEach(n => {
      const sec = n.section || 'General';
      if (!groups[sec]) groups[sec] = [];
      groups[sec].push(n);
    });

    let html = '';
    Object.entries(groups).forEach(([section, items]) => {
      html += `<div class="notif-section-label">${escHtml(section)}</div>`;
      items.forEach(n => {
        const icon      = iconMap[n.type] || '📋';
        const unreadCls = n.is_read ? '' : 'unread';
        const link      = n.link   || '#';
        html += `
          <a class="notif-item ${unreadCls}" href="${escHtml(link)}" data-id="${escHtml(n.id)}">
            <div class="notif-icon">${icon}</div>
            <div class="notif-content">
              <div class="notif-title">${escHtml(n.title)}</div>
              <div class="notif-msg">${escHtml(n.message || '')}</div>
              <div class="notif-time">${escHtml(n.time_ago || '')}</div>
            </div>
          </a>`;
      });
    });

    notifList.innerHTML = html;

    /* Mark individual as read on click */
    notifList.querySelectorAll('.notif-item').forEach(el => {
      el.addEventListener('click', function () {
        const id = this.dataset.id;
        this.classList.remove('unread');
        const target = notifications.find(n => n.id === id);
        if (target) target.is_read = true;
        updateBadge();
        fetch(`/admin/api/notifications/${id}/read`, { method: 'POST' }).catch(() => {});
      });
    });
  }

  /* ────────────────────────────────────────
     Toggle dropdown open / close
  ──────────────────────────────────────── */
  function openDropdown() {
    isOpen = true;
    notifDropdown.classList.add('open');
    notifList.innerHTML = '<div class="notif-loading">Loading...</div>';
    fetchNotifications();
  }

  function closeDropdown() {
    isOpen = false;
    notifDropdown.classList.remove('open');
  }

  notifBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    isOpen ? closeDropdown() : openDropdown();
  });

  /* Close when clicking outside */
  document.addEventListener('click', function (e) {
    if (isOpen && !notifWrapper.contains(e.target)) {
      closeDropdown();
    }
  });

  /* Close on Escape */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) closeDropdown();
  });

  /* ────────────────────────────────────────
     Mark all as read
  ──────────────────────────────────────── */
  if (markAllRead) {
    markAllRead.addEventListener('click', function (e) {
      e.stopPropagation();
      notifications.forEach(n => (n.is_read = true));
      notifList.querySelectorAll('.notif-item.unread').forEach(el => el.classList.remove('unread'));
      updateBadge();
      fetch('/admin/api/notifications/read-all', { method: 'POST' }).catch(() => {});
    });
  }

  /* ────────────────────────────────────────
     Escape helper
  ──────────────────────────────────────── */
  function escHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── Initial badge fetch on page load ── */
  fetchCount();

  /* ── Refresh badge every 60 seconds ── */
  setInterval(fetchCount, 60000);

})();