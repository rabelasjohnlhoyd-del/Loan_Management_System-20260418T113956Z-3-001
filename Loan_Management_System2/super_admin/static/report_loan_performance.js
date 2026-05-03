/* ================================================================
   report_loan_performance.js
   Standalone JS — Loan Performance Report Page
   Hiraya Management System
   ================================================================ */

(function () {
  'use strict';

  /* ================================================================
     SIDEBAR TOGGLE
     Same pattern as dashboard_admin.js / reports.js
     ================================================================ */
  const sidebar        = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const burgerBtn      = document.getElementById('burgerBtn');
  const SIDEBAR_KEY    = 'hiraya_admin_sidebar_open';

  const isMobile = () => window.innerWidth <= 768;

  function openSidebar() {
    document.body.classList.add('sidebar-open');
    if (isMobile() && sidebarOverlay) sidebarOverlay.classList.add('active');
    if (!isMobile()) localStorage.setItem(SIDEBAR_KEY, '1');
  }

  function closeSidebar() {
    document.body.classList.remove('sidebar-open');
    if (sidebarOverlay) sidebarOverlay.classList.remove('active');
    if (!isMobile()) localStorage.setItem(SIDEBAR_KEY, '0');
  }

  function toggleSidebar() {
    document.body.classList.contains('sidebar-open') ? closeSidebar() : openSidebar();
  }

  /* Restore desktop preference on load */
  if (!isMobile() && localStorage.getItem(SIDEBAR_KEY) !== '0') {
    openSidebar();
  }

  burgerBtn?.addEventListener('click', toggleSidebar);
  sidebarOverlay?.addEventListener('click', closeSidebar);

  /* Close on nav link click (mobile) */
  sidebar?.querySelectorAll('.nav-item').forEach(link => {
    link.addEventListener('click', () => {
      if (isMobile()) closeSidebar();
    });
  });

  window.addEventListener('resize', () => {
    if (!isMobile()) {
      sidebarOverlay?.classList.remove('active');
      if (localStorage.getItem(SIDEBAR_KEY) !== '0') openSidebar();
    } else {
      closeSidebar();
    }
  });

  /* ================================================================
     ACTIVE NAV HIGHLIGHT
     Marks the current page's nav item as active
     ================================================================ */
  const currentPath = window.location.pathname;
  document.querySelectorAll('.nav-item[href]').forEach((el) => {
    el.classList.remove('active');
    const href = el.getAttribute('href');
    if (href && currentPath.startsWith(href) && href !== '/') {
      el.classList.add('active');
    }
  });

  /* ================================================================
     AUTO-DISMISS FLASH MESSAGES
     ================================================================ */
  setTimeout(() => {
    document.querySelectorAll('.flash-msg').forEach(el => {
      el.style.transition = 'opacity .4s ease';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 400);
    });
  }, 5000);

})();