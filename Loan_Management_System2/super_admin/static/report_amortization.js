/* ================================================================
   REPORT_AMORTIZATION.JS
   - Notification Bell toggle + fetch from /admin/api/notifications
   ================================================================ */

(function () {
  'use strict';

  const notifBtn      = document.getElementById('notifBtn');
  const notifDropdown = document.getElementById('notifDropdown');
  const notifBadge    = document.getElementById('notifBadge');
  const notifList     = document.getElementById('notifList');
  const markAllBtn    = document.getElementById('markAllRead');
  const notifWrapper  = document.getElementById('notifWrapper');

  if (!notifBtn) return; // guard if element missing

  let loaded = false;

  /* ----------------------------------------------------------
     TOGGLE DROPDOWN
  ---------------------------------------------------------- */
  notifBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    const isOpen = notifDropdown.classList.contains('open');

    if (isOpen) {
      closeDropdown();
    } else {
      openDropdown();
    }
  });

  function openDropdown() {
    notifDropdown.classList.add('open');
    if (!loaded) fetchNotifications();
  }

  function closeDropdown() {
    notifDropdown.classList.remove('open');
  }

  /* Close when clicking outside */
  document.addEventListener('click', function (e) {
    if (!notifWrapper.contains(e.target)) {
      closeDropdown();
    }
  });

  /* Close on Escape */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeDropdown();
  });

  /* ----------------------------------------------------------
     FETCH NOTIFICATIONS from Flask API
     Route: GET /admin/api/notifications
  ---------------------------------------------------------- */
  function fetchNotifications() {
    fetch('/admin/api/notifications', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin'
    })
      .then(function (res) {
        if (!res.ok) throw new Error('Network response was not ok');
        return res.json();
      })
      .then(function (data) {
        loaded = true;
        renderNotifications(data.notifications || []);
        updateBadge(data.unread_count || 0);
      })
      .catch(function (err) {
        console.error('Notifications fetch error:', err);
        notifList.innerHTML = '<div class="notif-loading">Unable to load notifications.</div>';
      });
  }

  /* ----------------------------------------------------------
     RENDER NOTIFICATION ITEMS
  ---------------------------------------------------------- */
  function renderNotifications(items) {
    if (!items.length) {
      notifList.innerHTML = '<div class="notif-empty">No recent activity.</div>';
      return;
    }

    notifList.innerHTML = items.map(function (item) {
      return `
        <div class="notif-item ${item.is_read ? '' : 'unread'}" data-id="${item.id}">
          <div class="notif-icon">
            ${getNotifIcon(item.action)}
          </div>
          <div class="notif-body">
            <strong>${escapeHtml(item.action)}</strong>
            <p>${escapeHtml(item.details || '')}</p>
            <time>${formatTime(item.timestamp)}</time>
          </div>
        </div>
      `;
    }).join('');
  }

  /* ----------------------------------------------------------
     BADGE
  ---------------------------------------------------------- */
  function updateBadge(count) {
    if (count > 0) {
      notifBadge.textContent = count > 99 ? '99+' : count;
      notifBadge.style.display = 'flex';
    } else {
      notifBadge.style.display = 'none';
    }
  }

  /* ----------------------------------------------------------
     MARK ALL AS READ
  ---------------------------------------------------------- */
  markAllBtn.addEventListener('click', function () {
    fetch('/admin/api/notifications/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin'
    })
      .then(function (res) { return res.json(); })
      .then(function () {
        /* Remove unread class from all items */
        document.querySelectorAll('.notif-item.unread').forEach(function (el) {
          el.classList.remove('unread');
        });
        updateBadge(0);
      })
      .catch(function (err) {
        console.error('Mark-read error:', err);
      });
  });

  /* ----------------------------------------------------------
     LOAD UNREAD COUNT ON PAGE LOAD (for badge without opening)
  ---------------------------------------------------------- */
  fetch('/admin/api/notifications/unread-count', {
    method: 'GET',
    credentials: 'same-origin'
  })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      updateBadge(data.unread_count || 0);
    })
    .catch(function () {
      /* Silent fail — badge stays hidden */
    });

  /* ----------------------------------------------------------
     HELPERS
  ---------------------------------------------------------- */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatTime(timestamp) {
    if (!timestamp) return '';
    try {
      const d = new Date(timestamp);
      return d.toLocaleString('en-PH', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true
      });
    } catch (e) {
      return timestamp;
    }
  }

  function getNotifIcon(action) {
    const a = (action || '').toLowerCase();
    if (a.includes('login')) {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>`;
    }
    if (a.includes('logout')) {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;
    }
    if (a.includes('loan') || a.includes('payment')) {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`;
    }
    if (a.includes('archive') || a.includes('delete')) {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`;
    }
    /* Default clock icon */
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
  }

})();