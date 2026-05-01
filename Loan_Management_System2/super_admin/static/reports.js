/* ================================================================
   reports.js — Reports Page
   Sidebar + dropdown matches dashboard_admin.js exactly
   ================================================================ */

(function () {
  'use strict';

  /* ================================================================
     SIDEBAR TOGGLE — same pattern as dashboard
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
     ACTIVE NAV HIGHLIGHT — mark Reports as active
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
     REPORT CARD ENTRANCE ANIMATION
     ================================================================ */
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (!entry.isIntersecting) return;
      setTimeout(() => entry.target.classList.add('visible'), i * 100);
      obs.unobserve(entry.target);
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.report-card[data-animate]').forEach(c => obs.observe(c));

  /* ================================================================
     AUTO-DISMISS FLASH MESSAGES
     ================================================================ */
  setTimeout(() => {
    document.querySelectorAll('.flash-msg').forEach(el => el.remove());
  }, 5000);

  /* ================================================================
     REPORT NAVIGATION FUNCTIONS
     ================================================================ */
  window.goAmort = function () {
    const val = document.getElementById('loanIdInput').value.trim();
    if (!val) {
      showInputError('loanIdInput', 'Please enter a Loan ID.');
      return;
    }
    let url = "{{ url_for('super_admin.report_amortization', loan_id=0) }}";
    window.location.href = url.replace('/0', '/' + encodeURIComponent(val));
  };

  window.goBorrowerHistory = function () {
    const val = document.getElementById('borrowerIdInput').value.trim();
    if (!val) {
      showInputError('borrowerIdInput', 'Please enter a Borrower ID.');
      return;
    }
    let url = "{{ url_for('super_admin.report_borrower_history', borrower_id=0) }}";
    window.location.href = url.replace('/0', '/' + encodeURIComponent(val));
  };

  /* Allow Enter key on ID inputs */
  document.getElementById('loanIdInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') window.goAmort();
  });
  document.getElementById('borrowerIdInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') window.goBorrowerHistory();
  });

  /* ================================================================
     INPUT ERROR HELPER
     ================================================================ */
  function showInputError(inputId, message) {
    const input = document.getElementById(inputId);
    if (!input) return;

    input.style.borderColor = 'var(--danger)';
    input.style.boxShadow   = '0 0 0 3px rgba(220,38,38,0.12)';
    input.focus();

    // Remove error style on next input
    input.addEventListener('input', () => {
      input.style.borderColor = '';
      input.style.boxShadow   = '';
    }, { once: true });
  }

})();