/* ================================================================
   report_paid_loans.js — Sidebar, Notifications, Filter Validation
   ================================================================ */

(function () {
  'use strict';

  /* ================================================================
     SIDEBAR TOGGLE
     ================================================================ */
  const burgerBtn      = document.getElementById('burgerBtn');
  const sidebar        = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const SIDEBAR_KEY    = 'hiraya_admin_sidebar_open';
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

  /* Restore desktop preference on load */
  if (!isMobile() && localStorage.getItem(SIDEBAR_KEY) !== '0') {
    openSidebar();
  }

  burgerBtn?.addEventListener('click', toggleSidebar);
  sidebarOverlay?.addEventListener('click', closeSidebar);

  sidebar?.querySelectorAll('.nav-item, .user-dropdown a').forEach(link => {
    link.addEventListener('click', () => { if (isMobile()) closeSidebar(); });
  });

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
     NOTIFICATIONS — localStorage persistence
     ================================================================ */
  const NOTIF_READ_KEY = 'hiraya_admin_read_notifs';
  const notifBtn       = document.getElementById('notifBtn');
  const notifDropdown  = document.getElementById('notifDropdown');
  const notifDot       = document.getElementById('notifDot');
  const notifMarkAll   = document.getElementById('notifMarkAll');
  const notifWrap      = document.getElementById('notifWrap');
  const notifList      = document.getElementById('notifList');

  function getReadSet() {
    try { return new Set(JSON.parse(localStorage.getItem(NOTIF_READ_KEY) || '[]')); }
    catch (e) { return new Set(); }
  }

  function saveReadSet(set) {
    try { localStorage.setItem(NOTIF_READ_KEY, JSON.stringify([...set])); }
    catch (e) { /* quota */ }
  }

  function markNotifItemRead(el) {
    el.classList.remove('unread');
    el.classList.add('read-local');
    el.querySelectorAll('.notif-unread-dot').forEach(d => d.remove());
  }

  function refreshNotifDot() {
    const stillUnread = notifList?.querySelectorAll('.notif-item.unread').length ?? 0;
    stillUnread > 0
      ? notifDot?.classList.remove('hidden')
      : notifDot?.classList.add('hidden');
  }

  /* Apply persisted read state on load */
  const readSet = getReadSet();
  notifList?.querySelectorAll('.notif-item[data-notif-id]').forEach(item => {
    if (readSet.has(item.dataset.notifId)) markNotifItemRead(item);
  });
  refreshNotifDot();

  /* Toggle dropdown */
  notifBtn?.addEventListener('click', function (e) {
    e.stopPropagation();
    notifDropdown?.classList.toggle('open');
  });

  /* Close when clicking outside */
  document.addEventListener('click', (e) => {
    if (!notifWrap?.contains(e.target)) notifDropdown?.classList.remove('open');
  });

  /* Mark individual as read on click */
  notifList?.addEventListener('click', function (e) {
    const item = e.target.closest('.notif-item[data-notif-id]');
    if (!item || !item.classList.contains('unread')) return;
    markNotifItemRead(item);
    readSet.add(item.dataset.notifId);
    saveReadSet(readSet);
    refreshNotifDot();
  });

  /* Mark all as read */
  notifMarkAll?.addEventListener('click', () => {
    notifList?.querySelectorAll('.notif-item[data-notif-id]').forEach(item => {
      markNotifItemRead(item);
      readSet.add(item.dataset.notifId);
    });
    saveReadSet(readSet);
    refreshNotifDot();
  });

  /* ================================================================
     ACTIVE NAV HIGHLIGHT
     ================================================================ */
  const currentPath = window.location.pathname;
  document.querySelectorAll('.nav-item[href]').forEach(el => {
    const href = el.getAttribute('href');
    if (href && href !== '#' && currentPath.startsWith(href) && href !== '/') {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      el.classList.add('active');
    }
  });

  /* ================================================================
     FILTER FORM VALIDATION
     Requires BOTH date_from and date_to — or NEITHER
     ================================================================ */
  const filterForm  = document.getElementById('filterForm');
  const dateFrom    = document.getElementById('dateFrom');
  const dateTo      = document.getElementById('dateTo');
  const filterError = document.getElementById('filterError');

  filterForm?.addEventListener('submit', function (e) {
    const from = dateFrom?.value.trim();
    const to   = dateTo?.value.trim();

    /* Case 1: BOTH dates are empty — block submission */
    if (!from && !to) {
      e.preventDefault();
      filterError.innerHTML = '<span class="filter-error-icon">⚠</span> Please select a <strong>Date From</strong> and <strong>Date To</strong> to filter results.';
      filterError?.classList.remove('hidden');
      dateFrom?.style.setProperty('border-color', '#ef4444');
      dateTo?.style.setProperty('border-color', '#ef4444');
      dateFrom?.focus();
      return;
    }

    /* Case 2: Only one date is filled */
    if (from && !to) {
      e.preventDefault();
      filterError.innerHTML = '<span class="filter-error-icon">⚠</span> Please also select a <strong>Date To</strong> to complete the filter.';
      filterError?.classList.remove('hidden');
      dateTo?.style.setProperty('border-color', '#ef4444');
      dateTo?.focus();
      return;
    }

    if (!from && to) {
      e.preventDefault();
      filterError.innerHTML = '<span class="filter-error-icon">⚠</span> Please also select a <strong>Date From</strong> to complete the filter.';
      filterError?.classList.remove('hidden');
      dateFrom?.style.setProperty('border-color', '#ef4444');
      dateFrom?.focus();
      return;
    }

    /* Case 3: date_from is after date_to */
    if (from > to) {
      e.preventDefault();
      filterError.innerHTML = '<span class="filter-error-icon">⚠</span> <strong>Date From</strong> cannot be later than <strong>Date To</strong>.';
      filterError?.classList.remove('hidden');
      dateFrom?.style.setProperty('border-color', '#ef4444');
      dateTo?.style.setProperty('border-color', '#ef4444');
      return;
    }

    /* All good — hide error and allow submit */
    filterError?.classList.add('hidden');
  });

  /* Clear red border and error when user picks a date */
  [dateFrom, dateTo].forEach(input => {
    input?.addEventListener('change', () => {
      input.style.removeProperty('border-color');
      /* Hide error only if both fields are now valid */
      const from = dateFrom?.value.trim();
      const to   = dateTo?.value.trim();
      if (from && to && from <= to) {
        filterError?.classList.add('hidden');
      }
    });
  });

})();