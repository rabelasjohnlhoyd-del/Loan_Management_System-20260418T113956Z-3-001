/* ================================================================
   manage_users.js — Manage Staff Users Page Scripts
   Mirrors penalties.js / all_loans.js exactly
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
  const NOTIF_ICONS = {
    loan_approved:    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'/%3E%3C/svg%3E\")",
    loan_rejected:    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z'/%3E%3C/svg%3E\")",
    payment_due:      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'/%3E%3C/svg%3E\")",
    payment_received: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'/%3E%3C/svg%3E\")",
    general:          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z'/%3E%3C/svg%3E\")",
  };

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

  function fetchNotifications() {
    if (!notifList) return;
    notifList.innerHTML = `<div class="notif-loading"><span>Loading notifications...</span></div>`;
    fetch('/admin/api/notifications')
      .then(r => r.json())
      .then(data => {
        const items = data.notifications || [];
        if (items.length === 0) {
          notifList.innerHTML = `<div style="padding:32px 16px;text-align:center;color:var(--gray-400);font-size:13px;">You're all caught up!</div>`;
          return;
        }
        notifList.innerHTML = items.map(n => {
          const iconPath = NOTIF_ICONS[n.type] || NOTIF_ICONS['general'];
          const unread = !n.is_read;
          return `
            <div class="notif-item${unread ? ' unread' : ''}" data-id="${n.id}" data-link="${n.link || ''}"
                 style="display:flex;align-items:flex-start;gap:12px;padding:12px 16px;
                        border-bottom:1px solid var(--gray-200);cursor:pointer;
                        background:${unread ? 'var(--primary-light)' : 'var(--white)'};">
              <div style="width:34px;height:34px;border-radius:50%;flex-shrink:0;
                          display:flex;align-items:center;justify-content:center;
                          background:var(--primary-light);">
                <span style="display:block;width:16px;height:16px;background:var(--accent);
                             -webkit-mask-image:${iconPath};mask-image:${iconPath};
                             mask-size:contain;mask-repeat:no-repeat;
                             -webkit-mask-size:contain;-webkit-mask-repeat:no-repeat;"></span>
              </div>
              <div style="flex:1;min-width:0;">
                <div style="font-size:13px;font-weight:600;color:var(--gray-800);margin-bottom:2px;
                            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(n.title)}</div>
                <div style="font-size:12px;color:var(--gray-600);">${escHtml(n.message || '')}</div>
                <div style="font-size:11px;color:var(--gray-400);margin-top:4px;">${escHtml(n.time_ago)}</div>
              </div>
            </div>`;
        }).join('');

        notifList.querySelectorAll('[data-id]').forEach(el => {
          el.addEventListener('click', function () {
            const id   = this.dataset.id;
            const link = this.dataset.link;
            if (this.classList.contains('unread')) {
              fetch(`/admin/api/notifications/${id}/read`, { method: 'POST' }).catch(() => {});
              this.classList.remove('unread');
              this.style.background = 'var(--white)';
              fetchUnreadCount();
            }
            if (link && link !== 'null' && link !== '') {
              notifDropdown.classList.remove('open');
              window.location.href = link;
            }
          });
        });
      }).catch(() => {
        notifList.innerHTML = '<div style="padding:20px 16px;text-align:center;color:var(--gray-400);font-size:13px;">Could not load notifications.</div>';
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
      pgInfo.textContent = `Showing ${start + 1}–${showing} of ${totalRows} user${totalRows !== 1 ? 's' : ''}`;
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