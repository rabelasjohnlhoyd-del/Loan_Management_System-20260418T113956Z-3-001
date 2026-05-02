/**
 * make_payment.js
 * FINAL CONSOLIDATED VERSION
 * Includes: Sidebar, Notifications, Download QR Token, QR Scanner Auth, and Enhanced Receipt
 */

(function () {
  'use strict';

  /* ================================================================
     1. SIDEBAR TOGGLE & USER DROPDOWN (Existing Logic)
  ================================================================ */
  const burgerBtn      = document.getElementById('burgerBtn');
  const sidebar        = document.getElementById('sidebar');
  const mainContent    = document.getElementById('mainContent');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const SIDEBAR_KEY    = 'hiraya_sidebar_open';
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

  const userToggle   = document.getElementById('userDropdownToggle');
  const userDropdown = document.getElementById('userDropdown');

  userToggle?.addEventListener('click', function (e) {
    e.stopPropagation();
    userDropdown.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (!userToggle?.contains(e.target) && !userDropdown?.contains(e.target)) {
      userDropdown?.classList.remove('open');
    }
  });

  /* ================================================================
     2. NOTIFICATIONS LOGIC (Existing Logic)
  ================================================================ */
  const notifBtn      = document.getElementById('notifBtn');
  const notifDropdown = document.getElementById('notifDropdown');
  const notifDot      = document.getElementById('notifDot');
  const notifList     = document.getElementById('notifList');

  function fetchUnreadCount() {
    fetch('/loans/api/notifications/count').then(r => r.json()).then(data => {
      if (data.count > 0) notifDot?.classList.remove('hidden');
      else notifDot?.classList.add('hidden');
    }).catch(() => {});
  }
  fetchUnreadCount();
  setInterval(fetchUnreadCount, 60000);

  function fetchNotifications() {
    if (!notifList) return;
    notifList.innerHTML = '<div class="notif-loading"><span>Loading...</span></div>';
    fetch('/loans/api/notifications').then(r => r.json()).then(data => {
      const items = data.notifications || [];
      if (items.length === 0) {
        notifList.innerHTML = '<div class="notif-empty"><p>No new notifications</p></div>';
        return;
      }
      notifList.innerHTML = items.map(n => {
        const unread = !n.is_read;
        return `<div class="notif-item${unread ? ' unread' : ''}" data-id="${n.id}">
          <div class="notif-item-body">
            <div class="notif-item-title">${escHtml(n.title)}</div>
            <div class="notif-item-msg">${escHtml(n.message || '')}</div>
          </div>
        </div>`;
      }).join('');
    }).catch(() => { notifList.innerHTML = '<div class="notif-empty"><p>Error loading.</p></div>'; });
  }

  notifBtn?.addEventListener('click', function (e) {
    e.stopPropagation();
    notifDropdown.classList.toggle('open');
    if (notifDropdown.classList.contains('open')) fetchNotifications();
  });

  /* ================================================================
     3. DOWNLOAD OFFICIAL QR LOGIC (Existing Logic)
  ================================================================ */
  window.downloadOfficialQR = function(loanRef, event) {
    if (event) event.stopPropagation();
    const canvas = document.createElement('canvas');
    const qrData = `HIRAYA-AUTH-${loanRef}`; 

    if (typeof QRious !== 'undefined') {
      const qr = new QRious({
        element: canvas,
        value: qrData,
        size: 300,
        level: 'H',
        foreground: '#1a3330'
      });
      const link = document.createElement('a');
      link.download = `Official_QR_${loanRef}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } else {
      alert("QR Library (QRious) not loaded.");
    }
  };

  /* ================================================================
     4. PAYMENT FLOW STATE & GLOBAL VARIABLES
  ================================================================ */
  let selectedLoanData = null;
  let selectedMethod   = null;
  let _confirmedPayNo  = null;

  const methodDetails = {
    gcash:    { name: 'GCash',          icon: '💙' },
    maya:     { name: 'Maya',           icon: '💚' },
    bdo:      { name: 'BDO Unibank',    icon: '🏦' },
    bpi:      { name: 'BPI',            icon: '🏛️' },
    landbank: { name: 'Landbank',       icon: '🌾' },
    visa:     { name: 'Visa/Card',      icon: '💳' }
  };

  /* ================================================================
     5. QR SCANNER & AUTHORIZATION (Existing Logic Improved)
  ================================================================ */
  const qrDropZone      = document.getElementById('qrDropZone');
  const qrFileInput     = document.getElementById('qrFileInput');
  const btnConfirm      = document.getElementById('btnConfirmPayment');
  const qrValidationMsg = document.getElementById('qrValidationMsg');

  if (qrDropZone) {
      qrDropZone.addEventListener('click', () => {
          if (document.getElementById('qrPreviewContainer').classList.contains('hidden')) qrFileInput?.click();
      });
      qrDropZone.addEventListener('dragover', (e) => { e.preventDefault(); qrDropZone.classList.add('dragging'); });
      qrDropZone.addEventListener('dragleave', () => { qrDropZone.classList.remove('dragging'); });
      qrDropZone.addEventListener('drop', (e) => {
          e.preventDefault();
          qrDropZone.classList.remove('dragging');
          if (e.dataTransfer.files[0]) handleQRFile(e.dataTransfer.files[0]);
      });
  }

  qrFileInput?.addEventListener('change', (e) => { if (e.target.files[0]) handleQRFile(e.target.files[0]); });

  function handleQRFile(file) {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = function(e) {
          const img = new Image();
          img.onload = function() {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              canvas.width = img.width; canvas.height = img.height;
              ctx.drawImage(img, 0, 0, img.width, img.height);
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = window.jsQR ? jsQR(imageData.data, imageData.width, imageData.height) : null;

              if (code && code.data === `HIRAYA-AUTH-${selectedLoanData.ref}`) {
                  processValidQR(e.target.result);
              } else {
                  qrValidationMsg.innerHTML = "❌ Authentication Failed! Invalid QR.";
                  qrValidationMsg.style.color = "#d9534f";
              }
          };
          img.src = e.target.result;
      };
      reader.readAsDataURL(file);
  }

  function processValidQR(imageSrc) {
      document.getElementById('qrPreviewImg').src = imageSrc;
      document.getElementById('qrPreviewContainer').classList.remove('hidden');
      document.getElementById('scannerContent').classList.add('hidden');
      qrValidationMsg.innerHTML = "✅ QR Verified! You can now proceed.";
      qrValidationMsg.style.color = "#2a9080";
      btnConfirm.disabled = false;
      document.getElementById('btnResetQR').classList.remove('hidden');
  }

  window.resetScanner = function() {
      document.getElementById('qrPreviewContainer').classList.add('hidden');
      document.getElementById('scannerContent').classList.remove('hidden');
      if (qrFileInput) qrFileInput.value = "";
      btnConfirm.disabled = true;
      document.getElementById('btnResetQR').classList.add('hidden');
      qrValidationMsg.innerHTML = "Waiting for QR verification...";
      qrValidationMsg.style.color = "#666";
  };

  /* ================================================================
     6. NAVIGATION & BUTTON HANDLERS
  ================================================================ */
// ─── 1. SELECT LOAN ───
  window.selectLoan = function (el, id, ref, amount, type, due) {
    // I-save ang base monthly amount
    selectedLoanData = { id, ref, amount, type, due };
    
    // I-set ang initial value ng input box sa 1 monthly payment
    const amtInput = document.getElementById('inputAmountToPay');
    if(amtInput) amtInput.value = amount;
    
    // Ipakita ang minimum amount hint
    const hint = document.getElementById('minAmountHint');
    if(hint) hint.textContent = `Minimum Monthly Due: ₱${parseFloat(amount).toLocaleString('en-PH', {minimumFractionDigits: 2})}`;

    document.querySelectorAll('.loan-select-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    
    setTimeout(() => { 
      hideSection('sectionSelectLoan'); 
      showSection('sectionStep2'); 
      setStep(2); 
    }, 300);
  };

  // ─── 2. QUICK AMOUNT HELPER ───
  window.setQuickAmount = function(months) {
    if(!selectedLoanData) return;
    const total = selectedLoanData.amount * months;
    const amtInput = document.getElementById('inputAmountToPay');
    if(amtInput) {
        amtInput.value = total.toFixed(2);
        // I-shake or pulse effect para mapansin na nagbago
        amtInput.style.backgroundColor = '#eaf8f5';
        setTimeout(() => amtInput.style.backgroundColor = '', 300);
    }
  };

  // ─── 3. SELECT METHOD ───
  window.selectMethod = function (method, el) {
    selectedMethod = method;
    document.querySelectorAll('.method-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    
    const btnContinue = document.getElementById('btnContinueToQR');
    if (btnContinue) {
        btnContinue.disabled = false;
        btnContinue.classList.add('ready'); 
    }
  };

  // ─── 4. PROCEED TO AUTHORIZE ───
  window.proceedToStep3 = function () {
    const finalAmount = document.getElementById('inputAmountToPay').value;
    
    // Validation para hindi malugi ang system (Minimum check)
    if(!finalAmount || parseFloat(finalAmount) < selectedLoanData.amount) {
        alert("Wait! The amount cannot be lower than your current monthly due (₱" + selectedLoanData.amount.toLocaleString() + ")");
        return;
    }

    // I-save ang final amount na babayaran
    selectedLoanData.userSelectedAmount = finalAmount;
    
    hideSection('sectionStep2'); 
    showSection('sectionStep3'); 
    setStep(3); 
    buildQRScreen();
  };

  // ─── 5. BUILD QR SUMMARY ───
  function buildQRScreen() {
    const d = methodDetails[selectedMethod]; 
    
    setText('sumLoanRef', selectedLoanData.ref);
    setText('sumMethod',  d.icon + ' ' + d.name);
    
    // Ipakita yung piniling amount (pwedeng advanced) sa Summary
    setText('sumAmount',  '₱' + parseFloat(selectedLoanData.userSelectedAmount).toLocaleString('en-PH', { minimumFractionDigits: 2 }));

    const form = document.getElementById('paymentForm');
    if (form) form.action = '/borrower/payments/make/' + selectedLoanData.id;

    setHidden('hiddenLoanId', selectedLoanData.id);
    setHidden('hiddenMethod', selectedMethod); 
    setHidden('hiddenRef', 'TXN-' + Math.random().toString(36).toUpperCase().slice(-8));
    
    // Pasa ang tamang amount sa hidden input para sa Python
    setHidden('hiddenAmount', selectedLoanData.userSelectedAmount);
    
    setHidden('hiddenDate', new Date().toISOString().split('T')[0]);
    resetScanner();
  }

  // ─── 6. FINAL SUBMIT ───
  window.submitPayment = function () {
    const btn = document.getElementById('btnConfirmPayment');
    btn.disabled = true;
    btn.innerHTML = '<span class="notif-spinner"></span> Processing...';
    document.getElementById('paymentForm').submit();
  };

  // ─── 7. BACK BUTTONS ───
  window.backToStep1 = function () { hideSection('sectionStep2'); showSection('sectionSelectLoan'); setStep(1); };
  window.backToStep2 = function () { hideSection('sectionStep3'); showSection('sectionStep2'); setStep(2); };

  /* ================================================================
     7. SUCCESS REDIRECT & RECEIPT DATA
  ================================================================ */
  (function () {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === '1') {
      window.addEventListener('load', function () {
        const payNo   = params.get('ref');
        const loanRef = params.get('loan_ref') || '—';
        if (payNo) {
          hideSection('sectionSelectLoan'); hideSection('sectionStep2'); hideSection('sectionStep3');
          setStep(5); showSection('sectionStep5');
          _confirmedPayNo = payNo;
          _loadReceiptData(payNo);
          setTimeout(() => {
              setText('erPayNo', payNo);
              setText('erLoanRef', loanRef);
              window.scrollTo({ top: 0, behavior: 'smooth' });
          }, 800);
        }
      });
    }
  })();

  function _loadReceiptData(payNo) {
    const loadingEl = document.getElementById('receiptLoading');
    const cardEl    = document.getElementById('erCard');
    if (loadingEl) loadingEl.style.display = 'flex';

    fetch('/borrower/payments/receipt-data/' + payNo).then(r => r.json()).then(data => {
      setText('erPayNo', data.payment_no);
      setText('erAmountVal', '₱' + parseFloat(data.amount_paid).toLocaleString('en-PH', { minimumFractionDigits: 2 }));
      setText('erLoanRef', data.loan_ref);
      setText('erLoanType', data.type_name);
      setText('erBorrowerName', data.borrower_name);
      setText('erDateVerified', data.date_verified);
      setText('erTxnRef', data.reference_number);

      // METHOD BADGE FIX
      const methodBadgeEl = document.getElementById('erMethodBadge');
      if (methodBadgeEl) {
        const icons = { gcash: '💙 GCash', maya: '💚 Maya', bdo: '🏦 BDO', bpi: '🏛️ BPI', landbank: '🌾 Landbank', visa: '💳 Visa/Card' };
        methodBadgeEl.innerHTML = icons[data.payment_method] || data.payment_method;
      }

      if (loadingEl) loadingEl.style.display = 'none';
      if (cardEl) cardEl.style.display = 'block';
    }).catch(() => { if (loadingEl) loadingEl.style.display = 'none'; });
  }

  /* ================================================================
     8. HELPERS & UTILITIES
  ================================================================ */
  function showSection(id) { const el = document.getElementById(id); if (el) { el.classList.remove('hidden'); el.style.display = 'block'; } }
  function hideSection(id) { const el = document.getElementById(id); if (el) { el.classList.add('hidden'); el.style.display = 'none'; } }
  function setHidden(id, val) { const el = document.getElementById(id); if (el) el.value = val; }
  function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
  function setStep(n) {
  const steps = document.querySelectorAll('.step');
  const lines = document.querySelectorAll('.step-line');

  steps.forEach((s, i) => {
    const currentStepIndex = i + 1;
    
    
    s.classList.remove('active', 'done', 'todo');

    if (currentStepIndex < n) {
      s.classList.add('done'); 
    } else if (currentStepIndex === n) {
      s.classList.add('active'); 
    } else {
      s.classList.add('todo'); 
    }
  });

 
  lines.forEach((line, i) => {
    if (i + 1 < n) {
      line.classList.add('done'); 
    } else {
      line.classList.remove('done'); 
    }
  });
}
  function escHtml(str) { return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  window.printReceipt = function () { window.print(); };

  setTimeout(() => {
    document.querySelectorAll('.flash-msg').forEach(el => {
      el.style.transition = 'opacity 0.4s'; el.style.opacity = '0';
      setTimeout(() => el.remove(), 400);
    });
  }, 4000);

  document.addEventListener('DOMContentLoaded', function () {
    hideSection('sectionStep2'); hideSection('sectionStep3'); hideSection('sectionStep5');
    setStep(1);
  });

})();