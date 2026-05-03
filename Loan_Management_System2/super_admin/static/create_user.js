/* ================================================================
   create_user.js — Create Staff Account Page Scripts
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
     NOTIFICATIONS
     ================================================================ */
  const ICON_SVG = {
    activity: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#4A7A82" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
    warning:  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#d97706" width="16" height="16"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>',
    check:    '<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#16a34a" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>',
    cross:    '<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#dc2626" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>',
  };

  function getIconSvg(type) {
    if (type === 'payment_due')   return ICON_SVG.warning;
    if (type === 'loan_approved') return ICON_SVG.check;
    if (type === 'loan_rejected') return ICON_SVG.cross;
    return ICON_SVG.activity;
  }

  const notifBtn      = document.getElementById('notifBtn');
  const notifDropdown = document.getElementById('notifDropdown');
  const notifDot      = document.getElementById('notifDot');
  const notifList     = document.getElementById('notifList');
  const notifMarkAll  = document.getElementById('notifMarkAll');

  function fetchUnreadCount() {
    fetch('/admin/api/notifications/count')
      .then(r => r.json())
      .then(data => {
        if (data.count > 0) notifDot?.classList.remove('hidden');
        else notifDot?.classList.add('hidden');
      }).catch(() => {});
  }
  fetchUnreadCount();
  setInterval(fetchUnreadCount, 60000);

  function renderNotifItem(n) {
    const unread = !n.is_read;
    let iconBg = '#d9eef1';
    if (n.type === 'payment_due')   iconBg = '#fef3c7';
    if (n.type === 'loan_approved') iconBg = '#dcfce7';
    if (n.type === 'loan_rejected') iconBg = '#fee2e2';

    return `
      <div class="notif-item${unread ? ' unread' : ''}" data-id="${n.id}" data-link="${n.link || ''}"
           style="display:flex;align-items:flex-start;gap:12px;padding:12px 16px;
                  border-bottom:1px solid var(--gray-200);cursor:pointer;position:relative;
                  background:${unread ? 'var(--primary-light)' : 'var(--white)'};">
        <div style="width:36px;height:36px;border-radius:50%;flex-shrink:0;
                    display:flex;align-items:center;justify-content:center;
                    background:${iconBg};">
          ${getIconSvg(n.type)}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:600;color:#1a2332;margin-bottom:2px;
                      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(n.title)}</div>
          <div style="font-size:12px;color:#64748b;line-height:1.4;
                      display:-webkit-box;-webkit-line-clamp:2;
                      -webkit-box-orient:vertical;overflow:hidden;">${escHtml(n.message || '')}</div>
          <div style="font-size:11px;color:#94a3b8;margin-top:3px;">${escHtml(n.time_ago)}</div>
        </div>
        ${unread ? `<span style="position:absolute;top:50%;right:14px;transform:translateY(-50%);
                                 width:7px;height:7px;border-radius:50%;
                                 background:#2a8f9d;flex-shrink:0;"></span>` : ''}
      </div>`;
  }

  function groupLabel(text, borderTop) {
    return `
      <div style="display:flex;align-items:center;gap:8px;padding:8px 16px 4px;
                  font-size:10px;font-weight:700;text-transform:uppercase;
                  letter-spacing:0.8px;color:#94a3b8;
                  background:#f4f6f8;
                  ${borderTop ? 'border-top:1px solid #e5e9ed;' : ''}
                  border-bottom:1px solid #e5e9ed;">
        <span>${text}</span>
      </div>`;
  }

  function fetchNotifications() {
    if (!notifList) return;
    notifList.innerHTML = `<div style="display:flex;align-items:center;gap:10px;padding:20px 16px;font-size:13px;color:#94a3b8;">Loading notifications...</div>`;
    fetch('/admin/api/notifications')
      .then(r => r.json())
      .then(data => {
        const items = data.notifications || [];
        if (items.length === 0) {
          notifList.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;
                        padding:36px 16px;text-align:center;">
              <div style="width:36px;height:36px;background:#cbd5e1;opacity:0.5;margin-bottom:8px;
                   mask-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z'/%3E%3C/svg%3E\");
                   -webkit-mask-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z'/%3E%3C/svg%3E\");
                   mask-size:contain;mask-repeat:no-repeat;
                   -webkit-mask-size:contain;-webkit-mask-repeat:no-repeat;"></div>
              <p style="font-size:13px;font-weight:600;color:#64748b;margin:0 0 4px;">You're all caught up!</p>
              <small style="font-size:12px;color:#94a3b8;">No new notifications</small>
            </div>`;
          return;
        }

        const pendingApps  = items.filter(n => n.type === 'payment_due');
        const activityLogs = items.filter(n => n.type !== 'payment_due');

        let html = '';
        if (pendingApps.length > 0) {
          html += groupLabel('Pending Applications', false);
          html += pendingApps.map(n => renderNotifItem(n)).join('');
        }
        if (activityLogs.length > 0) {
          html += groupLabel('Recent Activity', pendingApps.length > 0);
          html += activityLogs.map(n => renderNotifItem(n)).join('');
        }

        notifList.innerHTML = html;

        notifList.querySelectorAll('[data-id]').forEach(el => {
          el.addEventListener('click', function () {
            const id   = this.dataset.id;
            const link = this.dataset.link;
            if (this.classList.contains('unread')) {
              fetch(`/admin/api/notifications/${id}/read`, { method: 'POST' }).catch(() => {});
              this.classList.remove('unread');
              this.style.background = '#ffffff';
              fetchUnreadCount();
            }
            if (link && link !== 'null' && link !== '') {
              notifDropdown.classList.remove('open');
              window.location.href = link;
            }
          });
        });
      }).catch(() => {
        notifList.innerHTML = '<div style="padding:20px 16px;text-align:center;color:#94a3b8;font-size:13px;">Could not load notifications.</div>';
      });
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
    fetch('/admin/api/notifications/read-all', { method: 'POST' })
      .then(() => { notifDot?.classList.add('hidden'); fetchNotifications(); })
      .catch(() => {});
  });

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ================================================================
     PASSWORD TOGGLE
     ================================================================ */
  window.togglePw = function (id, btn) {
    const input = document.getElementById(id);
    if (input.type === 'password') {
      input.type = 'text';
      btn.textContent = 'Hide';
    } else {
      input.type = 'password';
      btn.textContent = 'Show';
    }
  };

  /* ================================================================
     ROLE DESCRIPTION HELPER
     ================================================================ */
  const roleDesc = {
    admin:        'Full administrative access: manage loans, payments, and borrowers.',
    loan_officer: 'Operations access: process applications and communicate with borrowers.',
    auditor:      'Read-only access: view reports, loans, and activity logs only.',
    super_admin:  'Owner access: all features plus system settings and user management.'
  };

  document.querySelector('select[name="role"]')?.addEventListener('change', function () {
    const box  = document.getElementById('roleInfo');
    const text = document.getElementById('roleInfoText');
    if (this.value && roleDesc[this.value]) {
      text.textContent = roleDesc[this.value];
      box.style.display = 'flex';
    } else {
      box.style.display = 'none';
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

})();