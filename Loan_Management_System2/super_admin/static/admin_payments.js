/* ================================================================
   admin_payments.js — Payment Verification Page
   ================================================================ */

'use strict';

// ── State ────────────────────────────────────────────────────────
let currentPaymentId = null;

// ── Build the base verify URL from Jinja (injected in HTML) ──────
// window.BASE_VERIFY_URL must be set in the template like:
//   window.BASE_VERIFY_URL = "{{ url_for('super_admin.verify_payment', payment_id=0) }}".replace('/0/', '/');

// ================================================================
// PROOF MODAL
// ================================================================
function viewProof(imgPath, borrower, loanNo, amount, ref) {
  document.getElementById('proofBorrower').textContent = borrower;
  document.getElementById('proofLoanNo').textContent   = loanNo;
  document.getElementById('proofAmount').textContent   =
    '₱' + parseFloat(amount).toLocaleString('en-PH', { minimumFractionDigits: 2 });
  document.getElementById('proofRef').textContent = ref || '—';

  // window.PROOF_BASE_URL must be set in the template
  document.getElementById('proofImg').src = (window.PROOF_BASE_URL || '') + imgPath;

  openModal('proofModal');
}

// ================================================================
// APPROVE MODAL
// ================================================================
function openVerifyModal(id, ref, amount, borrower, loanNo) {
  currentPaymentId = id;

  document.getElementById('approveDesc').textContent =
    'Approve payment from ' + borrower + ' for Loan ' + loanNo + '?';
  document.getElementById('approveAmount').textContent =
    '₱' + parseFloat(amount).toLocaleString('en-PH', { minimumFractionDigits: 2 });
  document.getElementById('approveLoanNo').textContent = loanNo;
  document.getElementById('approveNotes').value = '';

  openModal('approveModal');
}

function submitApprove() {
  if (!currentPaymentId) return;
  const notes = document.getElementById('approveNotes').value;
  document.getElementById('approveNotesHidden').value = notes;

  const form = document.getElementById('approveForm');
  form.action = buildVerifyUrl(currentPaymentId);
  form.submit();
}

// ================================================================
// REJECT MODAL
// ================================================================
function openRejectModal(id, ref, borrower) {
  currentPaymentId = id;

  document.getElementById('rejectDesc').textContent =
    'Reject payment submission from ' + borrower + '?';
  document.getElementById('rejectNotes').value = '';

  openModal('rejectModal');
}

function submitReject() {
  if (!currentPaymentId) return;
  const notes = document.getElementById('rejectNotes').value;
  document.getElementById('rejectNotesHidden').value = notes;

  const form = document.getElementById('rejectForm');
  form.action = buildVerifyUrl(currentPaymentId);
  form.submit();
}

// ================================================================
// HELPERS
// ================================================================
function buildVerifyUrl(id) {
  // BASE_VERIFY_URL already has trailing slash replacing /0/
  return (window.BASE_VERIFY_URL || '') + id + '/verify';
}

function openModal(id) {
  document.getElementById(id).classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
  document.body.style.overflow = '';
}

// ================================================================
// LIGHTBOX
// ================================================================
function openLightbox(src) {
  document.getElementById('lightboxImg').src = src;
  document.getElementById('lightbox').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('active');
  document.body.style.overflow = '';
}

// ================================================================
// INIT — runs after DOM ready
// ================================================================
document.addEventListener('DOMContentLoaded', function () {

  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(function (overlay) {
    overlay.addEventListener('click', function (e) {
      if (e.target === this) closeModals();
    });
  });

  // Close lightbox on overlay click
  const lightbox = document.getElementById('lightbox');
  if (lightbox) {
    lightbox.addEventListener('click', function (e) {
      if (e.target === this || e.target === document.getElementById('lightboxImg')) {
        closeLightbox();
      }
    });
  }

  // Escape key closes modals / lightbox
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeLightbox();
      closeModals();
    }
  });

  // Auto-dismiss flash messages after 5s
  setTimeout(function () {
    document.querySelectorAll('.flash-msg').forEach(function (el) {
      el.style.transition = 'opacity .4s, transform .4s';
      el.style.opacity = '0';
      el.style.transform = 'translateY(-6px)';
      setTimeout(function () { el.remove(); }, 400);
    });
  }, 5000);

  // Animate stat-card rows on load (same pattern as dashboard)
  document.querySelectorAll('.data-table tbody tr').forEach(function (row, i) {
    row.style.opacity = '0';
    row.style.transform = 'translateY(8px)';
    row.style.transition = 'opacity .3s ease ' + (i * 0.04) + 's, transform .3s ease ' + (i * 0.04) + 's';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        row.style.opacity = '1';
        row.style.transform = 'translateY(0)';
      });
    });
  });

});