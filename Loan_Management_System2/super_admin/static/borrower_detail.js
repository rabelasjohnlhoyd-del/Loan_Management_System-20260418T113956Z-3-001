/* ═══════════════════════════════════════════
   borrower_detail.js
═══════════════════════════════════════════ */

/* Active nav item highlight */
(function () {
  var path = window.location.pathname;
  document.querySelectorAll('.nav-item').forEach(function (el) {
    var href = el.getAttribute('href');
    if (href && href !== '#' && path.startsWith(href)) {
      el.classList.add('active');
    }
  });
})();

/* Mobile sidebar toggle */
(function () {
  var toggle  = document.getElementById('sidebar-toggle');
  var sidebar = document.querySelector('.sidebar');
  if (!toggle || !sidebar) return;
  toggle.addEventListener('click', function () {
    sidebar.classList.toggle('mobile-open');
  });
  document.addEventListener('click', function (e) {
    if (!sidebar.contains(e.target) && e.target !== toggle) {
      sidebar.classList.remove('mobile-open');
    }
  });
})();

/* ── Verify / Reject Modal ── */
var _action = null;

function openVerifyModal(action, borrowerId, borrowerName) {
  _action = action;

  var icon  = document.getElementById('modalIcon');
  var title = document.getElementById('modalTitle');
  var desc  = document.getElementById('modalDesc');
  var btn   = document.getElementById('modalConfirmBtn');

  if (action === 'accept') {
    icon.textContent  = '✅';
    icon.className    = 'modal-icon modal-icon--accept';
    title.textContent = 'Approve ID Verification';
    desc.textContent  = 'You are about to verify the identity of ' + borrowerName + '. They will be notified via email once confirmed.';
    btn.textContent   = 'Yes, Approve';
    btn.className     = 'btn-confirm btn-confirm--accept';
  } else {
    icon.textContent  = '❌';
    icon.className    = 'modal-icon modal-icon--reject';
    title.textContent = 'Reject ID Verification';
    desc.textContent  = 'You are about to reject the ID of ' + borrowerName + '. They will be notified via email and may re-upload.';
    btn.textContent   = 'Yes, Reject';
    btn.className     = 'btn-confirm btn-confirm--reject';
  }

  document.getElementById('modalNote').value = '';
  document.getElementById('verifyModal').classList.add('open');
}

function closeModal() {
  document.getElementById('verifyModal').classList.remove('open');
}

function submitVerification() {
  var note = document.getElementById('modalNote').value.trim();

  if (_action === 'accept') {
    document.getElementById('acceptNote').value = note;
    document.getElementById('acceptForm').submit();
  } else {
    document.getElementById('rejectNote').value = note;
    document.getElementById('rejectForm').submit();
  }
}

document.getElementById('verifyModal').addEventListener('click', function (e) {
  if (e.target === this) closeModal();
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    closeModal();
    closeLightbox();
  }
});

/* ── Lightbox ── */
function openLightbox(src) {
  document.getElementById('lightboxImg').src = src;
  document.getElementById('lightbox').classList.add('open');
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
}