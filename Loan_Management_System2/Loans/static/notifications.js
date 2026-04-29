/**
 * notifications.js
 * Handles: sidebar toggle, user dropdown, notification page tabs and mark-all */

(function () {
  'use strict';

  /* ================================================================
     SIDEBAR TOGGLE
     ================================================================ */
  const burgerBtn      = document.getElementById('burgerBtn');
  const sidebar        = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const SIDEBAR_KEY    = 'hiraya_sidebar_open';
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

  /* Close on nav click (mobile) */
  sidebar?.querySelectorAll('.nav-item, .user-dropdown a').forEach(link => {
    link.addEventListener('click', () => { if (isMobile()) closeSidebar(); });
  });

  /* Re-evaluate on resize */
  window.addEventListener('resize', () => {
    if (!isMobile()) {
      sidebarOverlay.classList.remove('active');
      if (localStorage.getItem(SIDEBAR_KEY) !== '0') openSidebar();
    } else {
      closeSidebar();
    }
  });

  /* ================================================================
     USER DROPDOWN
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
     ACTIVE NAV HIGHLIGHT
     ================================================================ */
  const path = window.location.pathname;
  document.querySelectorAll('.nav-item').forEach(function (el) {
    const href = el.getAttribute('href');
    if (href && href !== '#' && path.startsWith(href)) {
      el.classList.add('active');
    }
  });

  /* ================================================================
     NOTIFICATION PAGE TABS & MARK ALL READ
     ================================================================ */
  const markAllBtn = document.getElementById('markAllBtn');
  const notifItems = document.querySelectorAll('.npi');
  const tabs = document.querySelectorAll('.notif-tab');

  // Filter function
  function filterNotifications(filter) {
    notifItems.forEach(item => {
      if (filter === 'all') {
        item.classList.remove('hidden');
      } else if (filter === 'unread') {
        const isUnread = item.classList.contains('npi--unread');
        item.classList.toggle('hidden', !isUnread);
      } else if (filter === 'loan_approved') {
        const type = item.dataset.type;
        item.classList.toggle('hidden', type !== 'loan_approved' && type !== 'payment_received' && type !== 'loan_disbursed');
      } else if (filter === 'payment_due') {
        const type = item.dataset.type;
        item.classList.toggle('hidden', type !== 'payment_due' && type !== 'payment_received');
      }
    });
  }

  // Tab click handlers
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const filter = tab.dataset.filter;
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      filterNotifications(filter);
    });
  });

  // Mark all as read functionality
  if (markAllBtn) {
    markAllBtn.addEventListener('click', async () => {
      try {
        const response = await fetch('/loans/api/notifications/read-all', { method: 'POST' });
        const data = await response.json();
        
        if (data.success) {
          // Update UI - remove unread styles
          notifItems.forEach(item => {
            item.classList.remove('npi--unread');
            const dot = item.querySelector('.npi-dot');
            if (dot) dot.remove();
          });
          
          // Update unread count display
          const unreadBadge = document.querySelector('.unread-badge');
          const tabCount = document.querySelector('.notif-tab[data-filter="unread"] .tab-count');
          
          if (unreadBadge) {
            unreadBadge.remove();
            const pageSub = document.querySelector('.notif-page-sub');
            if (pageSub) pageSub.innerHTML = 'All caught up!';
          }
          
          if (tabCount) tabCount.remove();
          
          // Hide mark all button
          markAllBtn.style.display = 'none';
        }
      } catch (error) {
        console.error('Error marking all as read:', error);
      }
    });
  }

  // Click handler for individual notification items
  notifItems.forEach(item => {
    item.addEventListener('click', async function(e) {
      // Don't trigger if clicking on a link
      if (e.target.closest('.npi-view')) return;
      
      const id = this.dataset.id;
      const link = this.dataset.link;
      const isUnread = this.classList.contains('npi--unread');
      
      if (isUnread && id) {
        try {
          await fetch(`/loans/api/notifications/${id}/read`, { method: 'POST' });
          this.classList.remove('npi--unread');
          const dot = this.querySelector('.npi-dot');
          if (dot) dot.remove();
          
          // Update unread count in header
          const unreadBadge = document.querySelector('.unread-badge');
          const tabCount = document.querySelector('.notif-tab[data-filter="unread"] .tab-count');
          let currentCount = 0;
          
          if (tabCount) {
            currentCount = parseInt(tabCount.textContent) - 1;
            if (currentCount > 0) {
              tabCount.textContent = currentCount;
            } else {
              tabCount.remove();
            }
          }
          
          if (unreadBadge) {
            if (currentCount > 0) {
              unreadBadge.textContent = currentCount;
            } else {
              unreadBadge.remove();
              const pageSub = document.querySelector('.notif-page-sub');
              if (pageSub) pageSub.innerHTML = 'All caught up!';
              if (markAllBtn) markAllBtn.style.display = 'none';
            }
          }
        } catch (error) {
          console.error('Error marking notification as read:', error);
        }
      }
      
      // Navigate if there's a link
      if (link && link !== 'null' && link !== '') {
        window.location.href = link;
      }
    });
  });

})();