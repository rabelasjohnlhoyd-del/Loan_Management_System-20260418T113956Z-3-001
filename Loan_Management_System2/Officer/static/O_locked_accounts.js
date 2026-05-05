/* ================================================================
   O_LOCKED_ACCOUNTS.JS — Officer Locked Accounts Page
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

})();