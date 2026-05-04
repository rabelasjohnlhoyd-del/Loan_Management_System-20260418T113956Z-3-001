/* ================================================================
   my_applications.js — My Applications Page Scripts
   Sidebar logic mirrors my_loans.js exactly
   ================================================================ */

(function () {
  'use strict';

  /* ================================================================
     SIDEBAR TOGGLE
     ================================================================ */
  const burgerBtn      = document.getElementById('burgerBtn');
  const sidebar        = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const SIDEBAR_KEY    = 'hiraya_sidebar_open';
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
     TABLE PAGINATION — 10 rows per page
     ================================================================ */
  (function initPagination() {
    const tbody   = document.querySelector('.data-table tbody');
    const pgBar   = document.getElementById('paginationBar');
    const pgInfo  = document.getElementById('pgInfo');
    const pgPages = document.getElementById('pgPages');
    const pgFirst = document.getElementById('pgFirst');
    const pgPrev  = document.getElementById('pgPrev');
    const pgNext  = document.getElementById('pgNext');
    const pgLast  = document.getElementById('pgLast');

    if (!tbody || !pgBar) return;

    const ROWS_PER_PAGE = 10;
    const allRows       = Array.from(tbody.querySelectorAll('tr'));
    const totalRows     = allRows.length;

    if (totalRows <= ROWS_PER_PAGE) return;

    const totalPages = Math.ceil(totalRows / ROWS_PER_PAGE);
    let currentPage  = 1;

    function showPage(page) {
      currentPage = Math.max(1, Math.min(page, totalPages));

      const start = (currentPage - 1) * ROWS_PER_PAGE;
      const end   = start + ROWS_PER_PAGE;

      allRows.forEach((row, i) => {
        row.style.display = (i >= start && i < end) ? '' : 'none';
      });

      const from = start + 1;
      const to   = Math.min(end, totalRows);
      if (pgInfo) pgInfo.textContent = `Showing ${from}–${to} of ${totalRows} applications`;

      if (pgFirst) pgFirst.disabled = currentPage === 1;
      if (pgPrev)  pgPrev.disabled  = currentPage === 1;
      if (pgNext)  pgNext.disabled  = currentPage === totalPages;
      if (pgLast)  pgLast.disabled  = currentPage === totalPages;

      if (!pgPages) return;
      pgPages.innerHTML = '';
      buildPageRange(currentPage, totalPages).forEach(p => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pg-page-btn' +
          (p === currentPage ? ' active' : '') +
          (p === '...' ? ' ellipsis' : '');
        btn.textContent = p;
        if (p !== '...' && p !== currentPage) {
          btn.addEventListener('click', () => showPage(p));
        }
        pgPages.appendChild(btn);
      });
    }

    function buildPageRange(current, total) {
      if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
      if (current <= 4)         return [1, 2, 3, 4, 5, '...', total];
      if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
      return [1, '...', current - 1, current, current + 1, '...', total];
    }

    pgFirst?.addEventListener('click', () => showPage(1));
    pgPrev?.addEventListener ('click', () => showPage(currentPage - 1));
    pgNext?.addEventListener ('click', () => showPage(currentPage + 1));
    pgLast?.addEventListener ('click', () => showPage(totalPages));

    showPage(1);
  })();

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

    fetch('/loans/api/notifications')
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

    notifList.innerHTML = items.map(n => `
      <div class="notif-item ${n.is_read ? '' : 'unread'}" data-id="${n.id}">
        <div class="notif-item-icon">
          <span style="
            -webkit-mask-image: url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27currentColor%27%3E%3Cpath d=%27M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z%27/%3E%3C/svg%3E');
            mask-image: url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27currentColor%27%3E%3Cpath d=%27M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z%27/%3E%3C/svg%3E');
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
    fetch(`/loans/api/notifications/${id}/read`, { method: 'POST' })
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
    fetch('/loans/api/notifications/read-all', { method: 'POST' })
      .then(res => {
        if (res.ok) {
          notifList.querySelectorAll('.notif-item.unread').forEach(el => updateUnreadUI(el));
        }
      })
      .catch(() => {});
  });

  fetch('/loans/api/notifications/count')
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


  (function initStatusModal() {
    const SEEN_KEY = 'hiraya_seen_statuses';

    const backdrop   = document.getElementById('statusModalBackdrop');
    const modal      = document.getElementById('statusModal');
    const iconWrap   = document.getElementById('statusModalIconWrap');
    const titleEl    = document.getElementById('statusModalTitle');
    const refEl      = document.getElementById('statusModalRef');
    const msgEl      = document.getElementById('statusModalMsg');
    const reasonBox  = document.getElementById('statusModalReasonBox');
    const reasonText = document.getElementById('statusModalReasonText');
    const actionsEl  = document.getElementById('statusModalActions');
    const appsBadge  = document.getElementById('appsBadge'); 

    if (!backdrop || !modal) return;

    const apps     = window.__APP_STATUSES__ || [];
    const applyUrl = window.__APPLY_URL__    || '#';

    let seenIds = [];
    try {
      seenIds = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
    } catch (_) { seenIds = []; }

    const hasUnseenUpdate = apps.some(a => 
      (a.status === 'approved' || a.status === 'rejected') && !seenIds.includes(a.id)
    );

    if (hasUnseenUpdate && appsBadge) {
      appsBadge.classList.remove('hidden');
    }

  
    const target = apps.find(function (a) {
      return (a.status === 'approved' || a.status === 'rejected') &&
             !seenIds.includes(a.id);
    });

    if (!target) return; 


    const isApproved = target.status === 'approved';
    const variant    = isApproved ? 'approved' : 'rejected';

    iconWrap.setAttribute('data-variant', variant);

    titleEl.textContent = isApproved
      ? '🎉 Loan Application Approved!'
      : 'Application Not Approved';

    refEl.textContent = 'Ref: ' + target.ref;

    const amountFormatted = Number(target.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 });

    if (isApproved) {
      msgEl.textContent =
        'Great news, ' + target.type + ' worth ₱' + amountFormatted +
        ' has been approved. Our team will be in touch regarding the next steps.';
      reasonBox.classList.remove('visible');
  
      actionsEl.innerHTML =
        '<button type="button" class="sm-btn-secondary" id="smDismiss">Got it, thanks!</button>';
    } else {
      const reason = (target.reason || '').trim();
      msgEl.textContent =
        'Unfortunately, your ' + target.type + ' application (₱' + amountFormatted +
        ') was not approved at this time.';
      if (reason) {
        reasonText.textContent = reason;
        reasonBox.classList.add('visible');
      } else {
        reasonBox.classList.remove('visible');
      }
      actionsEl.innerHTML =
        '<a href="' + applyUrl + '" class="sm-btn-apply">Apply for a New Loan</a>' +
        '<button type="button" class="sm-btn-secondary" id="smDismiss">Maybe later</button>';
    }

    function openModal() {
      backdrop.classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    function closeModal() {
      backdrop.classList.remove('open');
      document.body.style.overflow = '';
      
      if (!seenIds.includes(target.id)) {
        seenIds.push(target.id);
        localStorage.setItem(SEEN_KEY, JSON.stringify(seenIds));
      }
      
      if (appsBadge) appsBadge.classList.add('hidden');
    }

    setTimeout(openModal, 800);

    actionsEl.addEventListener('click', function (e) {
      if (e.target.id === 'smDismiss' || e.target.closest('#smDismiss')) {
        closeModal();
      }
    });

    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && backdrop.classList.contains('open')) closeModal(); });

  })();

})();