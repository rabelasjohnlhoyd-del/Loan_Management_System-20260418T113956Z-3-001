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
  const NOTIF_KEY    = 'hiraya_officer_read_notifs';
  const notifBtn     = document.getElementById('notifBtn');
  const notifDrop    = document.getElementById('notifDropdown');
  const notifDot     = document.getElementById('notifDot');
  const notifMarkAll = document.getElementById('notifMarkAll');
  const notifWrap    = document.getElementById('notifWrap');
  const notifList    = document.getElementById('notifList');

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

  // ── BUILD NOTIFICATION LIST FROM INJECTED DATA ──────────────
  function buildNotifList() {
    const logs = window.HIRAYA_ACTIVITY_LOGS || [];
    if (!notifList) return;

    if (!logs.length) {
      // Keep the hardcoded empty state as-is
      return;
    }

    const readSet = getReadSet();
    notifList.innerHTML = ''; // clear hardcoded empty state

    logs.forEach(log => {
      const id      = String(log.id);
      const isRead  = readSet.has(id);
      const action  = (log.action || '')
                        .replace(/_/g, ' ')
                        .replace(/\b\w/g, c => c.toUpperCase());
      const details = log.details || '';
      const actor   = log.actor_name || '';
      const time    = log.created_at || '';

      // Format time
      let timeStr = time;
      try {
        const d = new Date(time);
        if (!isNaN(d)) {
          timeStr = d.toLocaleString('en-PH', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
          });
        }
      } catch {}

      // Truncate details to keep UI clean
      let detailText = details;
      if (detailText.length > 60) detailText = detailText.substring(0, 60) + '…';
      if (actor) detailText = [detailText, `by ${actor}`].filter(Boolean).join(' · ');

      const li = document.createElement('li');
      li.className = `notif-item ${isRead ? 'read-local' : 'unread'}`;
      li.dataset.notifId = id;
      li.innerHTML = `
        <span class="notif-icon-wrap">
          <span class="topbar-icon" style="display:inline-flex;width:28px;height:28px;background:var(--surface-2,#f0f4f8);border-radius:50%;align-items:center;justify-content:center;font-size:13px;">🕐</span>
          ${!isRead ? '<span class="notif-unread-dot" style="position:absolute;top:10px;right:12px;width:8px;height:8px;border-radius:50%;background:var(--primary,#0d9488);"></span>' : ''}
        </span>
        <div class="notif-body" style="flex:1;min-width:0;">
          <div class="notif-action" style="font-weight:600;font-size:13px;color:var(--text-primary,#1e293b);">${action}</div>
          ${detailText ? `<div class="notif-detail" style="font-size:12px;color:var(--text-muted,#64748b);margin-top:2px;word-break:break-word;">${detailText}</div>` : ''}
          <div class="notif-time" style="font-size:11px;color:var(--text-muted,#94a3b8);margin-top:4px;">${timeStr}</div>
        </div>
      `;
      notifList.appendChild(li);
    });
  }

  buildNotifList();

  // Re-apply persisted reads after building
  const readSet = getReadSet();
  document.querySelectorAll('.notif-item[data-notif-id]').forEach(item => {
    if (readSet.has(item.dataset.notifId)) markRead(item);
  });
  refreshDot();

  // Bell toggle
  notifBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = notifDrop?.classList.toggle('open');
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

  // Mark all as read
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