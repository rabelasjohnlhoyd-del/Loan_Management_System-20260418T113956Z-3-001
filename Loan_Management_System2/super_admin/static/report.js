/* ================================================================
   REPORTS.JS — Reports Page
   - Entrance animations for report cards
   - goAmort() and goBorrowerHistory() navigation helpers
   ================================================================ */

(function () {
  'use strict';

  /* ================================================================
     CARD ENTRANCE ANIMATIONS
     ================================================================ */
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (!entry.isIntersecting) return;
      setTimeout(() => entry.target.classList.add('visible'), i * 100);
      obs.unobserve(entry.target);
    });
  }, { threshold: 0.15 });

  document.querySelectorAll('.report-card[data-animate]').forEach(card => {
    obs.observe(card);
  });

  /* Fallback: cards already in view on load */
  setTimeout(() => {
    document.querySelectorAll('.report-card[data-animate]:not(.visible)').forEach((card, i) => {
      setTimeout(() => card.classList.add('visible'), i * 100);
    });
  }, 100);

  /* ================================================================
     NAVIGATION HELPERS
     Called by inline onclick attributes in the HTML template.
     ================================================================ */

  /**
   * Navigate to the amortization schedule for a given loan ID.
   * Reads the value from #loanIdInput and redirects.
   */
  window.goAmort = function () {
    const input = document.getElementById('loanIdInput');
    if (!input) return;
    const val = input.value.trim();
    if (!val) {
      highlightEmpty(input);
      return;
    }
    window.location.href = '/admin/reports/amortization/' + encodeURIComponent(val);
  };

  /**
   * Navigate to the borrower payment history for a given borrower ID.
   * Reads the value from #borrowerIdInput and redirects.
   */
  window.goBorrowerHistory = function () {
    const input = document.getElementById('borrowerIdInput');
    if (!input) return;
    const val = input.value.trim();
    if (!val) {
      highlightEmpty(input);
      return;
    }
    window.location.href = '/admin/reports/borrower-history/' + encodeURIComponent(val);
  };

  /* ================================================================
     HELPER — briefly highlight an empty required input
     ================================================================ */
  function highlightEmpty(input) {
    input.style.borderColor = 'var(--danger)';
    input.style.boxShadow   = '0 0 0 3px rgba(220,38,38,0.12)';
    input.focus();
    setTimeout(() => {
      input.style.borderColor = '';
      input.style.boxShadow   = '';
    }, 1800);
  }

  /* ================================================================
     ENTER KEY SUPPORT — submit on Enter inside ID inputs
     ================================================================ */
  document.getElementById('loanIdInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') window.goAmort();
  });

  document.getElementById('borrowerIdInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') window.goBorrowerHistory();
  });

  /* ================================================================
     AUTO-DISMISS FLASH MESSAGES
     ================================================================ */
  setTimeout(() => {
    document.querySelectorAll('.flash-msg').forEach(el => el.remove());
  }, 5000);

})();