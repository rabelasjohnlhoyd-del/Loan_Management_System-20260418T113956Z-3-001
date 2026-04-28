/* ================================================================
   APPLY.JS — Loan Application Page
   Consolidated: sidebar toggle, user dropdown, notification bell,
   toast system, status modal queue, progress steps, form logic.
   Based on dashboard_borrower.js patterns.
   ================================================================ */

(function () {
  'use strict';

  /* ================================================================
     1. SIDEBAR TOGGLE
     ================================================================ */
  const burgerBtn      = document.getElementById('burgerBtn');
  const sidebar        = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const SIDEBAR_KEY    = 'hiraya_sidebar_open';
  const isMobile       = () => window.innerWidth <= 768;

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

  /* Restore desktop preference on page load */
  if (!isMobile() && localStorage.getItem(SIDEBAR_KEY) !== '0') {
    openSidebar();
  }

  burgerBtn?.addEventListener('click', toggleSidebar);
  sidebarOverlay?.addEventListener('click', closeSidebar);

  /* Close sidebar when a nav link is clicked on mobile */
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

  /* ================================================================
     2. USER DROPDOWN (sidebar)
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
     3. NOTIFICATION BELL
     ================================================================ */
  const NOTIF_ICONS = {
    loan_approved:    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'/%3E%3C/svg%3E\")",
    loan_rejected:    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z'/%3E%3C/svg%3E\")",
    loan_disbursed:   "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l6.59-6.59L18 9l-9 9z'/%3E%3C/svg%3E\")",
    payment_due:      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'/%3E%3C/svg%3E\")",
    payment_received: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'/%3E%3C/svg%3E\")",
    id_verified:      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z'/%3E%3C/svg%3E\")",
    id_rejected:      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z'/%3E%3C/svg%3E\")",
    general:          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z'/%3E%3C/svg%3E\")",
  };

  const notifBtn      = document.getElementById('notifBtn');
  const notifDropdown = document.getElementById('notifDropdown');
  const notifDot      = document.getElementById('notifDot');
  const notifList     = document.getElementById('notifList');
  const notifMarkAll  = document.getElementById('notifMarkAll');

  function fetchUnreadCount() {
    fetch('/loans/api/notifications/count')
      .then(r => r.json())
      .then(data => {
        if (data.count > 0) {
          notifDot?.classList.remove('hidden');
        } else {
          notifDot?.classList.add('hidden');
        }
      }).catch(() => {});
  }

  fetchUnreadCount();
  setInterval(fetchUnreadCount, 60000);

  function renderNotifItem(n) {
    const iconPath = NOTIF_ICONS[n.type] || NOTIF_ICONS['general'];
    const unread   = !n.is_read;
    return `
      <div class="notif-item${unread ? ' unread' : ''}" data-id="${n.id}" data-link="${n.link || ''}">
        <div class="notif-item-icon notif-icon--${n.type}">
          <span style="-webkit-mask-image:${iconPath}; mask-image:${iconPath};"></span>
        </div>
        <div class="notif-item-body">
          <div class="notif-item-title">${escHtml(n.title)}</div>
          <div class="notif-item-msg">${escHtml(n.message || '')}</div>
          <div class="notif-item-time">${escHtml(n.time_ago)}</div>
        </div>
        ${unread ? '<span class="notif-unread-dot"></span>' : ''}
      </div>`;
  }

  function fetchNotifications() {
    if (!notifList) return;
    notifList.innerHTML = `<div class="notif-loading"><div class="notif-spinner"></div><span>Loading notifications...</span></div>`;
    fetch('/loans/api/notifications')
      .then(r => r.json())
      .then(data => {
        const items = data.notifications || [];
        if (items.length === 0) {
          notifList.innerHTML = `<div class="notif-empty"><div class="notif-empty-icon"></div><p>You're all caught up!</p><small>No new notifications</small></div>`;
          return;
        }
        notifList.innerHTML = items.map(renderNotifItem).join('');
        notifList.querySelectorAll('.notif-item').forEach(el => {
          el.addEventListener('click', function () {
            const id   = this.dataset.id;
            const link = this.dataset.link;
            if (this.classList.contains('unread')) {
              fetch(`/loans/api/notifications/${id}/read`, { method: 'POST' })
                .then(() => {
                  this.classList.remove('unread');
                  this.querySelector('.notif-unread-dot')?.remove();
                  fetchUnreadCount();
                }).catch(() => {});
            }
            if (link && link !== 'null' && link !== '') {
              notifDropdown?.classList.remove('open');
              window.location.href = link;
            }
          });
        });
      }).catch(() => {
        notifList.innerHTML = '<div class="notif-empty"><p>Could not load notifications.</p></div>';
      });
  }

  notifBtn?.addEventListener('click', function (e) {
    e.stopPropagation();
    const opening = !notifDropdown.classList.contains('open');
    notifDropdown.classList.toggle('open');
    if (opening) fetchNotifications();
  });

  document.addEventListener('click', (e) => {
    if (!document.getElementById('notifWrap')?.contains(e.target)) {
      notifDropdown?.classList.remove('open');
    }
  });

  notifMarkAll?.addEventListener('click', () => {
    fetch('/loans/api/notifications/read-all', { method: 'POST' })
      .then(() => {
        notifList?.querySelectorAll('.notif-item.unread').forEach(el => {
          el.classList.remove('unread');
          el.querySelector('.notif-unread-dot')?.remove();
        });
        notifDot?.classList.add('hidden');
      }).catch(() => {});
  });

  /* ================================================================
     4. TOAST NOTIFICATION SYSTEM
     ================================================================ */
  const toastStyle = document.createElement('style');
  toastStyle.textContent = `
    #toast-container{position:fixed;top:76px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:8px;pointer-events:none;}

    /* Base toast — white card, mint left border, subtle mint shadow */
    .toast{
      pointer-events:all;
      min-width:300px;max-width:360px;
      background:#ffffff;
      border-radius:10px;
      padding:13px 16px;
      display:flex;align-items:flex-start;gap:10px;
      box-shadow:0 4px 20px rgba(42,144,128,0.15), 0 1px 4px rgba(42,144,128,0.08);
      border:1px solid #deecea;
      border-left:4px solid #3ab5a0;
      animation:toastIn .3s cubic-bezier(.21,1.02,.73,1) forwards;
      font-size:13px;line-height:1.5;
      font-family:'DM Sans',sans-serif;
    }

    /* Per-type left border + icon bg colors */
    .toast.toast--success{ border-left-color:#22c55e; }
    .toast.toast--danger { border-left-color:#e05252; }
    .toast.toast--warning{ border-left-color:#f59e0b; }
    .toast.toast--info   { border-left-color:#3ab5a0; }

    /* Icon bubble */
    .toast-icon{
      width:30px;height:30px;border-radius:8px;
      display:flex;align-items:center;justify-content:center;
      font-size:14px;flex-shrink:0;margin-top:1px;
    }
    .toast--success .toast-icon{ background:#f0fdf4; }
    .toast--danger  .toast-icon{ background:#fdf0f0; }
    .toast--warning .toast-icon{ background:#fffbea; }
    .toast--info    .toast-icon{ background:#e6f7f4; }

    .toast-body{ flex:1;min-width:0; }
    .toast-title{ font-weight:600;font-size:13px;margin-bottom:1px;color:#2c4a47; }
    .toast-msg  { font-size:12px;color:#9bbcb7;line-height:1.4; }

    .toast-close{
      background:none;border:none;
      color:#9bbcb7;cursor:pointer;
      font-size:15px;padding:0;line-height:1;
      flex-shrink:0;margin-top:1px;
      transition:color .15s;
    }
    .toast-close:hover{ color:#2c4a47; }

    .toast.toast--out{ animation:toastOut .25s ease forwards; }
    @keyframes toastIn {
      from{ opacity:0; transform:translateX(24px) scale(.97); }
      to  { opacity:1; transform:translateX(0)    scale(1);   }
    }
    @keyframes toastOut{
      from{ opacity:1; transform:translateX(0) scale(1);    max-height:120px; margin-bottom:0;   }
      to  { opacity:0; transform:translateX(24px) scale(.97); max-height:0;     margin-bottom:-8px; }
    }
  `;
  document.head.appendChild(toastStyle);

  const toastContainer = document.createElement('div');
  toastContainer.id = 'toast-container';
  document.body.appendChild(toastContainer);

  window.showToast = function (type, title, msg, duration) {
    duration = duration || 5000;
    const icons = { success: '✅', danger: '❌', warning: '⚠️', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = 'toast toast--' + type;
    toast.innerHTML =
      `<span class="toast-icon">${icons[type] || 'ℹ️'}</span>` +
      `<div class="toast-body">` +
        `<div class="toast-title">${title}</div>` +
        (msg ? `<div class="toast-msg">${msg}</div>` : '') +
      `</div>` +
      `<button class="toast-close" aria-label="Close">✕</button>`;
    toastContainer.appendChild(toast);
    toast.querySelector('.toast-close').addEventListener('click', () => dismissToast(toast));
    toast._t = setTimeout(() => dismissToast(toast), duration);
  };

  function dismissToast(toast) {
    clearTimeout(toast._t);
    toast.classList.add('toast--out');
    setTimeout(() => toast.remove(), 350);
  }

  /* ================================================================
     5. STATUS NOTIFICATION MODAL QUEUE
     ================================================================ */
  (function () {
    if (typeof _NOTIFICATIONS === 'undefined' || !_NOTIFICATIONS.length) return;

    const CONFIG = {
      approved: {
        icon: '🎉', heading: 'Application Approved!', color: 'approved',
        cardLabel: 'Great news',
        cardText: 'Your loan amount will be processed and disbursed to your registered account. Check My Loans for your repayment schedule.',
        tips: [
          'Your loan will be disbursed shortly.',
          'Check your registered contact for disbursement details.',
          'Review your repayment schedule under My Loans.',
          'Set reminders for your monthly due dates to avoid penalties.',
        ],
        primaryLabel: 'View My Loans →',
        primaryFn: () => { window.location.href = '/loans'; },
      },
      rejected: {
        icon: '❌', heading: 'Application Not Approved', color: 'rejected',
        cardLabel: 'Reason from reviewer',
        tips: [
          'Read the reason carefully before reapplying.',
          'Ensure your ID verification is fully approved.',
          'Consider applying for a lower amount or a longer term.',
          'Reach out to your loan officer for further guidance.',
        ],
        primaryLabel: 'Apply Again →',
        primaryFn: () => { window.location.reload(); },
      },
      under_review: {
        icon: '🔍', heading: 'Application Under Review', color: 'under_review',
        cardLabel: 'Status update',
        cardText: 'Our loan officers are currently reviewing your documents and application details. This usually takes 1–3 business days.',
        tips: [
          'Your application is currently being evaluated.',
          'This typically takes 1–3 business days.',
          'Make sure your profile information is complete.',
          'You will be notified once a decision has been made.',
        ],
        primaryLabel: 'Got It',
        primaryFn: () => {},
      },
      pending: {
        icon: '⏳', heading: 'Application Pending', color: 'pending',
        cardLabel: 'What\'s next',
        cardText: 'Your application has been submitted and is in the queue for review. Please ensure all required documents are uploaded.',
        tips: [
          'Your application is queued for review.',
          'Ensure all required documents are uploaded.',
          'Complete your profile if not yet done.',
          'Check back in 1–2 business days for an update.',
        ],
        primaryLabel: 'Got It',
        primaryFn: () => {},
      },
    };

    const statusLabels = {
      approved:     ' has been approved.',
      rejected:     ' was reviewed and was not approved at this time.',
      under_review: ' is currently being evaluated by our team.',
      pending:      ' has been submitted and is awaiting review.',
    };

    const modalStyle = document.createElement('style');
    modalStyle.textContent = `
      #sn-overlay{display:none;position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,.65);align-items:center;justify-content:center;backdrop-filter:blur(6px);padding:16px;}
      #sn-overlay.open{display:flex;}
      #sn-box{background:#0f172a;border:1px solid #1e293b;border-radius:20px;padding:36px 32px;width:100%;max-width:460px;box-shadow:0 32px 80px rgba(0,0,0,.6);animation:snIn .35s cubic-bezier(.21,1.02,.73,1);}
      @keyframes snIn{from{opacity:0;transform:scale(.9) translateY(20px)}to{opacity:1;transform:scale(1) translateY(0)}}
      .sn-icon-wrap{width:72px;height:72px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 18px;font-size:32px;}
      .sn-icon-wrap.rejected{background:rgba(239,68,68,.12);border:2px solid rgba(239,68,68,.3);}
      .sn-icon-wrap.approved{background:rgba(34,197,94,.12);border:2px solid rgba(34,197,94,.3);}
      .sn-icon-wrap.under_review{background:rgba(56,189,248,.12);border:2px solid rgba(56,189,248,.3);}
      .sn-icon-wrap.pending{background:rgba(245,158,11,.12);border:2px solid rgba(245,158,11,.3);}
      #sn-box h3{text-align:center;font-size:20px;font-weight:700;margin:0 0 6px;}
      #sn-box h3.rejected{color:#ef4444;}#sn-box h3.approved{color:#22c55e;}
      #sn-box h3.under_review{color:#38bdf8;}#sn-box h3.pending{color:#f59e0b;}
      #sn-box .sn-sub{color:#94a3b8;font-size:13px;text-align:center;margin:0 0 20px;line-height:1.7;}
      .sn-card{border-radius:10px;padding:14px 16px;margin-bottom:16px;}
      .sn-card.rejected{background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.2);border-left:4px solid #ef4444;}
      .sn-card.approved{background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.2);border-left:4px solid #22c55e;}
      .sn-card.under_review{background:rgba(56,189,248,.06);border:1px solid rgba(56,189,248,.2);border-left:4px solid #38bdf8;}
      .sn-card.pending{background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.2);border-left:4px solid #f59e0b;}
      .sn-card-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:6px;}
      .sn-card-text{color:#e2e8f0;font-size:13px;line-height:1.6;}
      .sn-divider{height:1px;background:#1e293b;margin:16px 0;}
      .sn-tips-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#64748b;margin-bottom:8px;}
      .sn-tip{display:flex;align-items:flex-start;gap:8px;font-size:12px;color:#94a3b8;line-height:1.5;margin-bottom:5px;}
      .sn-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;margin-top:5px;}
      .sn-dot.rejected{background:#ef4444;}.sn-dot.approved{background:#22c55e;}
      .sn-dot.under_review{background:#38bdf8;}.sn-dot.pending{background:#f59e0b;}
      .sn-actions{display:flex;gap:10px;margin-top:22px;}
      .sn-btn{flex:1;padding:11px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;border:none;transition:all .2s;}
      .sn-btn:hover{opacity:.85;transform:translateY(-1px);}
      .sn-dismiss{background:#1e293b;color:#94a3b8;}
      .sn-primary.rejected{background:#ef4444;color:#fff;}
      .sn-primary.approved{background:#22c55e;color:#fff;}
      .sn-primary.under_review{background:#38bdf8;color:#0f172a;}
      .sn-primary.pending{background:#f59e0b;color:#0f172a;}
      .sn-counter{display:inline-block;background:#334155;color:#94a3b8;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;margin:0 auto 14px;text-align:center;}
    `;
    document.head.appendChild(modalStyle);

    const queue = _NOTIFICATIONS.filter(n => {
      const key = 'sn_seen_' + n.id + '_' + n.status;
      try { return !localStorage.getItem(key); } catch (e) { return true; }
    });

    if (!queue.length) return;

    let currentIndex = 0;

    const overlay = document.createElement('div');
    overlay.id = 'sn-overlay';
    overlay.innerHTML = `
      <div id="sn-box" role="dialog" aria-modal="true">
        <div id="sn-counter" class="sn-counter" style="display:none;"></div>
        <div id="sn-icon-wrap" class="sn-icon-wrap"></div>
        <h3 id="sn-heading"></h3>
        <p id="sn-sub" class="sn-sub"></p>
        <div id="sn-card" class="sn-card">
          <div id="sn-card-label" class="sn-card-label"></div>
          <div id="sn-card-text" class="sn-card-text"></div>
        </div>
        <div class="sn-divider"></div>
        <div class="sn-tips-label">What you can do next</div>
        <div id="sn-tips"></div>
        <div class="sn-actions">
          <button class="sn-btn sn-dismiss" id="sn-dismiss-btn">Dismiss</button>
          <button class="sn-btn sn-primary" id="sn-primary-btn"></button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    function markSeen(n) {
      try { localStorage.setItem('sn_seen_' + n.id + '_' + n.status, '1'); } catch (e) {}
    }

    function renderModal(index) {
      const n   = queue[index];
      const cfg = CONFIG[n.status] || CONFIG['pending'];

      const counter = document.getElementById('sn-counter');
      if (queue.length > 1) {
        counter.textContent = (index + 1) + ' of ' + queue.length;
        counter.style.display = 'block';
      } else {
        counter.style.display = 'none';
      }

      const iconWrap = document.getElementById('sn-icon-wrap');
      iconWrap.className = 'sn-icon-wrap ' + cfg.color;
      iconWrap.textContent = cfg.icon;

      const heading = document.getElementById('sn-heading');
      heading.className = cfg.color;
      heading.textContent = cfg.heading;

      document.getElementById('sn-sub').innerHTML =
        `Your <strong style="color:#e2e8f0">${n.type_name}</strong> application` +
        (n.reference_no ? ` <strong style="color:#e2e8f0">(${n.reference_no})</strong>` : '') +
        (statusLabels[n.status] || '.');

      const card = document.getElementById('sn-card');
      card.className = 'sn-card ' + cfg.color;
      document.getElementById('sn-card-label').textContent = cfg.cardLabel;
      document.getElementById('sn-card-text').textContent  =
        n.status === 'rejected'
          ? (n.rejection_reason || 'No specific reason was provided. Please contact your loan officer.')
          : cfg.cardText;

      document.getElementById('sn-tips').innerHTML = cfg.tips.map(t =>
        `<div class="sn-tip"><span class="sn-dot ${cfg.color}"></span>${t}</div>`
      ).join('');

      const primaryBtn = document.getElementById('sn-primary-btn');
      primaryBtn.className = 'sn-btn sn-primary ' + cfg.color;
      primaryBtn.textContent = (queue.length > 1 && index < queue.length - 1) ? 'Next →' : cfg.primaryLabel;

      overlay._currentCfg = cfg;
      overlay._currentN   = n;
    }

    function openModal(index) {
      renderModal(index);
      const box = document.getElementById('sn-box');
      box.style.animation = 'none';
      void box.offsetWidth;
      box.style.animation = '';
      overlay.classList.add('open');
    }

    function closeAndNext() {
      markSeen(overlay._currentN);
      currentIndex++;
      overlay.classList.remove('open');
      if (currentIndex < queue.length) {
        setTimeout(() => openModal(currentIndex), 350);
      }
    }

    document.getElementById('sn-dismiss-btn').addEventListener('click', closeAndNext);

    document.getElementById('sn-primary-btn').addEventListener('click', function () {
      const cfg    = overlay._currentCfg;
      const isLast = currentIndex >= queue.length - 1;
      markSeen(overlay._currentN);
      currentIndex++;
      overlay.classList.remove('open');
      if (currentIndex < queue.length) {
        setTimeout(() => openModal(currentIndex), 350);
      } else if (isLast) {
        cfg.primaryFn();
      }
    });

    overlay.addEventListener('click', e => { if (e.target === overlay) closeAndNext(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && overlay.classList.contains('open')) closeAndNext();
    });

    setTimeout(() => openModal(0), 500);
  })();

  /* ================================================================
     6. APPLICATION PROGRESS STEPS
     ================================================================ */
  (function () {
    const form = document.getElementById('apply-form');
    if (!form) return;

    const stepStyle = document.createElement('style');
    stepStyle.textContent = `
      #apply-steps{display:flex;align-items:center;gap:0;margin-bottom:24px;}
      .apply-step{display:flex;align-items:center;gap:8px;flex:1;}
      .apply-step:last-child{flex:none;}
      .step-dot{width:28px;height:28px;border-radius:50%;background:#e8f7f5;border:2px solid #b2ddd7;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#2a9485;flex-shrink:0;transition:all .3s;}
      .step-dot.active{background:#2a9080;border-color:#2a9080;color:#ffffff;}
      .step-dot.done{background:#1e6e60;border-color:#1e6e60;color:#ffffff;}
      .step-label{font-size:11px;color:#94a3b8;white-space:nowrap;}
      .step-label.active{color:#2a9080;font-weight:600;}
      .step-line{flex:1;height:2px;background:#b2ddd7;margin:0 4px;}
      .step-line.done{background:#1e6e60;}
      .amt-slider-wrap{margin-top:8px;}
      .amt-slider-wrap input[type=range]{width:100%;accent-color:#3ab5a0;cursor:pointer;}
      .amt-slider-labels{display:flex;justify-content:space-between;font-size:11px;color:#64748b;margin-top:4px;}
      @keyframes calcPulse{0%{background:#d4f0eb}100%{background:transparent}}
      .calc-pulse{animation:calcPulse .6s ease;}
    `;
    document.head.appendChild(stepStyle);

    const stepsEl = document.createElement('div');
    stepsEl.id = 'apply-steps';
    stepsEl.innerHTML = `
      <div class="apply-step">
        <div class="step-dot active" id="sdot-1">1</div>
        <span class="step-label active" id="slbl-1">Loan Type</span>
      </div>
      <div class="step-line" id="sline-1"></div>
      <div class="apply-step">
        <div class="step-dot" id="sdot-2">2</div>
        <span class="step-label" id="slbl-2">Plan</span>
      </div>
      <div class="step-line" id="sline-2"></div>
      <div class="apply-step">
        <div class="step-dot" id="sdot-3">3</div>
        <span class="step-label" id="slbl-3">Amount &amp; Term</span>
      </div>
      <div class="step-line" id="sline-3"></div>
      <div class="apply-step">
        <div class="step-dot" id="sdot-4">4</div>
        <span class="step-label" id="slbl-4">Submit</span>
      </div>`;
    form.insertBefore(stepsEl, form.firstChild);

    window._updateSteps = function (step) {
      for (let i = 1; i <= 4; i++) {
        const dot  = document.getElementById('sdot-' + i);
        const lbl  = document.getElementById('slbl-' + i);
        const line = document.getElementById('sline-' + i);
        if (!dot) continue;
        dot.classList.remove('active', 'done');
        lbl.classList.remove('active');
        if (line) line.classList.remove('done');
        if (i < step)  { dot.classList.add('done'); dot.textContent = '✓'; if (line) line.classList.add('done'); }
        if (i === step) { dot.classList.add('active'); lbl.classList.add('active'); dot.textContent = i; }
        if (i > step)  { dot.textContent = i; }
      }
    };
    window._updateSteps(1);
  })();

  /* ================================================================
     7. MAIN FORM LOGIC
     ================================================================ */
  (function () {
    const loanTypeSelect = document.getElementById('loan_type_id');
    const planGroup      = document.getElementById('plan-group');
    const planSelect     = document.getElementById('loan_plan_id');
    const planHint       = document.getElementById('plan-hint');
    const amountGroup    = document.getElementById('amount-group');
    const amountInput    = document.getElementById('amount');
    const amountHint     = document.getElementById('amount-hint');
    const termGroup      = document.getElementById('term-group');
    const termSelect     = document.getElementById('term_months');
    const submitBtn      = document.getElementById('submit-btn');
    const applyForm      = document.getElementById('apply-form');

    if (!loanTypeSelect || !applyForm) return;

    const calcMonthly   = document.getElementById('calc-monthly');
    const calcPrincipal = document.getElementById('calc-principal');
    const calcRate      = document.getElementById('calc-rate');
    const calcTerm      = document.getElementById('calc-term');
    const calcInterest  = document.getElementById('calc-interest');
    const calcTotal     = document.getElementById('calc-total');

    let selectedPlan = null;

    function peso(val) {
      return '₱' + parseFloat(val || 0).toLocaleString('en-PH', {
        minimumFractionDigits: 2, maximumFractionDigits: 2
      });
    }

    function resetCalculator() {
      if (calcMonthly)   calcMonthly.textContent   = '₱0.00';
      if (calcPrincipal) calcPrincipal.textContent = '₱0.00';
      if (calcRate)      calcRate.textContent       = '0%';
      if (calcTerm)      calcTerm.textContent       = '— months';
      if (calcInterest)  calcInterest.textContent   = '₱0.00';
      if (calcTotal)     calcTotal.textContent      = '₱0.00';
    }

    function monthlyPayment(principal, annualRate, months) {
      if (!principal || !months) return 0;
      if (annualRate === 0) return principal / months;
      const r = (annualRate / 100) / 12;
      return principal * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
    }

    function pulseCalc() {
      document.querySelectorAll('.calc-row.cr-highlight').forEach(r => {
        r.classList.remove('calc-pulse');
        void r.offsetWidth;
        r.classList.add('calc-pulse');
      });
    }

    function updateCalculator() {
      if (!selectedPlan) { resetCalculator(); return; }
      const principal = parseFloat(amountInput.value) || 0;
      const months    = parseInt(termSelect.value)    || 0;
      const rate      = parseFloat(selectedPlan.interest_rate) || 0;
      if (!principal || !months) { resetCalculator(); return; }

      const monthly  = monthlyPayment(principal, rate, months);
      const total    = monthly * months;
      const interest = total - principal;

      if (calcMonthly)   calcMonthly.textContent   = peso(monthly);
      if (calcPrincipal) calcPrincipal.textContent = peso(principal);
      if (calcRate)      calcRate.textContent       = rate + '%';
      if (calcTerm)      calcTerm.textContent       = months + ' month' + (months !== 1 ? 's' : '');
      if (calcInterest)  calcInterest.textContent   = peso(interest);
      if (calcTotal)     calcTotal.textContent      = peso(total);
      pulseCalc();
    }

    function buildAmountSlider(min, max) {
      document.getElementById('amt-slider-wrap')?.remove();
      const wrap = document.createElement('div');
      wrap.id = 'amt-slider-wrap';
      wrap.className = 'amt-slider-wrap';
      wrap.innerHTML = `
        <input type="range" id="amt-slider" min="${min}" max="${max}" step="1000" value="${min}">
        <div class="amt-slider-labels">
          <span>₱${Number(min).toLocaleString()}</span>
          <span>₱${Number(max).toLocaleString()}</span>
        </div>`;
      amountInput.parentElement.after(wrap);

      const slider = document.getElementById('amt-slider');
      slider.addEventListener('input', function () {
        amountInput.value = slider.value;
        updateCalculator();
      });
      amountInput.addEventListener('input', function () {
        const v = parseFloat(amountInput.value);
        if (!isNaN(v)) slider.value = Math.min(Math.max(v, min), max);
        updateCalculator();
      });
    }

    function populatePlans(typeId, preselectPlanId) {
      const filtered = (typeof _PLANS_DATA !== 'undefined' ? _PLANS_DATA : [])
        .filter(p => String(p.loan_type_id) === String(typeId));

      planSelect.innerHTML = '<option value="">— Select Plan —</option>';
      planHint.textContent = '';
      amountGroup.style.display = 'none';
      termGroup.style.display   = 'none';
      amountInput.value         = '';
      termSelect.innerHTML      = '<option value="">— Select Term —</option>';
      selectedPlan              = null;
      resetCalculator();
      document.getElementById('amt-slider-wrap')?.remove();

      if (!filtered.length) { planGroup.style.display = 'none'; return; }

      filtered.forEach(p => {
        const opt = document.createElement('option');
        opt.value       = p.id;
        opt.textContent = `${p.plan_name} — ${p.interest_rate}% p.a. (₱${Number(p.min_amount).toLocaleString()} – ₱${Number(p.max_amount).toLocaleString()})`;
        planSelect.appendChild(opt);
      });
      planGroup.style.display = '';

      if (preselectPlanId) {
        planSelect.value = preselectPlanId;
        onPlanChange();
      } else if (filtered.length === 1) {
        planSelect.value = filtered[0].id;
        onPlanChange();
        window.showToast('info', 'Plan Auto-Selected', filtered[0].plan_name + ' is the only available plan.', 3500);
      }

      window._updateSteps?.(2);
    }

    function onPlanChange() {
      const planId = planSelect.value;
      if (!planId) {
        amountGroup.style.display = 'none';
        termGroup.style.display   = 'none';
        selectedPlan = null;
        resetCalculator();
        window._updateSteps?.(2);
        return;
      }

      selectedPlan = (typeof _PLANS_DATA !== 'undefined' ? _PLANS_DATA : [])
        .find(p => String(p.id) === String(planId));
      if (!selectedPlan) return;

      amountInput.min         = selectedPlan.min_amount;
      amountInput.max         = selectedPlan.max_amount;
      amountInput.placeholder = `₱${Number(selectedPlan.min_amount).toLocaleString()} – ₱${Number(selectedPlan.max_amount).toLocaleString()}`;
      amountHint.textContent  = `Min: ₱${Number(selectedPlan.min_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}  |  Max: ₱${Number(selectedPlan.max_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
      amountGroup.style.display = '';
      buildAmountSlider(selectedPlan.min_amount, selectedPlan.max_amount);

      termSelect.innerHTML = '<option value="">— Select Term —</option>';
      const minT = parseInt(selectedPlan.term_months_min);
      const maxT = parseInt(selectedPlan.term_months_max);
      let steps  = [];
      if (maxT <= 12) {
        for (let m = minT; m <= maxT; m++) steps.push(m);
      } else {
        for (let m = minT; m <= maxT; m += 6) {
          steps.push(m);
          if (m + 6 > maxT && m !== maxT) steps.push(maxT);
        }
      }
      steps = [...new Set(steps)];
      steps.forEach(t => {
        const opt = document.createElement('option');
        opt.value       = t;
        opt.textContent = `${t} month${t !== 1 ? 's' : ''}${t >= 12 ? ` (${(t / 12).toFixed(1).replace('.0', '')} yr${t >= 24 ? 's' : ''})` : ''}`;
        termSelect.appendChild(opt);
      });
      termGroup.style.display = '';

      let hint = selectedPlan.collateral_required
        ? `<span style="color:#f59e0b;">⚠ Collateral required: ${selectedPlan.collateral_notes || 'See officer for details'}</span>`
        : `<span style="color:#22c55e;">✔ No collateral required</span>`;
      if (parseFloat(selectedPlan.processing_fee) > 0) {
        hint += `<br><span style="color:#94a3b8;font-size:12px;">Processing fee: ${selectedPlan.processing_fee}% of principal</span>`;
      }
      planHint.innerHTML = hint;

      updateCalculator();
      window._updateSteps?.(3);
      window.showToast('success', 'Plan Selected', `${selectedPlan.plan_name} — ${selectedPlan.interest_rate}% p.a.`, 3000);
    }

    /* Upload zone */
    const docInput = document.getElementById('documents');
    const docZone  = document.getElementById('doc-zone');
    if (docInput && docZone) {
      docInput.addEventListener('change', function () {
        const files = docInput.files;
        if (!files || !files.length) return;
        const label = docZone.querySelector('p');
        if (label) label.textContent = files.length + ' file(s) selected';
        const allowed = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
        const maxSize = 5 * 1024 * 1024;
        const oversized = [], invalid = [];
        Array.from(files).forEach(f => {
          if (!allowed.includes(f.type)) invalid.push(f.name);
          if (f.size > maxSize)          oversized.push(f.name);
        });
        if (invalid.length)   window.showToast('danger',  'Invalid File Type', invalid.join(', ')   + ' — only JPG, PNG, PDF.', 5000);
        if (oversized.length) window.showToast('warning', 'File Too Large',    oversized.join(', ') + ' exceeds 5MB.', 5000);
        if (!invalid.length && !oversized.length)
          window.showToast('success', files.length + ' File(s) Ready', 'Documents attached.', 3000);
      });
    }

    /* Amount blur validation */
    amountInput?.addEventListener('blur', function () {
      if (!selectedPlan || !amountInput.value) return;
      const v   = parseFloat(amountInput.value);
      const min = parseFloat(selectedPlan.min_amount);
      const max = parseFloat(selectedPlan.max_amount);
      if (v < min)      window.showToast('warning', 'Amount Too Low',  'Minimum is ' + peso(min), 4000);
      else if (v > max) window.showToast('warning', 'Amount Too High', 'Maximum is ' + peso(max), 4000);
      else window._updateSteps?.(4);
    });

    termSelect?.addEventListener('change', function () {
      updateCalculator();
      if (this.value && amountInput.value) window._updateSteps?.(4);
    });

    /* Form submit */
    applyForm.addEventListener('submit', function (e) {
      const typeId = loanTypeSelect.value;
      const planId = planSelect?.value || '';
      const amount = parseFloat(amountInput?.value || 0);
      const term   = termSelect?.value || '';
      const errors = [];

      if (!typeId) errors.push('Please select a loan type.');
      if (!planId) errors.push('Please select a loan plan.');
      if (!amount || isNaN(amount) || amount <= 0) errors.push('Please enter a valid loan amount.');
      if (!term)   errors.push('Please select a loan term.');
      if (selectedPlan) {
        if (amount < selectedPlan.min_amount || amount > selectedPlan.max_amount) {
          errors.push(`Amount must be between ${peso(selectedPlan.min_amount)} and ${peso(selectedPlan.max_amount)}.`);
        }
      }

      if (errors.length) {
        e.preventDefault();
        errors.forEach((msg, i) => {
          setTimeout(() => window.showToast('danger', 'Required Field', msg, 5000), i * 200);
        });
        return;
      }

      submitBtn.disabled      = true;
      submitBtn.innerHTML     = 'Submitting… <span style="opacity:.6">please wait</span>';
      submitBtn.style.opacity = '0.75';
      window.showToast('info', 'Submitting Application', 'Please wait…', 8000);
    });

    loanTypeSelect.addEventListener('change', function () { populatePlans(this.value); });
    planSelect?.addEventListener('change', onPlanChange);

    /* Auto-select from ?plan= query param */
    (function () {
      if (typeof _SELECTED_PLAN_ID === 'undefined' || !_SELECTED_PLAN_ID) return;
      const targetPlan = (typeof _PLANS_DATA !== 'undefined' ? _PLANS_DATA : [])
        .find(p => String(p.id) === String(_SELECTED_PLAN_ID));
      if (!targetPlan) return;
      loanTypeSelect.value = targetPlan.loan_type_id;
      populatePlans(targetPlan.loan_type_id, _SELECTED_PLAN_ID);
      window.showToast('success', 'Plan Pre-Selected', targetPlan.plan_name + ' has been selected for you.', 4000);
    })();

  })();

  /* ================================================================
     HELPER
     ================================================================ */
  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

})();