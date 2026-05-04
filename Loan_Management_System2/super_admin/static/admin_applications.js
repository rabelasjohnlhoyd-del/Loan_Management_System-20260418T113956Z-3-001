/* ================================================================
   admin_applications.js — Full JS
   Changes vs original:
   1. Notifications: localStorage-based persistence (no API needed)
   2. View modal   : no backdrop-close, no Close button
   3. Approve modal: no backdrop-close, X button only, no Cancel
   4. Reject modal : no backdrop-close, X button only, no Cancel
   5. Result modal : auto-shows on page load when flash has
                     approve/reject message (admin-side only)
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

  if (!isMobile() && localStorage.getItem(SIDEBAR_KEY) !== '0') openSidebar();

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

  const readSet = getReadSet();
  notifList?.querySelectorAll('.notif-item[data-notif-id]').forEach(item => {
    if (readSet.has(item.dataset.notifId)) markNotifItemRead(item);
  });
  refreshNotifDot();

  notifBtn?.addEventListener('click', function (e) {
    e.stopPropagation();
    notifDropdown?.classList.toggle('open');
  });
  document.addEventListener('click', (e) => {
    if (!notifWrap?.contains(e.target)) notifDropdown?.classList.remove('open');
  });

  notifList?.addEventListener('click', function (e) {
    const item = e.target.closest('.notif-item[data-notif-id]');
    if (!item || !item.classList.contains('unread')) return;
    markNotifItemRead(item);
    readSet.add(item.dataset.notifId);
    saveReadSet(readSet);
    refreshNotifDot();
  });

  notifMarkAll?.addEventListener('click', () => {
    notifList?.querySelectorAll('.notif-item[data-notif-id]').forEach(item => {
      markNotifItemRead(item);
      readSet.add(item.dataset.notifId);
    });
    saveReadSet(readSet);
    refreshNotifDot();
  });

  /* ================================================================
     PAGINATION — 10 rows per page, client-side
     ================================================================ */
  const ROWS_PER_PAGE  = 10;
  const tableBody      = document.getElementById('tableBody');
  const paginationWrap = document.getElementById('paginationWrap');
  const paginationInfo = document.getElementById('paginationInfo');
  const paginationBtns = document.getElementById('paginationBtns');
  const resultCount    = document.getElementById('resultCount');

  if (tableBody) {
    const allRows    = Array.from(tableBody.querySelectorAll('tr'));
    const totalRows  = allRows.length;
    const totalPages = Math.ceil(totalRows / ROWS_PER_PAGE);
    let   currentPage = 1;

    if (resultCount) resultCount.textContent = totalRows + ' result(s)';

    function showPage(page) {
      currentPage = page;
      const start = (page - 1) * ROWS_PER_PAGE;
      const end   = start + ROWS_PER_PAGE;

      allRows.forEach((row, i) => {
        row.style.display = (i >= start && i < end) ? '' : 'none';
      });

      const from = totalRows === 0 ? 0 : start + 1;
      const to   = Math.min(end, totalRows);
      if (paginationInfo) {
        paginationInfo.textContent = totalRows === 0
          ? 'No results'
          : 'Showing ' + from + '–' + to + ' of ' + totalRows + ' results';
      }

      if (!paginationBtns) return;
      paginationBtns.innerHTML = '';

      if (totalPages <= 1) {
        if (paginationWrap) paginationWrap.style.display = totalRows === 0 ? 'none' : 'flex';
        return;
      }

      const prev = makeBtn('‹', page === 1, false, () => showPage(page - 1));
      prev.classList.add('page-btn--wide');
      prev.title = 'Previous';
      paginationBtns.appendChild(prev);

      const delta = 2;
      const pages = [];
      for (let p = 1; p <= totalPages; p++) {
        if (p === 1 || p === totalPages || (p >= page - delta && p <= page + delta)) pages.push(p);
      }
      let last = 0;
      pages.forEach(p => {
        if (last && p - last > 1) {
          const dots = document.createElement('button');
          dots.className = 'page-btn'; dots.textContent = '…'; dots.disabled = true;
          paginationBtns.appendChild(dots);
        }
        paginationBtns.appendChild(makeBtn(p, false, p === page, () => showPage(p)));
        last = p;
      });

      const next = makeBtn('›', page === totalPages, false, () => showPage(page + 1));
      next.classList.add('page-btn--wide');
      next.title = 'Next';
      paginationBtns.appendChild(next);
    }

    function makeBtn(label, disabled, active, onClick) {
      const btn = document.createElement('button');
      btn.className   = 'page-btn' + (active ? ' active' : '');
      btn.textContent = label;
      btn.disabled    = disabled;
      btn.addEventListener('click', onClick);
      return btn;
    }

    showPage(1);
  }

  /* ================================================================
     AUTO-DISMISS FLASH MESSAGES
     ================================================================ */
  setTimeout(() => {
    document.querySelectorAll('.flash-msg').forEach(el => {
      if (!el.classList.contains('result-intercepted')) el.remove();
    });
  }, 5000);

  /* ================================================================
     RESULT MODAL — auto-show on page load when flash has
     an approve or reject result message (admin-side only)
     ================================================================ */
  (function checkFlashForResult() {
    const flashItems = document.querySelectorAll('.flash-msg[data-flash-category]');

    flashItems.forEach(function (el) {
      const category = el.dataset.flashCategory  || '';
      const message  = el.dataset.flashMessage   || '';
      const msgLower = message.toLowerCase();

      const isApproval  = msgLower.includes('approved') || msgLower.includes('loan no');
      const isRejection = msgLower.includes('rejected')  || msgLower.includes('reject');

      if (!isApproval && !isRejection) return;

      /* Hide the plain flash bar — the modal takes over */
      el.classList.add('result-intercepted');
      el.style.display = 'none';

      /* Extract loan number if present  e.g. "Loan approved! Loan No: LN-20240001" */
      let loanNo = '';
      const loanNoMatch = message.match(/Loan\s*No[.:]?\s*([A-Z0-9\-]+)/i);
      if (loanNoMatch) loanNo = loanNoMatch[1];

      setTimeout(function () {
        showResultModal(
          isApproval ? 'approved' : 'rejected',
          isApproval ? 'Application Approved!' : 'Application Rejected',
          isApproval
            ? 'The loan application has been successfully approved and a new loan has been created.'
            : 'The loan application has been rejected. The borrower will be notified.',
          loanNo
        );
      }, 350);
    });
  })();

})(); /* end IIFE */


