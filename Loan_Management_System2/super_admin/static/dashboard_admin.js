/* ================================================================
   dashboard_admin.js — Admin Dashboard
   Sidebar toggle matches borrower dashboard pattern exactly
   ================================================================ */

(function () {
  'use strict';

  /* ================================================================
     SIDEBAR TOGGLE — same pattern as borrower dashboard
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

  /* Close via overlay tap (mobile) */
  sidebarOverlay?.addEventListener('click', closeSidebar);

  /* Close sidebar when a nav link is clicked on mobile */
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
     USER DROPDOWN (sidebar)
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
     NOTIFICATION DROPDOWN
     ================================================================ */
  const notifBtn      = document.getElementById('notifBtn');
  const notifDropdown = document.getElementById('notifDropdown');
  const notifDot      = document.getElementById('notifDot');
  const notifMarkAll  = document.getElementById('notifMarkAll');
  const notifWrap     = document.getElementById('notifWrap');

  /* Show red dot if there are unread notifications on load */
  const unreadCount = document.querySelectorAll('.notif-item.unread').length;
  if (unreadCount > 0) {
    notifDot?.classList.remove('hidden');
  } else {
    notifDot?.classList.add('hidden');
  }

  notifBtn?.addEventListener('click', function (e) {
    e.stopPropagation();
    notifDropdown?.classList.toggle('open');
  });

  /* Mark all as read — removes unread class + dot, closes dropdown */
  notifMarkAll?.addEventListener('click', () => {
    document.querySelectorAll('.notif-item.unread').forEach(el => {
      el.classList.remove('unread');
      el.querySelector('.notif-unread-dot')?.remove();
    });
    notifDot?.classList.add('hidden');
  });

  /* Close when clicking outside */
  document.addEventListener('click', (e) => {
    if (!notifWrap?.contains(e.target)) {
      notifDropdown?.classList.remove('open');
    }
  });

  /* ================================================================
     ALERT BANNER DISMISS
     ================================================================ */
  document.getElementById('closeAlert')?.addEventListener('click', () => {
    document.getElementById('pendingAlert')?.classList.add('hidden');
  });

  /* ================================================================
     ACTIVE NAV HIGHLIGHT
     ================================================================ */
  const currentPath = window.location.pathname;
  document.querySelectorAll('.nav-item[href]').forEach((el) => {
    const href = el.getAttribute('href');
    if (href && href !== '#' && currentPath.startsWith(href) && href !== '/') {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      el.classList.add('active');
    }
  });

  /* ================================================================
     STAT CARD ENTRANCE ANIMATION
     ================================================================ */
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (!entry.isIntersecting) return;
      setTimeout(() => entry.target.classList.add('visible'), i * 100);
      obs.unobserve(entry.target);
    });
  }, { threshold: 0.2 });

  document.querySelectorAll('.stat-card[data-animate]').forEach(c => obs.observe(c));

  /* Fallback for cards without data-animate */
  document.querySelectorAll('.stat-card:not([data-animate])').forEach((card, i) => {
    setTimeout(() => card.classList.add('visible'), i * 120);
  });

  /* ================================================================
     TABLE SEARCH
     ================================================================ */
  const appSearch = document.getElementById('appSearch');
  const appTable  = document.getElementById('applicationsTable');

  appSearch?.addEventListener('input', () => {
    const q = appSearch.value.trim().toLowerCase();
    appTable?.querySelectorAll('tbody tr').forEach(row => {
      row.style.display = q && !row.textContent.toLowerCase().includes(q) ? 'none' : '';
    });
  });

  /* ================================================================
     AUTO-DISMISS FLASH MESSAGES
     ================================================================ */
  setTimeout(() => {
    document.querySelectorAll('.flash-msg').forEach(el => el.remove());
  }, 5000);

  /* ================================================================
     ACTIVITY FEED HELPER (for dynamic additions)
     ================================================================ */
  window.addAdminActivity = function (color, message) {
    const list = document.getElementById('activityList');
    if (!list) return;

    list.querySelector('.activity-empty')?.remove();

    const item = document.createElement('div');
    item.className = 'activity-item';
    item.style.cssText = 'opacity:0;transform:translateY(-8px);transition:opacity .3s,transform .3s';
    item.innerHTML = `
      <span class="activity-dot activity-dot--${color}"></span>
      <div class="activity-content">
        <p>${message}</p>
        <span class="activity-time">Just now</span>
      </div>`;
    list.prepend(item);
    requestAnimationFrame(() => {
      item.style.opacity   = '1';
      item.style.transform = 'translateY(0)';
    });

    const items = list.querySelectorAll('.activity-item');
    if (items.length > 8) items[items.length - 1].remove();
  };

})();