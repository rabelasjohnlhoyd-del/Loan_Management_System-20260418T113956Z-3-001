/**
 * documents.js — Enhanced
 * Features: document counts, lightbox, sort/filter, search, toast
 */

(function () {
  'use strict';

  /* ================================================================
     STATE
  ================================================================ */
  let allCards = [];
  let currentCat = 'all';
  let currentStatus = 'all';
  let currentSort = 'default';
  let currentSearch = '';

  /* ================================================================
     INIT
  ================================================================ */
  document.addEventListener('DOMContentLoaded', function () {
    allCards = Array.from(document.querySelectorAll('.doc-card'));
    updateCounts();
    renderCards();
  });

  /* ================================================================
     COUNTS — update tab badges + group counters
  ================================================================ */
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

  /* ================================================================
     FILTER + SORT + SEARCH — unified render
  ================================================================ */
  function renderCards() {
    let visible = allCards.slice();

    // 1. Category filter
    if (currentCat !== 'all') {
      visible = visible.filter(c => c.dataset.cat === currentCat);
    }

    // 2. Status filter
    if (currentStatus !== 'all') {
      visible = visible.filter(c => c.dataset.status === currentStatus);
    }

    // 3. Search
    if (currentSearch) {
      visible = visible.filter(c =>
        (c.dataset.name || '').toLowerCase().includes(currentSearch)
      );
    }

    // 4. Sort
    visible = sortCards(visible, currentSort);

    // Hide all cards first
    allCards.forEach(c => {
      c.style.display = 'none';
      c.style.order = '';
    });

    // Show visible cards (in sorted order via flex order)
    visible.forEach((c, i) => {
      c.style.display = '';
      c.style.order = i;
    });

    // Show/hide groups based on active category
    document.querySelectorAll('.doc-group').forEach(g => {
      const show = (currentCat === 'all' || g.dataset.cat === currentCat);
      g.style.display = show ? '' : 'none';
    });

    // No results state
    const noResults = document.getElementById('noResults');
    if (noResults) {
      noResults.classList.toggle('hidden', visible.length > 0);
    }

    // Update group counters for current view
    updateGroupVisibleCounts(visible);
  }

  function updateGroupVisibleCounts(visible) {
    ['id', 'loan', 'payment', 'report'].forEach(cat => {
      const count = visible.filter(c => c.dataset.cat === cat).length;
      const gcount = document.getElementById('gcount-' + cat);
      if (gcount) gcount.textContent = count + ' document(s)';
    });
  }

  function sortCards(cards, mode) {
    const sorted = cards.slice();
    switch (mode) {
      case 'name-asc':
        return sorted.sort((a, b) => (a.dataset.name || '').localeCompare(b.dataset.name || ''));
      case 'name-desc':
        return sorted.sort((a, b) => (b.dataset.name || '').localeCompare(a.dataset.name || ''));
      case 'date-desc':
        return sorted.sort((a, b) => new Date(b.dataset.date || 0) - new Date(a.dataset.date || 0));
      case 'date-asc':
        return sorted.sort((a, b) => new Date(a.dataset.date || 0) - new Date(b.dataset.date || 0));
      case 'status':
        const order = { verified: 0, pending: 1, rejected: 2, generated: 3 };
        return sorted.sort((a, b) => (order[a.dataset.status] ?? 9) - (order[b.dataset.status] ?? 9));
      default:
        return sorted;
    }
  }

  /* ================================================================
     PUBLIC: Filter by Category Tab
  ================================================================ */
  window.filterDocs = function (cat, btn) {
    currentCat = cat;
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderCards();
  };

  /* ================================================================
     PUBLIC: Filter by Status
  ================================================================ */
  window.filterByStatus = function (status) {
    currentStatus = status;
    renderCards();
  };

  /* ================================================================
     PUBLIC: Sort
  ================================================================ */
  window.sortDocs = function (mode) {
    currentSort = mode;
    renderCards();
  };

  /* ================================================================
     PUBLIC: Search
  ================================================================ */
  window.searchDocs = function (q) {
    currentSearch = q.toLowerCase().trim();
    renderCards();
  };

  /* ================================================================
     LIGHTBOX
  ================================================================ */
  const lightbox     = document.getElementById('lightbox');
  const lightboxImg  = document.getElementById('lightboxImg');
  const lightboxLoad = document.getElementById('lightboxLoading');
  const lightboxTitle = document.getElementById('lightboxTitle');
  const lightboxOpen  = document.getElementById('lightboxOpenBtn');

  window.openLightbox = function (src, title) {
    if (!lightbox) return;

    lightboxTitle.textContent = title || '';
    if (lightboxOpen) lightboxOpen.href = src;

    // Reset
    lightboxImg.style.display = 'none';
    lightboxLoad.style.display = 'flex';
    lightboxImg.src = '';

    lightbox.classList.add('show');
    document.body.style.overflow = 'hidden';

    // Load image
    const img = new Image();
    img.onload = function () {
      lightboxImg.src = src;
      lightboxImg.style.display = 'block';
      lightboxLoad.style.display = 'none';
    };
    img.onerror = function () {
      lightboxLoad.textContent = '⚠ Failed to load preview. Try opening in new tab.';
    };
    img.src = src;
  };

  window.closeLightbox = function () {
    if (!lightbox) return;
    lightbox.classList.remove('show');
    document.body.style.overflow = '';
    setTimeout(() => {
      if (lightboxImg) { lightboxImg.src = ''; lightboxImg.style.display = 'none'; }
      if (lightboxLoad) lightboxLoad.style.display = 'flex';
    }, 200);
  };

  // ESC key to close lightbox
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeLightbox();
      closeUploadModal();
    }
  });

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

  const overlay = document.getElementById('uploadModal');
  if (overlay) {
    overlay.addEventListener('click', function (e) {
      if (e.target === this) closeUploadModal();
    });
  }

  /* ================================================================
     FILE PREVIEW (upload modal)
  ================================================================ */
  window.previewModalFile = function (input) {
    const file = input.files[0];
    if (!file) return;
    const icon = document.getElementById('modalUploadIcon');
    const text = document.getElementById('modalUploadText');
    if (icon) icon.textContent = file.type.startsWith('image') ? '🖼' : '📄';
    if (text) text.textContent = file.name;
  };

  /* ================================================================
     DRAG & DROP on upload zone
  ================================================================ */
  const uploadZone = document.getElementById('modalUploadZone');
  if (uploadZone) {
    uploadZone.addEventListener('dragover', function (e) {
      e.preventDefault();
      this.classList.add('drag-over');
    });
    uploadZone.addEventListener('dragleave', function () {
      this.classList.remove('drag-over');
    });
    uploadZone.addEventListener('drop', function (e) {
      e.preventDefault();
      this.classList.remove('drag-over');
      const fileInput = document.getElementById('modalFile');
      if (fileInput && e.dataTransfer.files.length) {
        fileInput.files = e.dataTransfer.files;
        previewModalFile(fileInput);
      }
    });
  }

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

  /* ================================================================
     DOWNLOAD FEEDBACK
  ================================================================ */
  document.querySelectorAll('.doc-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const txt = this.textContent.trim();
      if (txt.includes('Receipt') || txt.includes('Export') || txt.includes('Download')) {
        showToast('Preparing document…');
      }
    });
  });

})();