/* ================================================================
   MODAL LOGIC  (global scope — called by inline onclick handlers)
   ================================================================ */

let currentAppId = null;

function closeModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
}

function openModal(id) {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
  document.getElementById(id).classList.add('open');
}

/* Backdrop click: only close modals WITHOUT .modal-no-backdrop */
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', function (e) {
    if (e.target === this && !this.classList.contains('modal-no-backdrop')) {
      closeModals();
    }
  });
});

/* Escape key closes any modal */
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') closeModals();
});

/* ── Format helpers ──────────────────────────────────── */
function formatCurrency(amount) {
  return '₱' + parseFloat(amount).toLocaleString('en-PH', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
}
function getStatusLabel(status) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/* ── POST form helper ────────────────────────────────── */
function submitForm(url, fields) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = url;
  Object.entries(fields).forEach(([name, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden'; input.name = name; input.value = value;
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
}

/* ── VIEW MODAL ──────────────────────────────────────── */
function openViewModal(refNo, borrowerName, borrowerEmail, typeName, planName,
                       amount, term, submittedAt, status, appId) {
  document.getElementById('viewRef').textContent           = refNo;
  document.getElementById('viewBorrowerName').textContent  = borrowerName;
  document.getElementById('viewBorrowerEmail').textContent = borrowerEmail;
  document.getElementById('viewTypeName').textContent      = typeName;
  document.getElementById('viewPlanName').textContent      = planName;
  document.getElementById('viewAmount').textContent        = formatCurrency(amount);
  document.getElementById('viewTerm').textContent          = term + ' months';
  document.getElementById('viewSubmitted').textContent     = submittedAt;

  const statusColors = {
    submitted:    { bg: '#eff6ff', color: '#3b82f6' },
    under_review: { bg: '#fffbea', color: '#b45309' },
    approved:     { bg: '#f0fdf4', color: '#16a34a' },
    rejected:     { bg: '#fdf0f0', color: '#e05252' },
    cancelled:    { bg: '#f4f8f7', color: '#9bbcb7' },
  };
  const sc = statusColors[status] || { bg: '#f4f8f7', color: '#5a7a76' };
  document.getElementById('viewStatusBadge').innerHTML =
    `<span style="display:inline-flex;align-items:center;padding:3px 10px;border-radius:99px;
      font-size:11px;font-weight:600;background:${sc.bg};color:${sc.color};">
      ${getStatusLabel(status)}</span>`;

  const actionDiv = document.getElementById('viewActionButtons');
  actionDiv.innerHTML = '';

  if (appId && (status === 'submitted' || status === 'under_review')) {
    currentAppId = appId;

    const approveBtn       = document.createElement('button');
    approveBtn.className   = 'btn-approve';
    approveBtn.textContent = 'Approve';
    approveBtn.onclick     = function () { closeModals(); openApproveModal(appId, refNo, amount, term); };

    const rejectBtn       = document.createElement('button');
    rejectBtn.className   = 'btn-reject-confirm';
    rejectBtn.textContent = 'Reject';
    rejectBtn.onclick     = function () { closeModals(); openRejectModal(appId, refNo); };

    actionDiv.appendChild(approveBtn);
    actionDiv.appendChild(rejectBtn);
  }

  openModal('viewModal');
}

/* ── APPROVE MODAL ───────────────────────────────────── */
function openApproveModal(appId, refNo, amount, term) {
  currentAppId = appId;
  document.getElementById('approveDesc').textContent   = `You are about to approve application ${refNo}.`;
  document.getElementById('approveAmount').textContent = formatCurrency(amount);
  document.getElementById('approveTerm').textContent   = term + ' months';
  document.getElementById('approveNote').value         = '';
  openModal('approveModal');
}

function submitApprove() {
  if (!currentAppId) { alert('Error: No application selected. Please try again.'); return; }
  submitForm(`/admin/applications/${currentAppId}/review`, {
    action: 'approve',
    note:   document.getElementById('approveNote').value
  });
}

/* ── REJECT MODAL ────────────────────────────────────── */
function openRejectModal(appId, refNo) {
  currentAppId = appId;
  document.getElementById('rejectDesc').textContent = `You are about to reject application ${refNo}.`;
  document.getElementById('rejectReason').value     = '';
  openModal('rejectModal');
}

function submitReject() {
  if (!currentAppId) { alert('Error: No application selected. Please try again.'); return; }
  submitForm(`/admin/applications/${currentAppId}/review`, {
    action:           'reject',
    rejection_reason: document.getElementById('rejectReason').value
  });
}

/* ── RESULT MODAL ────────────────────────────────────── */
function showResultModal(type, title, message, loanNo) {
  const modal      = document.getElementById('resultModal');
  const iconEl     = document.getElementById('resultModalIcon');
  const iconWrap   = document.getElementById('resultModalIconWrap');
  const titleEl    = document.getElementById('resultModalTitle');
  const msgEl      = document.getElementById('resultModalMsg');
  const metaEl     = document.getElementById('resultModalMeta');
  const doneBtn    = document.getElementById('resultDoneBtn');

  if (!modal) return;

  titleEl.textContent = title;
  msgEl.textContent   = message;

  /* Icon — animated circle with check or X */
  iconEl.innerHTML  = '';
  iconWrap.className = 'result-modal-icon-wrap result-modal-icon-wrap--' + type;
  iconEl.className   = 'result-modal-icon result-modal-icon--' + type;

  if (type === 'approved') {
    iconEl.innerHTML = `
      <svg viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle class="result-svg-circle" cx="26" cy="26" r="24"
                stroke="currentColor" stroke-width="2.5" fill="none"/>
        <path   class="result-svg-check"  d="M14 26l8 9 16-18"
                stroke="currentColor" stroke-width="3"
                stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      </svg>`;
    doneBtn.className = 'btn-approve result-done-btn';
  } else {
    iconEl.innerHTML = `
      <svg viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle class="result-svg-circle" cx="26" cy="26" r="24"
                stroke="currentColor" stroke-width="2.5" fill="none"/>
        <path   class="result-svg-check"  d="M17 17l18 18M35 17L17 35"
                stroke="currentColor" stroke-width="3"
                stroke-linecap="round" fill="none"/>
      </svg>`;
    doneBtn.className = 'btn-reject-confirm result-done-btn';
  }

  /* Loan number pill (approved only) */
  metaEl.innerHTML = '';
  if (loanNo && type === 'approved') {
    metaEl.innerHTML = `
      <div class="result-loan-pill">
        <span class="result-loan-label">Loan No.</span>
        <span class="result-loan-no">${loanNo}</span>
      </div>`;
  }

  openModal('resultModal');
}