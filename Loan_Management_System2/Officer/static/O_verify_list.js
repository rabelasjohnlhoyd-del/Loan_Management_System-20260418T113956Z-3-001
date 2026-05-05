/* ================================================================
   O_VERIFY_LIST.JS — Officer ID Verification Page
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

  /* Photo lightbox on click */
  document.querySelectorAll('.photo-frame img').forEach(img => {
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', () => {
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position:fixed;inset:0;background:rgba(0,0,0,0.85);
        display:flex;align-items:center;justify-content:center;
        z-index:9999;cursor:zoom-out;padding:24px;
      `;
      const bigImg = document.createElement('img');
      bigImg.src = img.src;
      bigImg.style.cssText = `
        max-width:90vw;max-height:85vh;
        border-radius:8px;object-fit:contain;
        box-shadow:0 8px 32px rgba(0,0,0,0.5);
      `;
      overlay.appendChild(bigImg);
      document.body.appendChild(overlay);
      overlay.addEventListener('click', () => overlay.remove());

      // Close on Escape
      const escHandler = (e) => {
        if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', escHandler); }
      };
      document.addEventListener('keydown', escHandler);
    });
  });

})();