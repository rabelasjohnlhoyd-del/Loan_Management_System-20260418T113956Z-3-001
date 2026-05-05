/* ================================================================
   O_VERIFY_LIST.JS — Officer ID Verification Page
   Core (sidebar / dropdown / flash-dismiss) handled by hiraya_officer_core.js
   ================================================================ */

(function () {
  'use strict';

  /* ── PHOTO LIGHTBOX ─────────────────────────────────────────── */
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

      const escHandler = (e) => {
        if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', escHandler); }
      };
      document.addEventListener('keydown', escHandler);
    });
  });

})();