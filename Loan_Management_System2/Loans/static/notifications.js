/**
 * notifications.js — Full Notifications Page
 */

(function () {
  'use strict';

  const tabs  = document.querySelectorAll('.notif-tab');
  const items = document.querySelectorAll('.npi');

  /* ── Filter tabs ─────────────────────────────────────────────── */
  tabs.forEach(tab => {
    tab.addEventListener('click', function () {
      tabs.forEach(t => t.classList.remove('active'));
      this.classList.add('active');

      const filter = this.dataset.filter;

      items.forEach(item => {
        const type   = item.dataset.type;
        const isRead = item.dataset.read === '1';

        let show = false;
        if (filter === 'all') {
          show = true;
        } else if (filter === 'unread') {
          show = !isRead;
        } else {
          show = type === filter;
        }

        item.classList.toggle('hidden', !show);
      });
    });
  });

  /* ── Mark single item as read on click ──────────────────────── */
  items.forEach(item => {
    item.addEventListener('click', function (e) {
      if (e.target.classList.contains('npi-view')) return;

      const id   = this.dataset.id;
      const link = this.dataset.link;

      if (this.dataset.read === '0') {
        fetch(`/loans/api/notifications/${id}/read`, { method: 'POST' })
          .then(() => {
            this.dataset.read = '1';
            this.classList.remove('npi--unread');
            this.querySelector('.npi-dot')?.remove();
            updateUnreadCount();
          })
          .catch(() => {});
      }

      if (link && link !== '') {
        window.location.href = link;
      }
    });
  });

  /* ── Mark all as read ────────────────────────────────────────── */
  document.getElementById('markAllBtn')?.addEventListener('click', function () {
    fetch('/loans/api/notifications/read-all', { method: 'POST' })
      .then(r => r.json())
      .then(() => {
        items.forEach(item => {
          item.dataset.read = '1';
          item.classList.remove('npi--unread');
          item.querySelector('.npi-dot')?.remove();
        });
        this.style.display = 'none';
        updateUnreadCount(0);
      })
      .catch(() => {});
  });

  /* ── Update subtitle ─────────────────────────────────────────── */
  function updateUnreadCount(forceCount) {
    const count = forceCount !== undefined
      ? forceCount
      : document.querySelectorAll('.npi[data-read="0"]').length;

    const subtitle = document.querySelector('.topbar-left p');
    const badge    = document.querySelector('.unread-badge');

    if (count > 0) {
      if (subtitle) subtitle.innerHTML = `<span class="unread-badge">${count} unread</span>`;
    } else {
      if (subtitle) subtitle.textContent = 'All caught up! 🎉';
      badge?.remove();
    }

    // Also update the Unread tab count
    const tabCount = document.querySelector('.notif-tab[data-filter="unread"] .tab-count');
    if (tabCount) {
      if (count > 0) {
        tabCount.textContent = count;
      } else {
        tabCount.remove();
      }
    }
  }

})();