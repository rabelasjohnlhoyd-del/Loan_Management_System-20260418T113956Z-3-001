// ── Modal state ──────────────────────────────────────────────
let currentAppId = null;

// ── Helpers ──────────────────────────────────────────────────
function closeModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
  // NOTE: do NOT reset currentAppId here — submit functions still need it
}

function openModal(id) {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
  document.getElementById(id).classList.add('open');
}

// Close on backdrop click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', function(e) {
    if (e.target === this) closeModals();
  });
});

// Close on Escape key
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeModals();
});

// ── Format helpers ────────────────────────────────────────────
function formatCurrency(amount) {
  return '₱' + parseFloat(amount).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function getStatusLabel(status) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getStatusClass(status) {
  const map = {
    submitted:    { bg: '#eff6ff', color: '#3b82f6' },
    under_review: { bg: '#fffbea', color: '#b45309' },
    approved:     { bg: '#f0fdf4', color: '#16a34a' },
    rejected:     { bg: '#fdf0f0', color: '#e05252' },
    cancelled:    { bg: '#f4f8f7', color: '#9bbcb7' },
    draft:        { bg: '#f4f8f7', color: '#5a7a76'  },
  };
  return map[status] || { bg: '#f4f8f7', color: '#5a7a76' };
}

// ── Helper: build and submit a POST form dynamically ──────────
function submitForm(url, fields) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = url;

  Object.entries(fields).forEach(([name, value]) => {
    const input = document.createElement('input');
    input.type  = 'hidden';
    input.name  = name;
    input.value = value;
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
}

// ── VIEW MODAL ────────────────────────────────────────────────
function openViewModal(refNo, borrowerName, borrowerEmail, typeName, planName, amount, term, submittedAt, status) {
  document.getElementById('viewRef').textContent           = refNo;
  document.getElementById('viewBorrowerName').textContent  = borrowerName;
  document.getElementById('viewBorrowerEmail').textContent = borrowerEmail;
  document.getElementById('viewTypeName').textContent      = typeName;
  document.getElementById('viewPlanName').textContent      = planName;
  document.getElementById('viewAmount').textContent        = formatCurrency(amount);
  document.getElementById('viewTerm').textContent          = term + ' months';
  document.getElementById('viewSubmitted').textContent     = submittedAt;

  const badge = document.getElementById('viewStatusBadge');
  badge.innerHTML = `<span class="app-status ${status}">${getStatusLabel(status)}</span>`;

  openModal('viewModal');
}

// ── APPROVE MODAL ─────────────────────────────────────────────
function openApproveModal(appId, refNo, amount, term) {
  currentAppId = appId;
  document.getElementById('approveDesc').textContent   = `You are about to approve application ${refNo}.`;
  document.getElementById('approveAmount').textContent = formatCurrency(amount);
  document.getElementById('approveTerm').textContent   = term + ' months';
  document.getElementById('approveNote').value         = '';
  openModal('approveModal');
}

function submitApprove() {
  if (!currentAppId) {
    alert('Error: No application selected. Please try again.');
    return;
  }
  const note = document.getElementById('approveNote').value;
  submitForm(`/admin/applications/${currentAppId}/review`, {
    action: 'approve',
    note: note
  });
}

// ── REJECT MODAL ──────────────────────────────────────────────
function openRejectModal(appId, refNo) {
  currentAppId = appId;
  document.getElementById('rejectDesc').textContent = `You are about to reject application ${refNo}.`;
  document.getElementById('rejectReason').value     = '';
  openModal('rejectModal');
}

function submitReject() {
  if (!currentAppId) {
    alert('Error: No application selected. Please try again.');
    return;
  }
  const reason = document.getElementById('rejectReason').value;
  submitForm(`/admin/applications/${currentAppId}/review`, {
    action: 'reject',
    rejection_reason: reason
  });
}