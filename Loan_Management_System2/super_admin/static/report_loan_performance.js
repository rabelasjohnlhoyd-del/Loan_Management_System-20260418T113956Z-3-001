/* ================================================================
   REPORT_LOAN_PERFORMANCE.JS
   ================================================================ */

document.addEventListener('DOMContentLoaded', function () {

  /* ─────────────────────────────────────────────────────────────
     0.  DATE RANGE VALIDATION
     Rule: If EITHER date field is empty when Filter Results is
     clicked, block the submit, highlight the empty field(s) red,
     and show the error banner.  Also catches from > to.
  ───────────────────────────────────────────────────────────── */
  const filterForm   = document.getElementById('reportFilterForm');
  const filterFrom   = document.getElementById('filterDateFrom');
  const filterTo     = document.getElementById('filterDateTo');
  const dateErrorMsg = document.getElementById('dateError');

  function clearDateErrors() {
    if (filterFrom)   filterFrom.classList.remove('input-error');
    if (filterTo)     filterTo.classList.remove('input-error');
    if (dateErrorMsg) dateErrorMsg.classList.remove('visible');
  }

  function showDateError(html) {
    if (!dateErrorMsg) return;
    dateErrorMsg.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none"
           viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round"
          d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94
             a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      </svg>
      ${html}`;
    dateErrorMsg.classList.add('visible');
  }

  if (filterForm) {
    filterForm.addEventListener('submit', function (e) {
      const from = filterFrom ? filterFrom.value.trim() : '';
      const to   = filterTo   ? filterTo.value.trim()   : '';

      clearDateErrors();

      const hasFrom = from !== '';
      const hasTo   = to   !== '';

      /* Case 1: Both empty — allow (shows all results, no date filter) */
      if (!hasFrom && !hasTo) return;

      /* Case 2: Only one side filled */
      if (hasFrom && !hasTo) {
        e.preventDefault();
        if (filterTo) filterTo.classList.add('input-error');
        showDateError('Please also select a <strong>Date To</strong> to complete the date range.');
        filterTo && filterTo.focus();
        return;
      }
      if (!hasFrom && hasTo) {
        e.preventDefault();
        if (filterFrom) filterFrom.classList.add('input-error');
        showDateError('Please also select a <strong>Date From</strong> to complete the date range.');
        filterFrom && filterFrom.focus();
        return;
      }

      /* Case 3: Both filled but invalid range */
      if (hasFrom && hasTo && from > to) {
        e.preventDefault();
        if (filterFrom) filterFrom.classList.add('input-error');
        if (filterTo)   filterTo.classList.add('input-error');
        showDateError('<strong>Date From</strong> cannot be later than <strong>Date To</strong>.');
        return;
      }
    });

    /* Clear errors as soon as the user touches either field */
    [filterFrom, filterTo].forEach(input => {
      if (!input) return;
      input.addEventListener('change', clearDateErrors);
      input.addEventListener('input',  clearDateErrors);
    });
  }


  /* ─────────────────────────────────────────────────────────────
     1.  NOTIFICATION BELL
  ───────────────────────────────────────────────────────────── */
  const bell       = document.getElementById('notifBell');
  const dropdown   = document.getElementById('reportNotifDropdown');
  const notifDot   = document.getElementById('notifDot');
  const countBadge = document.getElementById('notifCountBadge');
  const rndList    = document.getElementById('rndList');
  const rndMarkAll = document.getElementById('rndMarkAll');
  let   dropOpen   = false;

  function iconInfo(type) {
    switch (type) {
      case 'loan_approved':  return { color: 'rnd-icon--green',    icon: 'icon-check' };
      case 'loan_rejected':  return { color: 'rnd-icon--red',      icon: 'icon-x' };
      case 'loan_disbursed': return { color: 'rnd-icon--teal',     icon: 'icon-bell' };
      case 'payment_due':    return { color: 'rnd-icon--yellow',   icon: 'icon-bell' };
      default:               return { color: 'rnd-icon--activity', icon: 'icon-clock' };
    }
  }

  function fetchCount() {
    fetch('/admin/api/notifications/count')
      .then(r => r.json())
      .then(data => {
        const n = data.count || 0;
        if (countBadge) {
          countBadge.textContent   = n > 99 ? '99+' : n;
          countBadge.style.display = n > 0 ? 'flex' : 'none';
        }
        if (notifDot) notifDot.classList.toggle('hidden', n === 0);
      })
      .catch(() => {});
  }

  function fetchNotifications() {
    if (!rndList) return;
    rndList.innerHTML = '<li class="rnd-loading"><span class="rnd-spinner"></span> Loading…</li>';

    fetch('/admin/api/notifications')
      .then(r => r.json())
      .then(data => {
        const items = data.notifications || [];
        if (!items.length) {
          rndList.innerHTML = '<li class="rnd-empty">No new notifications</li>';
          return;
        }

        rndList.innerHTML = '';
        let lastSection = '';

        items.forEach(n => {
          if (n.section && n.section !== lastSection) {
            lastSection = n.section;
            const div = document.createElement('li');
            div.className   = 'rnd-section-label';
            div.textContent = n.section;
            rndList.appendChild(div);
          }

          const { color, icon } = iconInfo(n.type);
          const li = document.createElement('li');
          li.innerHTML = `
            <a href="${n.link || '#'}" class="rnd-item${n.is_read ? '' : ' unread'}">
              <div class="rnd-icon ${color}">
                <span class="${icon}"></span>
              </div>
              <div class="rnd-body">
                <div class="rnd-title">${n.title}</div>
                <div class="rnd-msg">${n.message}</div>
                <div class="rnd-time">${n.time_ago}</div>
              </div>
              ${!n.is_read ? '<span class="rnd-unread-dot"></span>' : ''}
            </a>`;

          li.querySelector('a').addEventListener('click', () => {
            fetch(`/admin/api/notifications/${n.id}/read`, { method: 'POST' }).catch(() => {});
          });
          rndList.appendChild(li);
        });
      })
      .catch(() => {
        rndList.innerHTML = '<li class="rnd-empty">Unable to load notifications.</li>';
      });
  }

  if (bell) {
    bell.addEventListener('click', function (e) {
      e.stopPropagation();
      dropOpen = !dropOpen;
      dropdown.classList.toggle('open', dropOpen);
      if (dropOpen) fetchNotifications();
    });
  }

  if (rndMarkAll) {
    rndMarkAll.addEventListener('click', function () {
      fetch('/admin/api/notifications/read-all', { method: 'POST' })
        .then(() => {
          if (countBadge) countBadge.style.display = 'none';
          if (notifDot)   notifDot.classList.add('hidden');
          document.querySelectorAll('.rnd-item.unread').forEach(el => {
            el.classList.remove('unread');
            const dot = el.querySelector('.rnd-unread-dot');
            if (dot) dot.remove();
          });
        })
        .catch(() => {});
    });
  }

  document.addEventListener('click', function (e) {
    if (dropOpen && dropdown && !dropdown.contains(e.target) && e.target !== bell) {
      dropOpen = false;
      dropdown.classList.remove('open');
    }
  });

  fetchCount();
  setInterval(fetchCount, 60000);


  /* ─────────────────────────────────────────────────────────────
     2.  LIVE SEARCH
  ───────────────────────────────────────────────────────────── */
  const searchInput = document.getElementById('appSearch');
  const tableBody   = document.getElementById('appTableBody');

  function getAllRows() {
    return tableBody ? Array.from(tableBody.querySelectorAll('tr')) : [];
  }

  if (searchInput) {
    searchInput.addEventListener('input', function () {
      const q = this.value.trim().toLowerCase();
      getAllRows().forEach(row => {
        row.dataset.hidden = (q && !row.textContent.toLowerCase().includes(q)) ? '1' : '';
      });
      currentPage = 1;
      buildPagination();
      renderPage();
    });
  }


  /* ─────────────────────────────────────────────────────────────
     3.  PAGINATION (20 rows per page)
  ───────────────────────────────────────────────────────────── */
  const ROWS_PER_PAGE = 20;
  let currentPage = 1;

  function getVisibleRows() {
    return getAllRows().filter(r => r.dataset.hidden !== '1');
  }

  function renderPage() {
    const rows  = getVisibleRows();
    const total = rows.length;
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    const end   = start + ROWS_PER_PAGE;

    getAllRows().forEach(r => {
      if (r.dataset.hidden === '1') { r.style.display = 'none'; return; }
      const idx = rows.indexOf(r);
      r.style.display = (idx >= start && idx < end) ? '' : 'none';
    });

    const countEl = document.getElementById('paginationCount');
    if (countEl) {
      countEl.textContent = total === 0
        ? 'No records found'
        : `Showing ${start + 1}–${Math.min(end, total)} of ${total} records`;
    }
  }

  function buildPagination() {
    const wrap = document.getElementById('paginationWrap');
    if (!wrap) return;

    const total      = getVisibleRows().length;
    const totalPages = Math.max(1, Math.ceil(total / ROWS_PER_PAGE));
    if (currentPage > totalPages) currentPage = totalPages;

    wrap.innerHTML = '';

    function makeBtn(label, page, disabled, active) {
      const btn = document.createElement('button');
      btn.className = 'page-btn'
        + (active   ? ' page-btn--active'   : '')
        + (disabled ? ' page-btn--disabled' : '');
      btn.disabled  = disabled;
      btn.innerHTML = label;
      if (!disabled && !active) {
        btn.addEventListener('click', () => {
          currentPage = page;
          renderPage();
          buildPagination();
        });
      }
      return btn;
    }

    wrap.appendChild(makeBtn('←', currentPage - 1, currentPage === 1, false));

    const range = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
        range.push(i);
      } else if (range[range.length - 1] !== '…') {
        range.push('…');
      }
    }

    range.forEach(p => {
      if (p === '…') {
        const span = document.createElement('span');
        span.className   = 'page-ellipsis';
        span.textContent = '…';
        wrap.appendChild(span);
      } else {
        wrap.appendChild(makeBtn(p, p, false, p === currentPage));
      }
    });

    wrap.appendChild(makeBtn('→', currentPage + 1, currentPage === totalPages, false));
  }

  if (tableBody) {
    buildPagination();
    renderPage();
  }

});