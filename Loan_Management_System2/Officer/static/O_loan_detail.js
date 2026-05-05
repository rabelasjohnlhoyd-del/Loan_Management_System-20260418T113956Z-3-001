/* ================================================================
   O_LOAN_DETAIL.JS — Officer Loan Detail Page
   ================================================================ */
(function () {
  'use strict';

  /* Sidebar dropdown toggle */
  const toggle = document.getElementById('userDropdownToggle');
  const dropdown = document.getElementById('userDropdown');

  if (toggle && dropdown) {
    toggle.addEventListener('click', () => {
      const isOpen = dropdown.classList.toggle('open');
      toggle.classList.toggle('open', isOpen);
    });

    document.addEventListener('click', (e) => {
      if (!toggle.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.remove('open');
        toggle.classList.remove('open');
      }
    });
  }

  /* Auto-dismiss flash messages */
  document.querySelectorAll('.flash-msg').forEach(msg => {
    setTimeout(() => {
      msg.style.opacity = '0';
      msg.style.transform = 'translateY(-8px)';
      msg.style.transition = 'opacity 0.4s, transform 0.4s';
      setTimeout(() => msg.remove(), 400);
    }, 4000);
  });

  /* Animate progress bar on load */
  window.addEventListener('load', () => {
    document.querySelectorAll('.progress-bar-fill').forEach(bar => {
      const target = bar.style.width;
      bar.style.width = '0';
      requestAnimationFrame(() => {
        bar.style.transition = 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)';
        bar.style.width = target;
      });
    });

    document.querySelectorAll('.balance-bar-fill').forEach(bar => {
      const target = bar.style.width;
      bar.style.width = '0';
      requestAnimationFrame(() => {
        bar.style.transition = 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
        bar.style.width = target;
      });
    });
  });

})();