/**
 * make_payment.js — Fixed Flow with Live Polling + Inline E-Receipt (Step 5)
 * Step 1: Select Loan
 * Step 2: Select Payment Method + Continue
 * Step 3: QR Code + "I've Paid" button (submits to backend)
 * Step 4: Pending confirmation screen with live status polling
 * Step 5: Inline E-Receipt (fetched via AJAX from /borrower/payments/receipt-data/<pay_no>)
 */

(function () {
  'use strict';

  /* ================================================================
     STATE
  ================================================================ */
  let selectedLoanData = null;
  let selectedMethod   = null;
  let currentStep      = 1;
  let _pollInterval    = null;
  let _confirmedPayNo  = null; // PAY-XXXX mula sa backend, ginagamit sa Step 5 fetch

  const methodDetails = {
    gcash: {
      name:       'GCash',
      color:      '#0070e0',
      colorLight: '#e8f4ff',
      icon:       '💙',
      account:    'Hiraya Lending',
      num:        '+63 917 000 1234',
      prefix:     'https://gcash.com/pay?amount={AMOUNT}&ref={REF}&to=09170001234',
    },
    maya: {
      name:       'Maya',
      color:      '#00b140',
      colorLight: '#e8f9ee',
      icon:       '💚',
      account:    'Hiraya Lending',
      num:        '09180001234',
      prefix:     'https://maya.ph/pay?amount={AMOUNT}&ref={REF}&to=09180001234',
    },
    bank: {
      name:       'BDO Transfer',
      color:      '#003087',
      colorLight: '#e8eeff',
      icon:       '🏦',
      account:    'Hiraya Lending Corp.',
      num:        'Acct: 0012-3456-7890',
      prefix:     'https://bdo.com.ph/pay?amount={AMOUNT}&ref={REF}&acct=0012345678',
    },
    cash: {
      name:       'Cash / Manual',
      color:      '#2a9080',
      colorLight: '#eaf8f5',
      icon:       '💵',
      account:    'Hiraya Office',
      num:        'Unit 3, ABC Bldg, Main St.',
      prefix:     null,
    },
  };

  /* ================================================================
     INIT
  ================================================================ */
  document.addEventListener('DOMContentLoaded', function () {
    hideSection('sectionStep2');
    hideSection('sectionStep3');
    hideSection('sectionStep4');
    hideSection('sectionStep5');
    setStep(1);
  });

  /* ================================================================
     HELPERS
  ================================================================ */
  function showSection(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('hidden');
    el.style.display = 'block';
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('section-visible')));
  }

  function hideSection(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('hidden');
    el.classList.remove('section-visible');
    el.style.display = 'none';
  }

  function scrollToSection(id) {
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }

  function setHidden(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }

  /* ================================================================
     STEP INDICATOR — Updated para suportahan ang 5 steps
  ================================================================ */
  function setStep(active) {
    currentStep = active;
    document.querySelectorAll('.step').forEach((s, i) => {
      s.classList.remove('done', 'active', 'todo');
      if      (i + 1 < active)  s.classList.add('done');
      else if (i + 1 === active) s.classList.add('active');
      else                       s.classList.add('todo');
    });
    document.querySelectorAll('.step-line').forEach((l, i) => {
      l.classList.toggle('done', i + 1 < active);
    });
  }

  /* ================================================================
     STEP 1 — SELECT LOAN
  ================================================================ */
  window.selectLoan = function (el, id, ref, amount, type, due) {
    document.querySelectorAll('.loan-select-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    selectedLoanData = { id, ref, amount, type, due };

    setTimeout(() => {
      hideSection('sectionSelectLoan');
      showSection('sectionStep2');
      scrollToSection('sectionStep2');
      setStep(2);
    }, 320);
  };

  /* ================================================================
     STEP 2 — SELECT METHOD
  ================================================================ */
  window.selectMethod = function (method, el) {
    selectedMethod = method;
    document.querySelectorAll('.method-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');

    const btn = document.getElementById('btnContinueToQR');
    if (btn) { btn.disabled = false; btn.classList.add('ready'); }
  };

  window.proceedToStep3 = function () {
    if (!selectedMethod) return;
    hideSection('sectionStep2');
    showSection('sectionStep3');
    scrollToSection('sectionStep3');
    buildQRScreen();
    setStep(3);
  };

  window.backToStep1 = function () {
    hideSection('sectionStep2');
    showSection('sectionSelectLoan');
    document.querySelectorAll('.loan-select-card').forEach(c => c.classList.remove('selected'));
    selectedLoanData = null;
    selectedMethod   = null;
    scrollToSection('sectionSelectLoan');
    setStep(1);
  };

  /* ================================================================
     STEP 3 — BUILD QR SCREEN
  ================================================================ */
  function buildQRScreen() {
    const d    = methodDetails[selectedMethod];
    const loan = selectedLoanData;

    const ref    = 'HRY-' + loan.id + '-' + Date.now().toString(36).toUpperCase().slice(-6);
    const amount = parseFloat(loan.amount).toFixed(2);

    const today   = new Date();
    const payDate = today.getFullYear() + '-' +
                    String(today.getMonth() + 1).padStart(2, '0') + '-' +
                    String(today.getDate()).padStart(2, '0');

    window._paymentRef = ref;

    let qrData;
    if (d.prefix) {
      qrData = d.prefix.replace('{AMOUNT}', amount).replace('{REF}', ref);
    } else {
      qrData = `HIRAYA-PAYMENT|REF:${ref}|AMOUNT:${amount}|LOAN:${loan.ref}|METHOD:CASH`;
    }

    document.getElementById('qrMethodBadge').textContent      = d.icon + ' ' + d.name;
    document.getElementById('qrMethodBadge').style.background = d.colorLight;
    document.getElementById('qrMethodBadge').style.color      = d.color;
    document.getElementById('qrLoanRef').textContent          = loan.ref;
    document.getElementById('qrLoanType').textContent         = loan.type;
    document.getElementById('qrAmount').textContent           = '₱' + parseFloat(amount).toLocaleString('en-PH', { minimumFractionDigits: 2 });
    document.getElementById('qrDueDate').textContent          = loan.due;
    document.getElementById('qrRefNum').textContent           = ref;
    document.getElementById('qrAccountName').textContent      = d.account;
    document.getElementById('qrAccountNum').textContent       = d.num;

    const form = document.getElementById('paymentForm');
    if (form) form.action = '/borrower/payments/make/' + loan.id;

    setHidden('hiddenLoanId', loan.id);
    setHidden('hiddenMethod',  selectedMethod);
    setHidden('hiddenRef',     ref);
    setHidden('hiddenAmount',  amount);
    setHidden('hiddenDate',    payDate);

    if (selectedMethod === 'cash') {
      document.getElementById('qrCodeWrap').style.display       = 'none';
      document.getElementById('cashInstructions').style.display = 'block';
      if (document.getElementById('qrScanHint'))
        document.getElementById('qrScanHint').style.display     = 'none';
    } else {
      document.getElementById('qrCodeWrap').style.display       = 'block';
      document.getElementById('cashInstructions').style.display = 'none';
      if (document.getElementById('qrScanHint'))
        document.getElementById('qrScanHint').style.display     = 'flex';
      generateQR(qrData, d.color);
    }
  }

  /* ================================================================
     QR CODE GENERATION
  ================================================================ */
  function generateQR(data, accentColor) {
    const canvas = document.getElementById('qrCanvas');
    if (!canvas) return;

    if (typeof QRious !== 'undefined') {
      new QRious({
        element:    canvas,
        value:      data,
        size:       200,
        level:      'H',
        foreground: '#1a3330',
        background: '#ffffff',
        padding:    10,
      });
      return;
    }

    const ctx = canvas.getContext('2d');
    canvas.width  = 200;
    canvas.height = 200;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 200, 200);
    drawQRCorner(ctx, 8,   8,   accentColor);
    drawQRCorner(ctx, 144, 8,   accentColor);
    drawQRCorner(ctx, 8,   144, accentColor);
    ctx.fillStyle = '#5a7a76';
    ctx.font      = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Loading QR...', 100, 108);

    loadQRious(function () {
      if (typeof QRious !== 'undefined') {
        new QRious({ element: canvas, value: data, size: 200, level: 'H',
                     foreground: '#1a3330', background: '#ffffff', padding: 10 });
      }
    });
  }

  function drawQRCorner(ctx, x, y, color) {
    ctx.strokeStyle = color || '#1a3330';
    ctx.lineWidth   = 4;
    ctx.strokeRect(x, y, 48, 48);
    ctx.fillStyle   = color || '#1a3330';
    ctx.fillRect(x + 10, y + 10, 28, 28);
  }

  function loadQRious(cb) {
    if (document.getElementById('qrious-script')) { cb(); return; }
    const s  = document.createElement('script');
    s.id     = 'qrious-script';
    s.src    = 'https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js';
    s.onload = cb;
    document.head.appendChild(s);
  }

  window.backToStep2 = function () {
    hideSection('sectionStep3');
    showSection('sectionStep2');
    scrollToSection('sectionStep2');
    setStep(2);
  };

  /* ================================================================
     STEP 3 → SUBMIT "I've Paid"
  ================================================================ */
  window.submitPayment = function () {
    const btn = document.getElementById('btnIvePaid');
    if (btn) {
      btn.disabled  = true;
      btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Submitting…';
    }

    const form = document.getElementById('paymentForm');
    if (form && form.action && form.action !== '#' && !form.action.endsWith('#')) {
      form.submit();
    } else {
      setTimeout(() => {
        hideSection('sectionStep3');
        showSection('sectionStep4');
        scrollToSection('sectionStep4');
        setStep(4);
        const pendingRef = document.getElementById('pendingRef');
        if (pendingRef) pendingRef.textContent = window._paymentRef || '—';
      }, 600);
    }
  };

  /* ================================================================
     STEP 4 — SHOW RECEIPT + START POLLING
  ================================================================ */
  window.showStep4 = function (ref, amount, method) {
    ['sectionSelectLoan', 'sectionStep2', 'sectionStep3', 'sectionStep5'].forEach(hideSection);
    showSection('sectionStep4');
    setStep(4);

    // I-save ang PAY-XXXX para gamitin sa Step 5 fetch
    _confirmedPayNo = ref || null;

    const pendingRef = document.getElementById('pendingRef');
    if (pendingRef && ref) pendingRef.textContent = ref;

    const loanRefEl = document.getElementById('receiptLoanRef');
    if (loanRefEl) loanRefEl.textContent = (selectedLoanData && selectedLoanData.ref) || '—';

    const methodEl = document.getElementById('receiptMethod');
    if (methodEl && method) {
      const icons = { gcash: '💙 GCash', maya: '💚 Maya', bank: '🏦 BDO Transfer', cash: '💵 Cash / Walk-in' };
      methodEl.textContent = icons[method] || method;
    }

    const dateEl = document.getElementById('receiptDate');
    if (dateEl) {
      const now = new Date();
      dateEl.textContent = now.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    const txnEl = document.getElementById('receiptTxnRef');
    if (txnEl) txnEl.textContent = window._paymentRef || '—';

    const amtEl = document.getElementById('receiptAmount');
    if (amtEl && amount) {
      amtEl.textContent = '₱' + parseFloat(amount).toLocaleString('en-PH', { minimumFractionDigits: 2 });
    }

    if (ref) startPolling(ref);
  };

  /* ================================================================
     LIVE STATUS POLLING
  ================================================================ */
  function startPolling(payNo) {
    if (_pollInterval) clearInterval(_pollInterval);

    _pollInterval = setInterval(async function () {
      try {
        const res  = await fetch('/borrower/payments/status/' + payNo);
        const data = await res.json();

        if (data.status === 'completed' || data.status === 'approved' || data.status === 'verified') {
          clearInterval(_pollInterval);
          setTimelineCompleted();
        } else if (data.status === 'rejected') {
          clearInterval(_pollInterval);
          setTimelineRejected();
        }
      } catch (e) {
        console.warn('Polling error:', e);
      }
    }, 5000);
  }

  function setTimelineCompleted() {
    const tlVerification = document.getElementById('tl-verification');
    if (tlVerification) {
      tlVerification.classList.remove('pending');
      tlVerification.classList.add('done');
      const sub = document.getElementById('tl-verification-sub');
      if (sub) sub.textContent = 'Verified by admin';
    }

    const tlReceipt = document.getElementById('tl-receipt');
    if (tlReceipt) {
      tlReceipt.classList.remove('todo');
      tlReceipt.classList.add('done');
      const sub = document.getElementById('tl-receipt-sub');
      if (sub) sub.textContent = 'Available now';
    }

    const banner = document.getElementById('receiptIssuedBanner');
    if (banner) {
      banner.style.display = 'flex';
      banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function setTimelineRejected() {
    const tlVerification = document.getElementById('tl-verification');
    if (tlVerification) {
      tlVerification.classList.remove('pending');
      tlVerification.classList.add('rejected');
      const sub = document.getElementById('tl-verification-sub');
      if (sub) sub.textContent = 'Payment was rejected';
    }

    const banner = document.getElementById('receiptRejectedBanner');
    if (banner) {
      banner.style.display = 'flex';
      banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  /* ================================================================
     STEP 4 → STEP 5: LOAD INLINE E-RECEIPT
     Tinatawag ng "View E-Receipt →" button sa approved banner
  ================================================================ */
  window.loadAndShowReceipt = function () {
    const payNo = _confirmedPayNo;
    if (!payNo) {
      console.warn('No confirmed pay_no available for receipt fetch.');
      return;
    }

    // GUARD: I-verify muna ang status bago pumunta sa Step 5.
    // Kung 'pending' pa rin, huwag ituloy — ibig sabihin
    // hindi pa na-approve ng admin at hindi available ang receipt.
    fetch('/borrower/payments/status/' + payNo)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.status !== 'approved' && data.status !== 'completed' && data.status !== 'verified') {
          // Hindi pa approved — ibalik sa Step 4, huwag ituloy
          console.warn('Receipt not yet available, status:', data.status);
          const banner = document.getElementById('receiptIssuedBanner');
          if (banner) banner.style.display = 'none'; // itago muli ang banner
          // Ipakita ang maliit na mensahe sa approved banner area
          const errMsg = document.getElementById('receiptIssuedBanner');
          // Mag-alert lang para hindi malito ang user
          alert('Payment is not yet approved. Please wait for admin verification.');
          return;
        }
        // Approved na — ituloy ang Step 5
        _goToStep5WithReceipt(payNo);
      })
      .catch(function () {
        // Kung nag-fail ang status check, ituloy pa rin ang fetch
        // (baka network blip lang) — mas mabuti kaysa magblock
        _goToStep5WithReceipt(payNo);
      });
  };

  function _goToStep5WithReceipt(payNo) {
    // I-show ang Step 5, reset states
    hideSection('sectionStep4');
    showSection('sectionStep5');
    scrollToSection('sectionStep5');
    setStep(5);

    // Reset UI states sa loob ng Step 5
    const loadingEl = document.getElementById('receiptLoading');
    const errorEl   = document.getElementById('receiptError');
    const cardEl    = document.getElementById('erCard');

    if (loadingEl) loadingEl.style.display = 'flex';
    if (errorEl)   errorEl.style.display   = 'none';
    if (cardEl)    cardEl.style.display     = 'none';

    // Fetch receipt data mula sa JSON endpoint
    fetch('/borrower/payments/receipt-data/' + payNo)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (data.error) throw new Error(data.error);
        populateReceiptCard(data);
        if (loadingEl) loadingEl.style.display = 'none';
        if (cardEl)    cardEl.style.display     = 'block';
      })
      .catch(function (err) {
        console.error('Receipt fetch error:', err);
        if (loadingEl) loadingEl.style.display = 'none';
        if (errorEl) {
          errorEl.style.display = 'flex';
          const msgEl = document.getElementById('receiptErrorMsg');
          if (msgEl) msgEl.textContent = 'Could not load receipt. Please try again.';
        }
      });
  }

  /* ================================================================
     POPULATE RECEIPT CARD (Step 5)
     Mga id prefix "er" = "e-receipt" para walang conflict sa Step 4
  ================================================================ */
  function populateReceiptCard(data) {
    // Payment reference
    setText('erPayNo', data.payment_no);

    // Amount
    const amt = parseFloat(data.amount_paid);
    setText('erAmountVal', '₱' + amt.toLocaleString('en-PH', { minimumFractionDigits: 2 }));

    // Method badge
    const methodBadgeEl = document.getElementById('erMethodBadge');
    if (methodBadgeEl) {
      const badgeMap = {
        gcash: '<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;background:#e8f4ff;color:#0070e0;font-size:12px;font-weight:700;">💙 GCash</span>',
        maya:  '<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;background:#e8f9ee;color:#00b140;font-size:12px;font-weight:700;">💚 Maya</span>',
        bank:  '<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;background:#e8eeff;color:#003087;font-size:12px;font-weight:700;">🏦 BDO Transfer</span>',
        cash:  '<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;background:#eaf8f5;color:#2a9080;font-size:12px;font-weight:700;">💵 Cash / Walk-in</span>',
      };
      methodBadgeEl.innerHTML = badgeMap[data.payment_method] ||
        '<span style="font-weight:600">' + (data.payment_method || '—') + '</span>';
    }

    // Other fields
    setText('erTxnRef',      data.reference_number || '—');
    setText('erPaymentDate', data.payment_date     || '—');
    setText('erDateVerified',data.date_verified    || '—');
    setText('erLoanRef',     data.loan_ref         || '—');
    setText('erLoanType',    data.type_name        || '—');
    setText('erBorrowerName',data.borrower_name    || '—');
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  /* ================================================================
     STEP 5: BACK TO STEP 4
  ================================================================ */
  window.backToStep4 = function () {
    hideSection('sectionStep5');
    showSection('sectionStep4');
    scrollToSection('sectionStep4');
    setStep(4);
  };

  /* ================================================================
     STEP 5: PRINT RECEIPT
     I-hide lang ang top actions bago i-print, i-restore pagkatapos
  ================================================================ */
  window.printReceipt = function () {
    const topActions = document.querySelector('.er-top-actions');
    if (topActions) topActions.style.display = 'none';

    window.print();

    // I-restore pagkatapos ng print dialog
    setTimeout(function () {
      if (topActions) topActions.style.display = '';
    }, 1000);
  };

  /* ================================================================
     AUTO-DISMISS FLASH MESSAGES
  ================================================================ */
  setTimeout(() => {
    document.querySelectorAll('.flash-msg').forEach(el => {
      el.style.transition = 'opacity 0.4s';
      el.style.opacity    = '0';
      setTimeout(() => el.remove(), 400);
    });
  }, 4000);

})();