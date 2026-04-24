/**
 * make_payment.js
 * Logic for the Make a Payment page.
 */

(function () {
  'use strict';

  let selectedLoanData = null;
  let currentMethod = 'gcash';

  const methodDetails = {
    gcash: { name: 'GCash',             account: 'Hiraya Lending Corp.', num: '+63 912 345 6789',                   app: 'GCash'    },
    maya:  { name: 'Maya',              account: 'Hiraya Lending Corp.', num: '09187654321',                        app: 'Maya'     },
    bank:  { name: 'BDO Bank Transfer', account: 'Hiraya Lending Corp.', num: 'Account No: 0012-3456-7890 | BDO',  app: 'banking'  },
    cash:  { name: 'Cash / Manual',     account: '',                     num: '',                                   app: ''         },
  };

  /* ── Select Loan ─────────────────────────────────────────── */
  window.selectLoan = function (el, id, ref, amount, type, due) {
    document.querySelectorAll('.loan-select-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');

    selectedLoanData = { id, ref, amount, type, due };

    const form = document.getElementById('paymentForm');
    if (form) form.action = '/borrower/payments/make/' + id;

    document.getElementById('hiddenLoanId').value = id;
    document.getElementById('paymentAmount').value = amount > 0 ? amount.toFixed(2) : '';
    document.getElementById('dueAmountHint').textContent = amount > 0
      ? amount.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : '0.00';
    document.getElementById('selectedLoanLabel').textContent = ref + ' — ' + type;

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('paymentDate').value = today;

    updateSummary();

    const section = document.getElementById('sectionPaymentForm');
    section.classList.remove('hidden');
    section.style.display = 'block';
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });

    setStep(2);
  };

  /* ── Reset Selection ──────────────────────────────────────── */
  window.resetSelection = function () {
    selectedLoanData = null;
    document.querySelectorAll('.loan-select-card').forEach(c => c.classList.remove('selected'));
    const section = document.getElementById('sectionPaymentForm');
    section.classList.add('hidden');
    section.style.display = 'none';
    document.getElementById('sectionSelectLoan').scrollIntoView({ behavior: 'smooth' });
    setStep(1);
  };

  /* ── Payment Method ───────────────────────────────────────── */
  window.setMethod = function (method, el) {
    currentMethod = method;
    document.querySelectorAll('.method-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    document.getElementById('hiddenMethod').value = method;

    const d = methodDetails[method];
    const isQR = method !== 'cash';

    const qrSection   = document.getElementById('qrSection');
    const cashSection = document.getElementById('cashSection');

    if (qrSection)   { qrSection.style.display   = isQR ? 'block' : 'none'; }
    if (cashSection) { cashSection.style.display  = isQR ? 'none'  : 'block'; }

    if (isQR) {
      document.getElementById('qrMethodName').innerHTML = '<strong>' + d.name + '</strong>';
      document.getElementById('qrAccountName').textContent = d.account;
      document.getElementById('qrAccountNum').textContent  = d.num;
      document.getElementById('qrAppLabel').textContent    = d.app;
    }

    document.getElementById('summaryMethod').textContent = d.name;
  };

  /* ── Update Summary ───────────────────────────────────────── */
  window.updateSummary = function () {
    if (!selectedLoanData) return;
    const amt = parseFloat(document.getElementById('paymentAmount').value) || 0;
    document.getElementById('summaryRef').textContent    = selectedLoanData.ref;
    document.getElementById('summaryType').textContent   = selectedLoanData.type;
    document.getElementById('summaryDue').textContent    = selectedLoanData.due;
    document.getElementById('summaryAmount').textContent = '₱' + amt.toLocaleString('en-PH', {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    });
  };

  /* ── Step Indicator ───────────────────────────────────────── */
  function setStep(active) {
    const steps = document.querySelectorAll('.step');
    const lines = document.querySelectorAll('.step-line');

    steps.forEach((s, i) => {
      s.classList.remove('done', 'active', 'todo');
      if      (i + 1 < active)  s.classList.add('done');
      else if (i + 1 === active) s.classList.add('active');
      else                       s.classList.add('todo');
    });

    lines.forEach((l, i) => {
      l.classList.toggle('done', i + 1 < active);
    });
  }

  /* ── File Preview ─────────────────────────────────────────── */
  window.previewFile = function (input) {
    const file = input.files[0];
    if (!file) return;

    const thumb   = document.getElementById('previewThumb');
    const preview = document.getElementById('uploadPreview');

    document.getElementById('previewName').textContent = file.name;
    document.getElementById('previewSize').textContent = (file.size / 1024).toFixed(1) + ' KB';

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = e => {
        thumb.src           = e.target.result;
        thumb.style.display = 'block';
      };
      reader.readAsDataURL(file);
    } else {
      thumb.style.display = 'none';
    }

    preview.classList.add('show');
    setStep(3);
  };

  window.removeFile = function () {
    document.getElementById('proofFile').value  = '';
    document.getElementById('uploadPreview').classList.remove('show');
    document.getElementById('previewThumb').style.display = 'block';
    setStep(2);
  };

  /* ── Drag-and-drop ────────────────────────────────────────── */
  const zone = document.getElementById('uploadZone');
  if (zone) {
    zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', ()  => zone.classList.remove('dragover'));
    zone.addEventListener('drop',      e  => {
      e.preventDefault();
      zone.classList.remove('dragover');
      if (e.dataTransfer.files.length) {
        document.getElementById('proofFile').files = e.dataTransfer.files;
        previewFile(document.getElementById('proofFile'));
      }
    });
  }

  /* ── Auto-hide flash messages ─────────────────────────────── */
  setTimeout(() => {
    document.querySelectorAll('.flash-msg').forEach(el => el.remove());
  }, 4000);

  /* ── Init ─────────────────────────────────────────────────── */
  setStep(1);

})();