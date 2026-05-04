/* ================================================================
   DASHBOARD_OFFICER.JS — Loan Officer Dashboard
   Sidebar toggle, notifications, pagination, search
   Style: 100% consistent with admin dashboard
   ================================================================ */

(function () {
  'use strict';

  /* ================================================================
     SIDEBAR TOGGLE
     ================================================================ */
  const burgerBtn = document.getElementById('burgerBtn');
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const SIDEBAR_KEY = 'hiraya_officer_sidebar_open';
  const isMobile = () => window.innerWidth <= 768;

  function openSidebar() {
    document.body.classList.add('sidebar-open');
    if (isMobile()) sidebarOverlay?.classList.add('active');
    if (!isMobile()) localStorage.setItem(SIDEBAR_KEY, '1');
  }

  function closeSidebar() {
    document.body.classList.remove('sidebar-open');
    sidebarOverlay?.classList.remove('active');
    if (!isMobile()) localStorage.setItem(SIDEBAR_KEY, '0');
  }

  function toggleSidebar() {
    document.body.classList.contains('sidebar-open') ? closeSidebar() : openSidebar();
  }

  // Restore desktop preference
  if (!isMobile() && localStorage.getItem(SIDEBAR_KEY) !== '0') {
    openSidebar();
  }

  burgerBtn?.addEventListener('click', toggleSidebar);
  sidebarOverlay?.addEventListener('click', closeSidebar);

  // Close sidebar on nav click (mobile)
  sidebar?.querySelectorAll('.nav-item, .user-dropdown a').forEach(link => {
    link.addEventListener('click', () => {
      if (isMobile()) closeSidebar();
    });
  });

  window.addEventListener('resize', () => {
    if (!isMobile()) {
      sidebarOverlay?.classList.remove('active');
      if (localStorage.getItem(SIDEBAR_KEY) !== '0') openSidebar();
    } else {
      closeSidebar();
    }
  });

  /* ================================================================
     USER DROPDOWN
     ================================================================ */
  const userToggle = document.getElementById('userDropdownToggle');
  const userDropdown = document.getElementById('userDropdown');

  userToggle?.addEventListener('click', function (e) {
    e.stopPropagation();
    userDropdown?.classList.toggle('open');
    userToggle?.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (!userToggle?.contains(e.target) && !userDropdown?.contains(e.target)) {
      userDropdown?.classList.remove('open');
      userToggle?.classList.remove('open');
    }
  });

  /* ================================================================
     NOTIFICATION PERSISTENCE (localStorage)
     ================================================================ */
  const NOTIF_READ_KEY = 'hiraya_officer_read_notifs';
  const notifBtn = document.getElementById('notifBtn');
  const notifDropdown = document.getElementById('notifDropdown');
  const notifDot = document.getElementById('notifDot');
  const notifMarkAll = document.getElementById('notifMarkAll');
  const notifWrap = document.getElementById('notifWrap');

  function getReadSet() {
    try {
      return new Set(JSON.parse(localStorage.getItem(NOTIF_READ_KEY) || '[]'));
    } catch (e) {
      return new Set();
    }
  }

  function saveReadSet(set) {
    try {
      localStorage.setItem(NOTIF_READ_KEY, JSON.stringify([...set]));
    } catch (e) { /* quota exceeded, silent fail */ }
  }

  function markNotifRead(el) {
    el.classList.remove('unread');
    el.classList.add('read-local');
    el.querySelector('.notif-unread-dot')?.remove();
  }

  // Apply persisted read state on load
  const readSet = getReadSet();
  document.querySelectorAll('.notif-item[data-notif-id]').forEach(item => {
    const id = item.dataset.notifId;
    if (readSet.has(id)) {
      markNotifRead(item);
    }
  });

  function refreshNotifDot() {
    const stillUnread = document.querySelectorAll('.notif-item.unread').length;
    stillUnread > 0
      ? notifDot?.classList.remove('hidden')
      : notifDot?.classList.add('hidden');
  }
  refreshNotifDot();

  notifBtn?.addEventListener('click', function (e) {
    e.stopPropagation();
    notifDropdown?.classList.toggle('open');
  });

  // Mark individual notif as read when clicked
  document.querySelectorAll('.notif-item[data-notif-id] .notif-item-link').forEach(link => {
    link.addEventListener('click', () => {
      const item = link.closest('.notif-item[data-notif-id]');
      if (!item) return;
      const id = item.dataset.notifId;
      if (!item.classList.contains('unread')) return;
      markNotifRead(item);
      readSet.add(id);
      saveReadSet(readSet);
      refreshNotifDot();
    });
  });

  // Mark all as read
  notifMarkAll?.addEventListener('click', () => {
    document.querySelectorAll('.notif-item[data-notif-id]').forEach(item => {
      markNotifRead(item);
      readSet.add(item.dataset.notifId);
    });
    saveReadSet(readSet);
    refreshNotifDot();
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!notifWrap?.contains(e.target)) {
      notifDropdown?.classList.remove('open');
    }
  });

  /* ================================================================
     ACTIVE NAV HIGHLIGHT
     ================================================================ */
  const currentPath = window.location.pathname;
  document.querySelectorAll('.nav-item[href]').forEach((el) => {
    const href = el.getAttribute('href');
    if (href && href !== '#' && currentPath.startsWith(href) && href !== '/') {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      el.classList.add('active');
    }
  });

  /* ================================================================
     STAT CARD ENTRANCE ANIMATION
     ================================================================ */
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (!entry.isIntersecting) return;
      setTimeout(() => entry.target.classList.add('visible'), i * 100);
      obs.unobserve(entry.target);
    });
  }, { threshold: 0.2 });

  document.querySelectorAll('.stat-card').forEach((card, i) => {
    if (i < 4) {
      setTimeout(() => card.classList.add('visible'), i * 120);
    } else {
      obs.observe(card);
    }
  });

  /* ================================================================
     AUTO-DISMISS FLASH MESSAGES
     ================================================================ */
  setTimeout(() => {
    document.querySelectorAll('.flash-msg').forEach(el => el.remove());
  }, 5000);

  /* ================================================================
     TABLE PAGINATION — 10 rows per page (client-side)
     ================================================================ */
  const ROWS_PER_PAGE = 10;
  const tableBody = document.getElementById('appTableBody');
  const paginationWrap = document.getElementById('paginationWrap');
  const paginationInfo = document.getElementById('paginationInfo');
  const pageNumbers = document.getElementById('pageNumbers');
  const pagePrev = document.getElementById('pagePrev');
  const pageNext = document.getElementById('pageNext');
  const appSearch = document.getElementById('appSearch');

  let currentPage = 1;
  let allRows = [];
  let filteredRows = [];

  function initPagination() {
    if (!tableBody) return;
    allRows = Array.from(tableBody.querySelectorAll('tr')).filter(
      r => !r.id || r.id !== 'emptyRow'
    );
    filteredRows = [...allRows];
    renderPage(1);
  }

  function renderPage(page) {
    currentPage = page;
    const total = filteredRows.length;
    const totalPages = Math.ceil(total / ROWS_PER_PAGE) || 1;
    const start = (page - 1) * ROWS_PER_PAGE;
    const end = Math.min(start + ROWS_PER_PAGE, total);

    // Show/hide rows
    allRows.forEach(r => r.style.display = 'none');
    filteredRows.forEach((r, idx) => {
      r.style.display = (idx >= start && idx < end) ? '' : 'none';
    });

    // Handle empty state row
    const emptyRow = document.getElementById('emptyRow');
    if (total === 0) {
      if (emptyRow) emptyRow.style.display = '';
    } else {
      if (emptyRow) emptyRow.style.display = 'none';
    }

    // Pagination visibility
    if (total <= ROWS_PER_PAGE && !appSearch?.value.trim()) {
      paginationWrap?.classList.add('hidden');
      return;
    }
    paginationWrap?.classList.remove('hidden');

    // Info text
    if (paginationInfo) {
      paginationInfo.textContent = total === 0
        ? 'No results found'
        : `Showing ${start + 1}–${end} of ${total} application${total !== 1 ? 's' : ''}`;
    }

    // Prev / Next
    if (pagePrev) pagePrev.disabled = page <= 1;
    if (pageNext) pageNext.disabled = page >= totalPages;

    // Page number buttons
    if (pageNumbers) {
      pageNumbers.innerHTML = '';
      const maxVisible = 5;
      let startPage = Math.max(1, page - Math.floor(maxVisible / 2));
      let endPage = Math.min(totalPages, startPage + maxVisible - 1);
      if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
      }

      for (let p = startPage; p <= endPage; p++) {
        const btn = document.createElement('button');
        btn.className = 'page-num' + (p === page ? ' active' : '');
        btn.textContent = p;
        btn.type = 'button';
        btn.addEventListener('click', () => renderPage(p));
        pageNumbers.appendChild(btn);
      }
    }
  }

  pagePrev?.addEventListener('click', () => {
    if (currentPage > 1) renderPage(currentPage - 1);
  });

  pageNext?.addEventListener('click', () => {
    const totalPages = Math.ceil(filteredRows.length / ROWS_PER_PAGE) || 1;
    if (currentPage < totalPages) renderPage(currentPage + 1);
  });

  // Search filtering
  appSearch?.addEventListener('input', () => {
    const q = appSearch.value.trim().toLowerCase();
    filteredRows = q
      ? allRows.filter(r => r.textContent.toLowerCase().includes(q))
      : [...allRows];
    renderPage(1);
  });

  // Initialize pagination on load
  initPagination();

  /* ================================================================
     FLASH MESSAGE CLOSE HANDLER
     ================================================================ */
  document.querySelectorAll('.f-close').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.parentElement?.remove();
    });
  });

})();