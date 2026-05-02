/* ================================================================
   dashboard_officer.js — Loan Officer Dashboard
   Consolidated logic based on Admin JS for consistency.
   ================================================================ */

(function () {
  'use strict';

  /* ── SIDEBAR TOGGLE ── */
  // Note: Add id="burgerBtn" to your menu icon in HTML if you want mobile toggle
  const burgerBtn      = document.getElementById('burgerBtn');
  const sidebar        = document.getElementById('sidebar');
  const SIDEBAR_KEY    = 'hiraya_officer_sidebar_open';
  const isMobile       = () => window.innerWidth <= 768;

  function openSidebar() {
    document.body.classList.add('sidebar-open');
    if (!isMobile()) localStorage.setItem(SIDEBAR_KEY, '1');
  }

  function closeSidebar() {
    document.body.classList.remove('sidebar-open');
    if (!isMobile()) localStorage.setItem(SIDEBAR_KEY, '0');
  }

  function toggleSidebar() {
    document.body.classList.contains('sidebar-open') ? closeSidebar() : openSidebar();
  }

  // Restore sidebar state
  if (!isMobile() && localStorage.getItem(SIDEBAR_KEY) !== '0') {
    openSidebar();
  }

  burgerBtn?.addEventListener('click', toggleSidebar);

  /* ── USER DROPDOWN (Sidebar) ── */
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

  
  const currentPath = window.location.pathname;
  document.querySelectorAll('.nav-item[href]').forEach((el) => {
    const href = el.getAttribute('href');
    if (href && href !== '#' && (currentPath === href || currentPath.startsWith(href)) && href !== '/') {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      el.classList.add('active');
    }
  });

  
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (!entry.isIntersecting) return;
     
      setTimeout(() => entry.target.classList.add('visible'), i * 100);
      obs.unobserve(entry.target);
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.stat-card').forEach((card, i) => {
  
    if (i < 4) {
        setTimeout(() => card.classList.add('visible'), i * 120);
    } else {
        obs.observe(card);
    }
  });

  
  setTimeout(() => {
    document.querySelectorAll('.alert').forEach(el => {
        el.style.opacity = '0';
        el.style.transition = 'opacity 0.5s ease';
        setTimeout(() => el.remove(), 500);
    });
  }, 5000);


  const officerSearch = document.getElementById('officerSearch');
  const tableRows     = document.querySelectorAll('.data-table tbody tr');

  officerSearch?.addEventListener('input', () => {
    const q = officerSearch.value.toLowerCase();
    tableRows.forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(q) ? '' : 'none';
    });
  });

})();