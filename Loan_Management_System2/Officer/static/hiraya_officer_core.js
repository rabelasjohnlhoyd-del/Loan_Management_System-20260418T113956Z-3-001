/* ================================================================
   HIRAYA_OFFICER_CORE.JS
   Shared: Sidebar toggle · User dropdown · Notifications
   Include this on every Officer page BEFORE page-specific JS.
   ================================================================ */

(function () {
  'use strict';

  /* ── SIDEBAR ──────────────────────────────────────────────── */
  const SIDEBAR_KEY = 'hiraya_officer_sidebar_open';
  const isMobile    = () => window.innerWidth <= 768;

  const burgerBtn      = document.getElementById('burgerBtn');
  const sidebar        = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');

  function openSidebar() {
    document.body.classList.add('sidebar-open');
    if (isMobile()) sidebarOverlay?.classList.add('active');
    else localStorage.setItem(SIDEBAR_KEY, '1');
  }

  function closeSidebar() {
    document.body.classList.remove('sidebar-open');
    sidebarOverlay?.classList.remove('active');
    if (!isMobile()) localStorage.setItem(SIDEBAR_KEY, '0');
  }

  function toggleSidebar() {
    document.body.classList.contains('sidebar-open') ? closeSidebar() : openSidebar();
  }

  // Restore desktop state
  if (!isMobile() && localStorage.getItem(SIDEBAR_KEY) !== '0') openSidebar();

  burgerBtn?.addEventListener('click', toggleSidebar);
  sidebarOverlay?.addEventListener('click', closeSidebar);

  sidebar?.querySelectorAll('.nav-item, .user-dropdown a').forEach(link => {
    link.addEventListener('click', () => { if (isMobile()) closeSidebar(); });
  });

  window.addEventListener('resize', () => {
    if (!isMobile()) {
      sidebarOverlay?.classList.remove('active');
      if (localStorage.getItem(SIDEBAR_KEY) !== '0') openSidebar();
    } else {
      closeSidebar();
    }
  });

  /* ── USER DROPDOWN ───────────────────────────────────────── */
  const userToggle   = document.getElementById('userDropdownToggle');
  const userDropdown = document.getElementById('userDropdown');

  userToggle?.addEventListener('click', function (e) {
    e.stopPropagation();
    const open = userDropdown?.classList.toggle('open');
    userToggle?.classList.toggle('open', open);
  });

  document.addEventListener('click', (e) => {
    if (!userToggle?.contains(e.target) && !userDropdown?.contains(e.target)) {
      userDropdown?.classList.remove('open');
      userToggle?.classList.remove('open');
    }
  });

  /* ── NOTIFICATIONS ───────────────────────────────────────── */
  const NOTIF_KEY  = 'hiraya_officer_read_notifs';
  const notifBtn    = document.getElementById('notifBtn');
  const notifDrop   = document.getElementById('notifDropdown');
  const notifDot    = document.getElementById('notifDot');
  const notifMarkAll = document.getElementById('notifMarkAll');
  const notifWrap   = document.getElementById('notifWrap');
  const notifList   = document.getElementById('notifList');

  function getReadSet() {
    try { return new Set(JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]')); }
    catch { return new Set(); }
  }
  function saveReadSet(s) {
    try { localStorage.setItem(NOTIF_KEY, JSON.stringify([...s])); } catch {}
  }
  function markRead(el) {
    el.classList.remove('unread');
    el.classList.add('read-local');
    el.querySelectorAll('.notif-unread-dot').forEach(d => d.remove());
  }
  function refreshDot() {
    const n = document.querySelectorAll('.notif-item.unread').length;
    notifDot?.classList.toggle('hidden', n === 0);
  }

  // Apply persisted reads
  const readSet = getReadSet();
  document.querySelectorAll('.notif-item[data-notif-id]').forEach(item => {
    if (readSet.has(item.dataset.notifId)) markRead(item);
  });
  refreshDot();

  // Bell toggle
  notifBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = notifDrop?.classList.toggle('open');
    // close user dropdown if open
    if (open) {
      userDropdown?.classList.remove('open');
      userToggle?.classList.remove('open');
    }
  });

  // Click outside → close
  document.addEventListener('click', (e) => {
    if (!notifWrap?.contains(e.target)) notifDrop?.classList.remove('open');
  });

  // Click notif item → mark read
  document.addEventListener('click', (e) => {
    const item = e.target.closest('.notif-item[data-notif-id]');
    if (!item || !item.classList.contains('unread')) return;
    markRead(item);
    readSet.add(item.dataset.notifId);
    saveReadSet(readSet);
    refreshDot();
  });

  // Mark all
  notifMarkAll?.addEventListener('click', () => {
    document.querySelectorAll('.notif-item[data-notif-id]').forEach(item => {
      markRead(item);
      readSet.add(item.dataset.notifId);
    });
    saveReadSet(readSet);
    refreshDot();
  });

  /* ── ACTIVE NAV HIGHLIGHT ────────────────────────────────── */
  const path = window.location.pathname;
  document.querySelectorAll('.nav-item[href]').forEach(el => {
    const href = el.getAttribute('href');
    if (href && href !== '#' && href !== '/' && path.startsWith(href)) {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      el.classList.add('active');
    }
  });

  /* ── STAT CARD ENTRANCE ANIMATION ───────────────────────── */
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (!entry.isIntersecting) return;
      setTimeout(() => entry.target.classList.add('visible'), i * 80);
      obs.unobserve(entry.target);
    });
  }, { threshold: 0.15 });

  document.querySelectorAll('.stat-card').forEach((card, i) => {
    if (i < 5) setTimeout(() => card.classList.add('visible'), i * 100);
    else obs.observe(card);
  });

  /* ── AUTO-DISMISS FLASH MESSAGES ────────────────────────── */
  setTimeout(() => {
    document.querySelectorAll('.flash-msg').forEach(el => {
      el.style.transition = 'opacity .4s, transform .4s';
      el.style.opacity = '0';
      el.style.transform = 'translateY(-6px)';
      setTimeout(() => el.remove(), 400);
    });
  }, 4500);

  // Expose helpers for page-specific JS
  window.HirayaOfficer = { openSidebar, closeSidebar, refreshDot };

})();