/* ================================================================
   OFFICER_ACTIVITY.JS — Officer Activity Log Page
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

  /* Animate timeline items on load */
  window.addEventListener('load', () => {
    const items = document.querySelectorAll('.timeline-item');
    items.forEach((item, i) => {
      item.style.opacity = '0';
      item.style.transform = 'translateX(-12px)';
      setTimeout(() => {
        item.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
        item.style.opacity = '1';
        item.style.transform = 'translateX(0)';
      }, i * 30);
    });
  });

})();