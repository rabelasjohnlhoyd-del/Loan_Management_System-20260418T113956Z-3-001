/* ================================================================
   dashboard_admin.js — All interactivity for the Admin Dashboard
   ================================================================ */

(function () {
  'use strict';

  /* ── Mobile sidebar toggle ── */
  const sidebar  = document.getElementById('sidebar');
  const menuBtn  = document.getElementById('menuBtn');

  menuBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    sidebar?.classList.toggle('mobile-open');
  });

  document.addEventListener('click', (e) => {
    if (
      window.innerWidth <= 768 &&
      sidebar?.classList.contains('mobile-open') &&
      !sidebar.contains(e.target) &&
      e.target !== menuBtn
    ) {
      sidebar.classList.remove('mobile-open');
    }
  });

  /* ── Active nav highlight ── */
  const path = window.location.pathname;
  document.querySelectorAll('.nav-item').forEach((el) => {
    const href = el.getAttribute('href');
    if (href && href !== '#' && path.startsWith(href)) {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      el.classList.add('active');
    }
  });

  /* ── Notification dropdown ── */
  const notifBtn      = document.getElementById('notifBtn');
  const notifDropdown = document.getElementById('notifDropdown');
  const notifDot      = document.getElementById('notifDot');
  const notifClear    = document.getElementById('notifClear');

  notifBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    notifDropdown?.classList.toggle('open');
  });

  notifClear?.addEventListener('click', () => {
    document.querySelectorAll('.notif-item.unread').forEach(el => el.classList.remove('unread'));
    notifDot?.classList.add('hidden');
    notifDropdown?.classList.remove('open');
  });

  document.addEventListener('click', (e) => {
    if (!notifDropdown?.contains(e.target) && e.target !== notifBtn) {
      notifDropdown?.classList.remove('open');
    }
  });

  /* ── Dismiss alert banner ── */
  document.getElementById('closeAlert')?.addEventListener('click', () => {
    document.getElementById('pendingAlert')?.classList.add('hidden');
  });

  /* ── Animated stat counters ── */
  function animateCounter(card) {
    const el       = card.querySelector('.stat-value');
    if (!el) return;
    const target   = parseInt(card.dataset.count, 10) || 0;
    const prefix   = card.dataset.prefix  || '';
    const fmt      = card.dataset.format;
    const duration = 900;
    const start    = performance.now();

    function formatVal(v) {
      if (fmt === 'currency') return prefix + v.toLocaleString('en-PH');
      return prefix + v.toLocaleString();
    }

    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3);
      el.textContent = formatVal(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (!entry.isIntersecting) return;
      setTimeout(() => {
        entry.target.classList.add('visible');
        animateCounter(entry.target);
      }, i * 100);
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.2 });

  document.querySelectorAll('.stat-card[data-animate]').forEach(c => observer.observe(c));

  /* ── Table search ── */
  const appSearch = document.getElementById('appSearch');
  const appTable  = document.getElementById('applicationsTable');

  appSearch?.addEventListener('input', () => {
    const q = appSearch.value.trim().toLowerCase();
    appTable?.querySelectorAll('tbody tr').forEach(row => {
      row.classList.toggle('hidden-row', q ? !row.textContent.toLowerCase().includes(q) : false);
    });
  });

  /* ── Table action buttons ── */
  appTable?.addEventListener('click', (e) => {
    const btn = e.target.closest('.tbl-btn');
    if (!btn) return;

    const action = btn.dataset.action;
    const row    = btn.closest('tr');
    const name   = row?.querySelector('.borrower-name')?.textContent?.trim() || 'this borrower';

    if (action === 'approve') {
      openModal(
        'Approve Application',
        `Are you sure you want to <strong>approve</strong> the loan application for <strong>${name}</strong>?`,
        'Approve',
        () => applyRowAction(row, 'approved')
      );
    } else if (action === 'reject') {
      openModal(
        'Reject Application',
        `Are you sure you want to <strong>reject</strong> the loan application for <strong>${name}</strong>?`,
        'Reject',
        () => applyRowAction(row, 'rejected')
      );
    } else if (action === 'view') {
      openModal(
        'Application Details',
        `Viewing loan application for <strong>${name}</strong>.<br><br>Full detail view coming soon.`,
        null
      );
    }
  });

  function applyRowAction(row, newStatus) {
    const badge    = row?.querySelector('.badge');
    const actCell  = row?.querySelector('td:last-child');

    if (badge) {
      badge.className  = `badge badge--${newStatus}`;
      badge.textContent = newStatus.charAt(0).toUpperCase() + newStatus.slice(1);
    }
    if (actCell) {
      actCell.innerHTML = `<button class="tbl-btn tbl-btn--view" data-action="view">View</button>`;
    }

    const pending = appTable?.querySelectorAll('.badge--pending, .badge--submitted').length || 0;
    const appBadge = document.getElementById('appBadge');
    if (appBadge) appBadge.textContent = pending;
    if (pending === 0) document.getElementById('pendingAlert')?.classList.add('hidden');

    addActivity(
      newStatus === 'approved' ? 'green' : 'red',
      `Application ${newStatus} for ${row?.querySelector('.borrower-name')?.textContent?.trim()}`
    );
  }

  /* ── Activity feed ── */
  function addActivity(color, message) {
    const list = document.getElementById('activityList');
    if (!list) return;

    // Remove empty state if present
    list.querySelector('.activity-empty')?.remove();

    const item = document.createElement('div');
    item.className = 'activity-item';
    item.style.cssText = 'opacity:0;transform:translateY(-8px);transition:opacity .3s,transform .3s';
    item.innerHTML = `
      <span class="activity-dot activity-dot--${color}"></span>
      <div class="activity-content">
        <p>${message}</p>
        <span class="activity-time">Just now</span>
      </div>`;
    list.prepend(item);
    requestAnimationFrame(() => { item.style.opacity = '1'; item.style.transform = 'translateY(0)'; });

    const items = list.querySelectorAll('.activity-item');
    if (items.length > 8) items[items.length - 1].remove();
  }

  /* ── Modal ── */
  const overlay    = document.getElementById('modalOverlay');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody  = document.getElementById('modalBody');
  const modalClose = document.getElementById('modalClose');
  const modalCancel= document.getElementById('modalCancel');
  const modalConfirm=document.getElementById('modalConfirm');
  let onConfirm    = null;

  function openModal(title, body, confirmLabel, cb) {
    if (modalTitle) modalTitle.textContent = title;
    if (modalBody)  modalBody.innerHTML    = body;
    modalConfirm.style.display = confirmLabel ? '' : 'none';
    if (confirmLabel) modalConfirm.textContent = confirmLabel;
    onConfirm = cb || null;
    overlay?.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    overlay?.classList.remove('open');
    document.body.style.overflow = '';
    onConfirm = null;
  }

  modalClose?.addEventListener('click', closeModal);
  modalCancel?.addEventListener('click', closeModal);
  modalConfirm?.addEventListener('click', () => { onConfirm?.(); closeModal(); });
  overlay?.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

})();