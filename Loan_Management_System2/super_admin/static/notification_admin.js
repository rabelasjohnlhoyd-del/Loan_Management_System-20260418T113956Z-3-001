/* ================================================================
   notifications_admin.js — Notifications Page JS
   ================================================================ */

(function () {
  'use strict';

  /* ================================================================
     FILTER TABS
     Filters rows by data-type="applications" or data-type="activity"
     ================================================================ */
  const filterTabs = document.getElementById('filterTabs');
  const feed       = document.getElementById('notifPageFeed');

  filterTabs?.querySelectorAll('.nf-tab').forEach(tab => {
    tab.addEventListener('click', function () {
      /* Update active tab */
      filterTabs.querySelectorAll('.nf-tab').forEach(t => t.classList.remove('active'));
      this.classList.add('active');

      const filter = this.dataset.filter; /* 'all' | 'applications' | 'activity' */

      if (filter === 'all') {
        /* Show everything */
        feed?.querySelectorAll('.notif-section').forEach(s => s.classList.remove('hidden-by-filter'));
        feed?.querySelectorAll('.notif-row').forEach(r => r.classList.remove('hidden-by-filter'));
      } else {
        /* Show only matching sections & rows */
        feed?.querySelectorAll('.notif-section').forEach(section => {
          const sectionType = section.dataset.section;
          if (sectionType === filter) {
            section.classList.remove('hidden-by-filter');
            section.querySelectorAll('.notif-row').forEach(r => r.classList.remove('hidden-by-filter'));
          } else {
            section.classList.add('hidden-by-filter');
          }
        });
      }

      /* Show empty message if nothing visible */
      const anyVisible = feed?.querySelector('.notif-section:not(.hidden-by-filter)');
      let emptyMsg = feed?.querySelector('.notif-filter-empty');
      if (!anyVisible) {
        if (!emptyMsg) {
          emptyMsg = document.createElement('div');
          emptyMsg.className = 'notif-filter-empty notif-page-empty';
          emptyMsg.innerHTML = `
            <div class="notif-page-empty-icon"></div>
            <h3>Nothing here</h3>
            <p>No ${filter} notifications to show.</p>`;
          feed?.appendChild(emptyMsg);
        }
        emptyMsg.style.display = '';
      } else if (emptyMsg) {
        emptyMsg.style.display = 'none';
      }
    });
  });

  /* ================================================================
     MARK ALL READ (page button — POST form handles it server-side,
     but we also visually clear unread state immediately)
     ================================================================ */
  const markAllForm = document.querySelector('form[action*="mark_all_read"]');
  markAllForm?.addEventListener('submit', function () {
    /* Optimistically clear UI before page reload */
    document.querySelectorAll('.notif-row--unread').forEach(row => {
      row.classList.remove('notif-row--unread');
      row.querySelector('.notif-row-unread-dot')?.remove();
    });
  });

  /* ================================================================
     ENTRANCE ANIMATION — stagger rows on page load
     ================================================================ */
  const rows = document.querySelectorAll('.notif-row');
  rows.forEach((row, i) => {
    row.style.opacity    = '0';
    row.style.transform  = 'translateY(10px)';
    row.style.transition = `opacity 0.3s ease ${i * 30}ms, transform 0.3s ease ${i * 30}ms`;
    requestAnimationFrame(() => {
      setTimeout(() => {
        row.style.opacity   = '1';
        row.style.transform = 'translateY(0)';
      }, 50 + i * 30);
    });
  });

  /* Also animate section labels */
  document.querySelectorAll('.notif-section').forEach((sec, i) => {
    sec.style.opacity    = '0';
    sec.style.transform  = 'translateY(8px)';
    sec.style.transition = `opacity 0.35s ease ${i * 80}ms, transform 0.35s ease ${i * 80}ms`;
    requestAnimationFrame(() => {
      setTimeout(() => {
        sec.style.opacity   = '1';
        sec.style.transform = 'translateY(0)';
      }, 20 + i * 80);
    });
  });

})();