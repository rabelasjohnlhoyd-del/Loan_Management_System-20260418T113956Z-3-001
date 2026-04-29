/**
 * make_payment.js
 * Consolidated — sidebar toggle, notifications, user dropdown, payment flow
 */

(function () {
  'use strict';

  /* ================================================================
     SIDEBAR TOGGLE — same logic as dashboard
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

  /* Restore desktop preference on load */
  if (!isMobile() && localStorage.getItem(SIDEBAR_KEY) !== '0') openSidebar();

  burgerBtn?.addEventListener('click', toggleSidebar);
  sidebarOverlay?.addEventListener('click', closeSidebar);

  sidebar?.querySelectorAll('.nav-item, .user-dropdown a').forEach(link => {
    link.addEventListener('click', () => { if (isMobile()) closeSidebar(); });
  });

  window.addEventListener('resize', () => {
    if (!isMobile()) {
      sidebarOverlay.classList.remove('active');
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

  userToggle?.addEventListener('click', function (e) {
    e.stopPropagation();
    userDropdown.classList.toggle('open');
    userToggle.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (!userToggle?.contains(e.target) && !userDropdown?.contains(e.target)) {
      userDropdown?.classList.remove('open');
      userToggle?.classList.remove('open');
    }
  });

  /* ================================================================
     NOTIFICATIONS
  ================================================================ */
  const notifBtn      = document.getElementById('notifBtn');
  const notifDropdown = document.getElementById('notifDropdown');
  const notifDot      = document.getElementById('notifDot');
  const notifList     = document.getElementById('notifList');
  const notifMarkAll  = document.getElementById('notifMarkAll');

  function fetchUnreadCount() {
    fetch('/loans/api/notifications/count')
      .then(r => r.json())
      .then(data => {
        if (data.count > 0) notifDot?.classList.remove('hidden');
        else                notifDot?.classList.add('hidden');
      }).catch(() => {});
  }

  fetchUnreadCount();
  setInterval(fetchUnreadCount, 60000);

  function fetchNotifications() {
    if (!notifList) return;
    notifList.innerHTML = '<div class="notif-loading"><div class="notif-spinner"></div><span>Loading...</span></div>';
    fetch('/loans/api/notifications')
      .then(r => r.json())
      .then(data => {
        const items = data.notifications || [];
        if (items.length === 0) {
          notifList.innerHTML = '<div class="notif-empty"><p>You\'re all caught up!</p><small>No new notifications</small></div>';
          return;
        }
        notifList.innerHTML = items.map(n => {
          const unread = !n.is_read;
          return `<div class="notif-item${unread ? ' unread' : ''}" data-id="${n.id}" data-link="${n.link || ''}">
            <div class="notif-item-body">
              <div class="notif-item-title">${escHtml(n.title)}</div>
              <div class="notif-item-msg">${escHtml(n.message || '')}</div>
              <div class="notif-item-time">${escHtml(n.time_ago)}</div>
            </div>
            ${unread ? '<span class="notif-unread-dot"></span>' : ''}
          </div>`;
        }).join('');
        notifList.querySelectorAll('.notif-item').forEach(el => {
          el.addEventListener('click', function () {
            const id   = this.dataset.id;
            const link = this.dataset.link;
            if (this.classList.contains('unread')) {
              fetch(`/loans/api/notifications/${id}/read`, { method: 'POST' }).catch(() => {});
              this.classList.remove('unread');
              this.querySelector('.notif-unread-dot')?.remove();
              fetchUnreadCount();
            }
            if (link && link !== 'null' && link !== '') {
              notifDropdown.classList.remove('open');
              window.location.href = link;
            }
          });
        });
      }).catch(() => {
        notifList.innerHTML = '<div class="notif-empty"><p>Could not load notifications.</p></div>';
      });
  }

  notifBtn?.addEventListener('click', function (e) {
    e.stopPropagation();
    const opening = !notifDropdown.classList.contains('open');
    notifDropdown.classList.toggle('open');
    if (opening) fetchNotifications();
  });

  document.addEventListener('click', (e) => {
    if (!document.getElementById('notifWrap')?.contains(e.target)) {
      notifDropdown?.classList.remove('open');
    }
  });

  notifMarkAll?.addEventListener('click', () => {
    fetch('/loans/api/notifications/read-all', { method: 'POST' })
      .then(() => {
        notifList.querySelectorAll('.notif-item.unread').forEach(el => {
          el.classList.remove('unread');
          el.querySelector('.notif-unread-dot')?.remove();
        });
        notifDot?.classList.add('hidden');
      }).catch(() => {});
  });

  /* ================================================================
     AUTO-SHOW STEP 4 on redirect from POST
  ================================================================ */
  /* ================================================================
     AUTO-POPULATE & DIRECT TO STEP 5 (REKTA FLOW)
  ================================================================ */
  (function () {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === '1') {
      window.addEventListener('load', function () {
        const payNo   = params.get('ref');
        const amount  = params.get('amount') || '0';
        const method  = params.get('method') || '';
        const loanRef = params.get('loan_ref') || '—';

        if (payNo) {
          // 1. ITAGO ANG MGA UNANG SECTIONS (Pero huwag ang Topbar/Step Indicator)
          const selectLoanSection = document.getElementById('sectionSelectLoan');
          if (selectLoanSection) selectLoanSection.style.display = 'none';
          
          hideSection('sectionStep2');
          hideSection('sectionStep3');
          hideSection('sectionStep4');

          // 2. I-SET ANG STEP INDICATOR SA STEP 5 (Success Receipt)
          setStep(5);

          // 3. IPAKITA ANG RECEIPT SECTION
          showSection('sectionStep5');
          _confirmedPayNo = payNo;

          // 4. LOAD THE RECEIPT DATA
          _goToStep5WithReceipt(payNo);

          // 5. FORCE FILL ANG DATA PARA WALANG DASHES (—)
          setTimeout(() => {
              // I-fill ang Loan Ref at Method agad
              setText('erPayNo', payNo);
              setText('erLoanRef', loanRef);
              
              const methodNames = { 
                gcash: '💙 GCash', maya: '💚 Maya', bdo: '🏦 BDO Unibank', 
                bpi: '🏛️ BPI', landbank: '🌾 Landbank', visa: '💳 Visa/Card' 
              };
              
              const badgeLabel = methodNames[method] || method;
              const methodBadge = document.getElementById('erMethodBadge');
              if (methodBadge) methodBadge.innerHTML = badgeLabel;
              
              // I-scroll pataas para makita ang Step Indicator
              window.scrollTo({ top: 0, behavior: 'smooth' });
          }, 800);
        }
      });
    }
  })();

  // Submit Payment function
  window.submitPayment = function () {
    const btn = document.getElementById('btnIvePaid');
    const form = document.getElementById('paymentForm');
    
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="spinner"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg> Processing Rekta Payment...';
    }

    if (form) {
      form.submit();
    } else {
      alert("Error: Payment form not found.");
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = "Confirm Direct Payment";
      }
    }
  };

  /* ================================================================
     PAYMENT FLOW STATE
  ================================================================ */
  let selectedLoanData = null;
  let selectedMethod   = null;
  let currentStep      = 1;
  let _pollInterval    = null;
  let _confirmedPayNo  = null;

  const methodDetails = {
    gcash:    { name: 'GCash',          color: '#0070e0', colorLight: '#e8f4ff', icon: '💙', account: 'Hiraya Lending',      num: '0917-000-1234', prefix: 'https://gcash.com/pay' },
    maya:     { name: 'Maya',           color: '#00b140', colorLight: '#e8f9ee', icon: '💚', account: 'Hiraya Lending',      num: '0918-000-5678', prefix: 'https://maya.ph/pay' },
    bdo:      { name: 'BDO Unibank',    color: '#003087', colorLight: '#e8eeff', icon: '🏦', account: 'Hiraya Lending Corp.', num: '0012-3456-7890',  prefix: 'bdo-link' },
    bpi:      { name: 'BPI',            color: '#b31f24', colorLight: '#fff0f0', icon: '🏛️', account: 'Hiraya Corp.',         num: '1234-5678-90',   prefix: 'bpi-link' },
    landbank: { name: 'Landbank',       color: '#008000', colorLight: '#eaf8f0', icon: '🌾', account: 'Hiraya Lending',      num: '5555-4444-22',   prefix: 'lbp-link' },
    visa:     { name: 'Visa/Mastercard', color: '#1a1f71', colorLight: '#f7f7f7', icon: '💳', account: 'Direct Pay',         num: 'Secure Checkout', prefix: 'visa-link' }
  };
// In startPolling, since the backend now marks it 'verified' immediately, 
// the user will see the success screen almost instantly.
function startPolling(payNo) {
    if (_pollInterval) clearInterval(_pollInterval);
    // Faster check for auto-credit
    _pollInterval = setInterval(async function () {
        try {
            const res  = await fetch('/borrower/payments/status/' + payNo);
            const data = await res.json();
            if (data.status === 'verified' || data.status === 'approved') {
                clearInterval(_pollInterval);
                setTimelineCompleted(); // Jumps to E-Receipt
            }
        } catch (e) { console.warn('Polling error:', e); }
    }, 2000); 
}

  /* ── Init ── */
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

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ================================================================
     STEP INDICATOR
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
    selectedLoanData = null; selectedMethod = null;
    scrollToSection('sectionSelectLoan');
    setStep(1);
  };

  /* ================================================================
     STEP 3 — BUILD QR SCREEN
  ================================================================ */
  function buildQRScreen() {
    const d    = methodDetails[selectedMethod];
    const loan = selectedLoanData;
    
    // 1. GENERATE AUTOMATIC TRANSACTION REFERENCE (Para hindi na mag-type ang user)
    // Format: TXN-METHOD-TIMESTAMP (e.g., TXN-GCASH-K99NKD)
    const randomSuffix = Math.random().toString(36).toUpperCase().slice(-6);
    const txnRef = `TXN-${selectedMethod.toUpperCase()}-${randomSuffix}`;
    
    const amount = parseFloat(loan.amount).toFixed(2);
    const today  = new Date();
    const payDate = today.getFullYear() + '-' +
                    String(today.getMonth() + 1).padStart(2, '0') + '-' +
                    String(today.getDate()).padStart(2, '0');

    window._paymentRef = txnRef; // I-save sa global variable

    // 2. UPDATE UI (Para mawala ang mga "undefined" at "—")
    const badgeEl = document.getElementById('qrMethodBadge');
    if (badgeEl) {
        badgeEl.innerHTML = `<span>${d.icon}</span> ${d.name}`;
        badgeEl.style.background = d.colorLight;
        badgeEl.style.color = d.color;
    }

    setText('qrLoanRef',  loan.ref);  // Ito yung LN-2026-XXXX
    setText('qrLoanType', loan.type); // Ito yung Car Loan, etc.
    setText('qrDueDate',  loan.due);
    setText('qrAmount',   '₱' + parseFloat(amount).toLocaleString('en-PH', { minimumFractionDigits: 2 }));
    setText('qrRefNum',   txnRef);    // Ito yung TXN reference
    
    setText('qrAccountName', d.account);
    setText('qrAccountNum',  d.num);

    // 3. I-SET ANG HIDDEN INPUTS (Para ma-receive ng Python/borrower.py)
    const form = document.getElementById('paymentForm');
    if (form) form.action = '/borrower/payments/make/' + loan.id;

    setHidden('hiddenLoanId', loan.id);
    setHidden('hiddenMethod', selectedMethod);
    setHidden('hiddenRef',    txnRef);   // Ito ang magiging reference_number sa DB
    setHidden('hiddenAmount', amount);
    setHidden('hiddenDate',   payDate);

    // 4. GENERATE QR CODE DATA (Para sa Defense/Demo)
    // Kapag ni-scan ito, makikita ang detalye ng payment
    const qrData = `HIRAYA DIRECT PAY\n` +
                   `Method: ${d.name}\n` +
                   `Loan: ${loan.ref}\n` +
                   `Amount: PHP ${parseFloat(amount).toLocaleString()}\n` +
                   `Ref: ${txnRef}`;

    // 5. HANDLING DISPLAY (QR vs Cash)
    if (selectedMethod === 'cash') {
      document.getElementById('qrCodeWrap').style.display = 'none';
      document.getElementById('cashInstructions').style.display = 'block';
    } else {
      document.getElementById('qrCodeWrap').style.display = 'block';
      document.getElementById('cashInstructions').style.display = 'none';
      generateQR(qrData, d.color); // Tawagin ang QR generator
    }
  }

  function generateQR(data, accentColor) {
    const canvas = document.getElementById('qrCanvas');
    if (!canvas) return;
    if (typeof QRious !== 'undefined') {
      new QRious({ element: canvas, value: data, size: 200, level: 'H', foreground: '#1a3330', background: '#ffffff', padding: 10 });
      return;
    }
    const ctx = canvas.getContext('2d');
    canvas.width = 200; canvas.height = 200;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 200, 200);
    drawQRCorner(ctx, 8,   8,   accentColor);
    drawQRCorner(ctx, 144, 8,   accentColor);
    drawQRCorner(ctx, 8,   144, accentColor);
    ctx.fillStyle = '#5a7a76'; ctx.font = '9px monospace';
    ctx.textAlign = 'center'; ctx.fillText('Loading QR...', 100, 108);
    loadQRious(() => {
      if (typeof QRious !== 'undefined') {
        new QRious({ element: canvas, value: data, size: 200, level: 'H', foreground: '#1a3330', background: '#ffffff', padding: 10 });
      }
    });
  }

  function drawQRCorner(ctx, x, y, color) {
    ctx.strokeStyle = color || '#1a3330'; ctx.lineWidth = 4;
    ctx.strokeRect(x, y, 48, 48);
    ctx.fillStyle = color || '#1a3330';
    ctx.fillRect(x + 10, y + 10, 28, 28);
  }

  function loadQRious(cb) {
    if (document.getElementById('qrious-script')) { cb(); return; }
    const s = document.createElement('script');
    s.id = 'qrious-script';
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js';
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
      btn.disabled = true;
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
        setText('pendingRef', window._paymentRef || '—');
      }, 600);
    }
  };

  /* ================================================================
     STEP 4 — SHOW + START POLLING
  ================================================================ */
  window.showStep4 = function (ref, amount, method) {
    ['sectionSelectLoan', 'sectionStep2', 'sectionStep3', 'sectionStep5'].forEach(hideSection);
    showSection('sectionStep4');
    setStep(4);

    _confirmedPayNo = ref || null;

    setText('pendingRef', ref);
    setText('receiptLoanRef', (selectedLoanData && selectedLoanData.ref) || '—');

    if (method) {
      const icons = { gcash: '💙 GCash', maya: '💚 Maya', bank: '🏦 BDO Transfer', cash: '💵 Cash / Walk-in' };
      setText('receiptMethod', icons[method] || method);
    }

    const now = new Date();
    setText('receiptDate', now.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }));
    setText('receiptTxnRef', window._paymentRef || '—');

    if (amount) {
      setText('receiptAmount', '₱' + parseFloat(amount).toLocaleString('en-PH', { minimumFractionDigits: 2 }));
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
      } catch (e) { console.warn('Polling error:', e); }
    }, 5000);
  }

 function setTimelineCompleted() {
    const tlV = document.getElementById('tl-verification');
    if (tlV) { 
        tlV.classList.remove('pending'); 
        tlV.classList.add('done'); 
        setText('tl-verification-sub', 'Auto-credited successfully'); // Ito ang bagong text
    }
    const tlR = document.getElementById('tl-receipt');
    if (tlR) { 
        tlR.classList.remove('todo'); 
        tlR.classList.add('done'); 
        setText('tl-receipt-sub', 'Official receipt generated'); 
    }
    const banner = document.getElementById('receiptIssuedBanner');
    if (banner) { 
        banner.style.display = 'flex'; 
        banner.scrollIntoView({ behavior: 'smooth', block: 'center' }); 
    }
  }

  function setTimelineRejected() {
    const tlV = document.getElementById('tl-verification');
    if (tlV) { tlV.classList.remove('pending'); tlV.classList.add('rejected'); setText('tl-verification-sub', 'Payment was rejected'); }
    const banner = document.getElementById('receiptRejectedBanner');
    if (banner) { banner.style.display = 'flex'; banner.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }

  /* ================================================================
     STEP 4 → STEP 5: LOAD INLINE E-RECEIPT
  ================================================================ */
  window.loadAndShowReceipt = function () {
    const payNo = _confirmedPayNo;
    if (!payNo) return;

    fetch('/borrower/payments/status/' + payNo)
      .then(r => r.json())
      .then(data => {
        if (data.status !== 'approved' && data.status !== 'completed' && data.status !== 'verified') {
          document.getElementById('receiptIssuedBanner').style.display = 'none';
          alert('Payment is not yet approved. Please wait for admin verification.');
          return;
        }
        _goToStep5WithReceipt(payNo);
      })
      .catch(() => _goToStep5WithReceipt(payNo));
  };

  function _goToStep5WithReceipt(payNo) {
    hideSection('sectionStep4');
    showSection('sectionStep5');
    scrollToSection('sectionStep5');
    setStep(5);

    const loadingEl = document.getElementById('receiptLoading');
    const errorEl   = document.getElementById('receiptError');
    const cardEl    = document.getElementById('erCard');

    if (loadingEl) loadingEl.style.display = 'flex';
    if (errorEl)   errorEl.style.display   = 'none';
    if (cardEl)    cardEl.style.display     = 'none';

    fetch('/borrower/payments/receipt-data/' + payNo)
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(data => {
        if (data.error) throw new Error(data.error);
        populateReceiptCard(data);
        if (loadingEl) loadingEl.style.display = 'none';
        if (cardEl)    cardEl.style.display     = 'block';
      })
      .catch(err => {
        console.error('Receipt fetch error:', err);
        if (loadingEl) loadingEl.style.display = 'none';
        if (errorEl)   errorEl.style.display   = 'flex';
        setText('receiptErrorMsg', 'Could not load receipt. Please try again.');
      });
  }

  function populateReceiptCard(data) {
    setText('erPayNo', data.payment_no);
    const amt = parseFloat(data.amount_paid);
    setText('erAmountVal', '₱' + amt.toLocaleString('en-PH', { minimumFractionDigits: 2 }));

    const methodBadgeEl = document.getElementById('erMethodBadge');
    if (methodBadgeEl) {
      const badgeMap = {
        gcash: '<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;background:#e8f4ff;color:#0070e0;font-size:12px;font-weight:700;">💙 GCash</span>',
        maya:  '<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;background:#e8f9ee;color:#00b140;font-size:12px;font-weight:700;">💚 Maya</span>',
        bank:  '<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;background:#e8eeff;color:#003087;font-size:12px;font-weight:700;">🏦 BDO Transfer</span>',
        cash:  '<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;background:#eaf8f5;color:#2a9080;font-size:12px;font-weight:700;">💵 Cash / Walk-in</span>',
      };
      methodBadgeEl.innerHTML = badgeMap[data.payment_method] || '<span style="font-weight:600">' + (data.payment_method || '—') + '</span>';
    }

    setText('erTxnRef',       data.reference_number || '—');
    setText('erPaymentDate',  data.payment_date     || '—');
    setText('erDateVerified', data.date_verified    || '—');
    setText('erLoanRef',      data.loan_ref         || '—');
    setText('erLoanType',     data.type_name        || '—');
    setText('erBorrowerName', data.borrower_name    || '—');
  }

  /* ================================================================
     STEP 5: BACK + PRINT
  ================================================================ */
  window.backToStep4 = function () {
    hideSection('sectionStep5');
    showSection('sectionStep4');
    scrollToSection('sectionStep4');
    setStep(4);
  };

  window.printReceipt = function () {
    const topActions = document.querySelector('.er-top-actions');
    if (topActions) topActions.style.display = 'none';
    window.print();
    setTimeout(() => { if (topActions) topActions.style.display = ''; }, 1000);
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