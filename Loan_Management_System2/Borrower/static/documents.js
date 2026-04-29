// documents.js - Fixed with proper reset WITHOUT DOM replacement

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {

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
      if (sidebarOverlay && isMobile()) sidebarOverlay.classList.add('active');
      if (!isMobile()) localStorage.setItem(SIDEBAR_KEY, '1');
    }

    function closeSidebar() {
      document.body.classList.remove('sidebar-open');
      if (sidebarOverlay) sidebarOverlay.classList.remove('active');
      if (!isMobile()) localStorage.setItem(SIDEBAR_KEY, '0');
    }

    function toggleSidebar() {
      document.body.classList.contains('sidebar-open') ? closeSidebar() : openSidebar();
    }

    if (!isMobile() && localStorage.getItem(SIDEBAR_KEY) !== '0') {
      openSidebar();
    }

    if (burgerBtn) burgerBtn.addEventListener('click', toggleSidebar);
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);

    if (sidebar) {
      sidebar.querySelectorAll('.nav-item, .user-dropdown a').forEach(link => {
        link.addEventListener('click', () => { if (isMobile()) closeSidebar(); });
      });
    }

    window.addEventListener('resize', () => {
      if (!isMobile()) {
        if (sidebarOverlay) sidebarOverlay.classList.remove('active');
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

    if (userToggle && userDropdown) {
      userToggle.addEventListener('click', function (e) {
        e.stopPropagation();
        userDropdown.classList.toggle('open');
        userToggle.classList.toggle('open');
      });

      document.addEventListener('click', (e) => {
        if (!userToggle.contains(e.target) && !userDropdown.contains(e.target)) {
          userDropdown.classList.remove('open');
          userToggle.classList.remove('open');
        }
      });
    }

    /* ================================================================
       NOTIFICATIONS
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
    const notifWrap     = document.getElementById('notifWrap');

    function fetchUnreadCount() {
      fetch('/loans/api/notifications/count')
        .then(r => r.json())
        .then(data => {
          if (!notifDot) return;
          data.count > 0 ? notifDot.classList.remove('hidden') : notifDot.classList.add('hidden');
        }).catch(() => {});
    }

    function fetchNotifications() {
      if (!notifList) return;
      notifList.innerHTML = '<div class="notif-loading"><span>Loading notifications...</span></div>';
      fetch('/loans/api/notifications')
        .then(r => r.json())
        .then(data => {
          const items = data.notifications || [];
          if (items.length === 0) {
            notifList.innerHTML = '<div style="padding:32px 16px;text-align:center;color:var(--gray-400);font-size:13px;">You\'re all caught up!</div>';
            return;
          }
          notifList.innerHTML = items.map(n => {
            const iconPath = NOTIF_ICONS[n.type] || NOTIF_ICONS['general'];
            const unread = !n.is_read;
            return `<div class="notif-item${unread ? ' unread' : ''}" data-id="${n.id}" data-link="${n.link || ''}"
                       style="display:flex;align-items:flex-start;gap:12px;padding:12px 16px;
                              border-bottom:1px solid var(--gray-200);cursor:pointer;
                              background:${unread ? 'var(--mint-light)' : 'var(--white)'};">
                      <div style="width:34px;height:34px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--mint-light);">
                        <span style="display:block;width:16px;height:16px;background:var(--accent);-webkit-mask-image:${iconPath};mask-image:${iconPath};mask-size:contain;mask-repeat:no-repeat;-webkit-mask-size:contain;-webkit-mask-repeat:no-repeat;"></span>
                      </div>
                      <div style="flex:1;min-width:0;">
                        <div style="font-size:13px;font-weight:600;color:var(--gray-800);margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(n.title)}</div>
                        <div style="font-size:12px;color:var(--gray-600);">${escapeHtml(n.message || '')}</div>
                        <div style="font-size:11px;color:var(--gray-400);margin-top:4px;">${escapeHtml(n.time_ago)}</div>
                      </div>
                    </div>`;
          }).join('');

          notifList.querySelectorAll('[data-id]').forEach(el => {
            el.addEventListener('click', function () {
              const id = this.dataset.id;
              const link = this.dataset.link;
              if (this.classList.contains('unread')) {
                fetch(`/loans/api/notifications/${id}/read`, { method: 'POST' }).catch(() => {});
                this.classList.remove('unread');
                this.style.background = 'var(--white)';
                fetchUnreadCount();
              }
              if (link && link !== 'null' && link !== '') {
                if (notifDropdown) notifDropdown.classList.remove('open');
                window.location.href = link;
              }
            });
          });
        }).catch(() => {
          if (notifList) notifList.innerHTML = '<div style="padding:20px 16px;text-align:center;color:var(--gray-400);font-size:13px;">Could not load notifications.</div>';
        });
    }

    if (notifBtn && notifDropdown) {
      notifBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        const opening = !notifDropdown.classList.contains('open');
        notifDropdown.classList.toggle('open');
        if (opening) fetchNotifications();
      });
    }

    document.addEventListener('click', (e) => {
      if (notifWrap && !notifWrap.contains(e.target)) {
        if (notifDropdown) notifDropdown.classList.remove('open');
      }
    });

    if (notifMarkAll) {
      notifMarkAll.addEventListener('click', () => {
        fetch('/loans/api/notifications/read-all', { method: 'POST' })
          .then(() => {
            if (notifDot) notifDot.classList.add('hidden');
            fetchNotifications();
          }).catch(() => {});
      });
    }

    fetchUnreadCount();
    setInterval(fetchUnreadCount, 60000);

    function escapeHtml(str) {
      return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /* ================================================================
       ACTIVE NAV HIGHLIGHT
    ================================================================ */
    const currentPath = window.location.pathname;
    document.querySelectorAll('.nav-item').forEach(function (el) {
      const href = el.getAttribute('href');
      if (href && href !== '#' && currentPath.startsWith(href)) {
        el.classList.add('active');
      }
    });

    /* ================================================================
       DOCUMENT FILTER / SORT / SEARCH
    ================================================================ */
    let allCards      = Array.from(document.querySelectorAll('.doc-card'));
    let currentCat    = 'all';
    let currentStatus = 'all';
    let currentSort   = 'default';
    let currentSearch = '';

    updateCounts();
    renderCards();

    function updateCounts() {
      const cats = ['id', 'loan', 'payment', 'report'];
      let total = 0;
      cats.forEach(cat => {
        const count = allCards.filter(c => c.dataset.cat === cat).length;
        total += count;
        const el = document.getElementById('count-' + cat);
        if (el) el.textContent = count;
        const gcount = document.getElementById('gcount-' + cat);
        if (gcount) gcount.textContent = count + ' document(s)';
      });
      const countAll = document.getElementById('count-all');
      if (countAll) countAll.textContent = total;
    }

    function renderCards() {
      let visible = allCards.slice();
      if (currentCat !== 'all')    visible = visible.filter(c => c.dataset.cat === currentCat);
      if (currentStatus !== 'all') visible = visible.filter(c => c.dataset.status === currentStatus);
      if (currentSearch)           visible = visible.filter(c => (c.dataset.name || '').toLowerCase().includes(currentSearch));
      visible = sortCards(visible, currentSort);

      allCards.forEach(c => { c.style.display = 'none'; c.style.order = ''; });
      visible.forEach((c, i) => { c.style.display = ''; c.style.order = i; });

      document.querySelectorAll('.doc-group').forEach(g => {
        g.style.display = (currentCat === 'all' || g.dataset.cat === currentCat) ? '' : 'none';
      });

      const noResults = document.getElementById('noResults');
      if (noResults) noResults.classList.toggle('hidden', visible.length > 0);

      ['id', 'loan', 'payment', 'report'].forEach(cat => {
        const count = visible.filter(c => c.dataset.cat === cat).length;
        const gcount = document.getElementById('gcount-' + cat);
        if (gcount) gcount.textContent = count + ' document(s)';
      });
    }

    function sortCards(cards, mode) {
      const sorted = cards.slice();
      switch (mode) {
        case 'name-asc':   return sorted.sort((a, b) => (a.dataset.name || '').localeCompare(b.dataset.name || ''));
        case 'name-desc':  return sorted.sort((a, b) => (b.dataset.name || '').localeCompare(a.dataset.name || ''));
        case 'date-desc':  return sorted.sort((a, b) => new Date(b.dataset.date || 0) - new Date(a.dataset.date || 0));
        case 'date-asc':   return sorted.sort((a, b) => new Date(a.dataset.date || 0) - new Date(b.dataset.date || 0));
        case 'status': {
          const order = { verified: 0, pending: 1, rejected: 2, generated: 3 };
          return sorted.sort((a, b) => (order[a.dataset.status] ?? 9) - (order[b.dataset.status] ?? 9));
        }
        default: return sorted;
      }
    }

    window.filterDocs = function (cat, btn) {
      currentCat = cat;
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      if (btn) btn.classList.add('active');
      renderCards();
    };
    window.filterByStatus = function (status) { currentStatus = status; renderCards(); };
    window.sortDocs       = function (mode)   { currentSort   = mode;   renderCards(); };
    window.searchDocs     = function (q)      { currentSearch = q.toLowerCase().trim(); renderCards(); };

    /* ================================================================
       LIGHTBOX - FIXED with SIMPLE reset (NO DOM replacement)
    ================================================================ */
    const lightbox       = document.getElementById('lightbox');
    const lightboxInner  = lightbox ? lightbox.querySelector('.lightbox-inner') : null;
    const lightboxImg    = document.getElementById('lightboxImg');
    const lightboxPdf    = document.getElementById('lightboxPdf');
    const lightboxIframe = document.getElementById('lightboxIframe');
    const lightboxLoad   = document.getElementById('lightboxLoading');
    const lightboxTitle  = document.getElementById('lightboxTitle');
    const lightboxOpen   = document.getElementById('lightboxOpenBtn');

    function resetLightbox() {
      // Simple reset - clear sources only, don't replace DOM
      if (lightboxImg) { 
        lightboxImg.style.display = 'none'; 
        lightboxImg.src = ''; 
      }
      
      if (lightboxPdf) { 
        lightboxPdf.style.display = 'none'; 
        lightboxPdf.data = ''; 
      }
      
      if (lightboxIframe) { 
        lightboxIframe.style.display = 'none'; 
        lightboxIframe.src = ''; 
      }
      
      if (lightboxLoad) { 
        lightboxLoad.style.display = 'flex'; 
        lightboxLoad.textContent = 'Loading preview...'; 
      }
      
      if (lightboxInner) {
        lightboxInner.classList.remove('pdf-mode');
      }
    }

    function openLightboxBase(src, title) {
      if (!lightbox) return;
      
      resetLightbox();
      
      if (lightboxTitle) lightboxTitle.textContent = title || '';
      if (lightboxOpen)  { 
        lightboxOpen.href = src; 
        lightboxOpen.style.display = ''; 
      }
      
      lightbox.classList.add('show');
      document.body.style.overflow = 'hidden';
    }

    // For images
    window.openLightbox = function (src, title) {
      openLightboxBase(src, title);
      const img = new Image();
      img.onload = () => {
        if (lightboxImg) { 
          lightboxImg.src = src; 
          lightboxImg.style.display = 'block'; 
        }
        if (lightboxLoad) lightboxLoad.style.display = 'none';
      };
      img.onerror = () => {
        if (lightboxLoad) lightboxLoad.textContent = '⚠ Failed to load preview. Try opening in new tab.';
      };
      img.src = src;
    };

    // For PDFs - SIMPLE FIX
    window.openPdfModal = function (src, title) {
      if (!src) {
        console.error('No PDF source provided');
        return;
      }
      
      openLightboxBase(src, title);
      if (lightboxInner) lightboxInner.classList.add('pdf-mode');
      
      // Add timestamp to prevent caching
      const timestamp = Date.now();
      let pdfSrc = src;
      if (src.includes('?')) {
        pdfSrc = src + '&t=' + timestamp;
      } else {
        pdfSrc = src + '?t=' + timestamp;
      }
      
      // Use iframe for PDF (more reliable)
      if (lightboxIframe) {
        // Clear first then set new src
        lightboxIframe.src = '';
        setTimeout(() => {
          lightboxIframe.src = pdfSrc;
          lightboxIframe.style.display = 'block';
          lightboxIframe.onload = () => {
            if (lightboxLoad) lightboxLoad.style.display = 'none';
          };
          lightboxIframe.onerror = () => {
            if (lightboxLoad) lightboxLoad.textContent = '⚠ Failed to load PDF. Try "Open in new tab" button.';
          };
        }, 100);
      }
      
      // Timeout fallback
      setTimeout(() => {
        if (lightboxLoad && lightboxLoad.style.display !== 'none') {
          lightboxLoad.textContent = '⚠ PDF taking too long to load. Try "Open in new tab" button.';
        }
      }, 10000);
    };

    window.closeLightbox = function () {
      if (!lightbox) return;
      lightbox.classList.remove('show');
      document.body.style.overflow = '';
      // Delay reset to allow animation
      setTimeout(() => {
        resetLightbox();
      }, 200);
    };

    /* ================================================================
       UPLOAD MODAL
    ================================================================ */
    window.openUploadModal = function (cat) {
      const typeSelect = document.getElementById('uploadDocType');
      if (cat && typeSelect) typeSelect.value = cat === 'id' ? 'id' : '';
      const modal = document.getElementById('uploadModal');
      if (modal) { modal.classList.add('show'); document.body.style.overflow = 'hidden'; }
    };

    window.closeUploadModal = function () {
      const modal = document.getElementById('uploadModal');
      if (modal) { modal.classList.remove('show'); document.body.style.overflow = ''; }
    };

    const modalOverlay = document.getElementById('uploadModal');
    if (modalOverlay) {
      modalOverlay.addEventListener('click', function (e) {
        if (e.target === this) closeUploadModal();
      });
    }

    window.previewModalFile = function (input) {
      const file = input.files[0];
      if (!file) return;
      const icon = document.getElementById('modalUploadIcon');
      const text = document.getElementById('modalUploadText');
      if (icon) icon.textContent = file.type.startsWith('image') ? '🖼' : '📄';
      if (text) text.textContent = file.name;
    };

    const uploadZone = document.getElementById('modalUploadZone');
    if (uploadZone) {
      uploadZone.addEventListener('dragover',  function (e) { e.preventDefault(); this.classList.add('drag-over'); });
      uploadZone.addEventListener('dragleave', function ()  { this.classList.remove('drag-over'); });
      uploadZone.addEventListener('drop', function (e) {
        e.preventDefault(); this.classList.remove('drag-over');
        const fileInput = document.getElementById('modalFile');
        if (fileInput && e.dataTransfer.files.length) {
          fileInput.files = e.dataTransfer.files;
          previewModalFile(fileInput);
        }
      });
    }

    /* ================================================================
       ESC KEY
    ================================================================ */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeLightbox(); closeUploadModal(); }
    });

    /* ================================================================
       TOAST
    ================================================================ */
    window.showToast = function (msg, type) {
      const toastMsg = document.getElementById('toastMsg');
      const toast    = document.getElementById('toast');
      if (!toast) return;
      if (toastMsg) toastMsg.textContent = msg;
      toast.className = 'toast show' + (type ? ' toast--' + type : '');
      clearTimeout(toast._timer);
      toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
    };

  }); // end DOMContentLoaded

})();