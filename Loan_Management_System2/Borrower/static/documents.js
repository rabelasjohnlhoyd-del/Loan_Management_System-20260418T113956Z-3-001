/**
 * documents.js
 * Logic for the Documents page.
 */

(function () {
  'use strict';

  /* ── Upload Modal ─────────────────────────────────────────── */
  window.openUploadModal = function (cat) {
    const typeSelect = document.getElementById('uploadDocType');
    if (cat && typeSelect) typeSelect.value = cat === 'id' ? 'id' : '';
    document.getElementById('uploadModal').classList.add('show');
  };

  window.closeUploadModal = function () {
    document.getElementById('uploadModal').classList.remove('show');
  };

  const overlay = document.getElementById('uploadModal');
  if (overlay) {
    overlay.addEventListener('click', function (e) {
      if (e.target === this) closeUploadModal();
    });
  }

  /* ── File Preview (modal) ─────────────────────────────────── */
  window.previewModalFile = function (input) {
    const file = input.files[0];
    if (!file) return;
    const icon = document.getElementById('modalUploadIcon');
    const text = document.getElementById('modalUploadText');
    if (icon) icon.textContent = file.type.startsWith('image') ? '🖼' : '📄';
    if (text) text.textContent = file.name;
  };

  /* ── Filter by Category ───────────────────────────────────── */
  window.filterDocs = function (cat, btn) {
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');

    document.querySelectorAll('.doc-group').forEach(g => {
      g.style.display = (cat === 'all' || g.dataset.cat === cat) ? '' : 'none';
    });
  };

  /* ── Search ───────────────────────────────────────────────── */
  window.searchDocs = function (q) {
    const query = q.toLowerCase().trim();
    document.querySelectorAll('.doc-card').forEach(card => {
      const name = (card.dataset.name || '').toLowerCase();
      card.style.display = (!query || name.includes(query)) ? '' : 'none';
    });
  };

  /* ── Toast ────────────────────────────────────────────────── */
  window.showToast = function (msg) {
    const toastMsg = document.getElementById('toastMsg');
    const toast    = document.getElementById('toast');
    if (!toast) return;
    if (toastMsg) toastMsg.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  };

  /* ── Download feedback ────────────────────────────────────── */
  document.querySelectorAll('.doc-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      if (this.textContent.includes('Receipt') || this.textContent.includes('Export')) {
        showToast('Preparing document…');
      }
    });
  });

})();