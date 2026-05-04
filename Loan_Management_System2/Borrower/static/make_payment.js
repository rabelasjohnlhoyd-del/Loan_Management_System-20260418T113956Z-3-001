/**
 * make_payment.js
 * Full sidebar + notifications + payment flow
 * Consistent with payment_history.js logic
 */

(function () {
  'use strict';

  /* ================================================================
     1. SIDEBAR TOGGLE
  ================================================================ */
  const burgerBtn      = document.getElementById('burgerBtn');
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

  // Restore sidebar state on load
  if (!isMobile() && localStorage.getItem(SIDEBAR_KEY) !== '0') openSidebar();

  burgerBtn?.addEventListener('click', toggleSidebar);
  sidebarOverlay?.addEventListener('click', closeSidebar);

  // Close sidebar on mobile when nav link clicked
  document.querySelectorAll('.sidebar .nav-item, .user-dropdown a').forEach(link => {
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
     2. USER DROPDOWN
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
     3. NOTIFICATIONS DROPDOWN
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
              <div class="notif-item-title">${escapeHtml(n.title)}</div>
              <div class="notif-item-msg">${escapeHtml(n.message || '')}</div>
              <div class="notif-item-time">${escapeHtml(n.time_ago || '')}</div>
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

  if (notifBtn && notifDropdown) {
    notifBtn.addEventListener('click', function (e) {
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
  }

  if (notifMarkAll) {
    notifMarkAll.addEventListener('click', () => {
      fetch('/loans/api/notifications/read-all', { method: 'POST' })
        .then(() => {
          notifList?.querySelectorAll('.notif-item.unread').forEach(el => {
            el.classList.remove('unread');
            el.querySelector('.notif-unread-dot')?.remove();
          });
          notifDot?.classList.add('hidden');
        }).catch(() => {});
    });
  }

  /* ================================================================
     4. NOTIFICATIONS STYLES (injected)
  ================================================================ */
  const notifStyles = document.createElement('style');
  notifStyles.id = 'notif-styles';
  notifStyles.textContent = `
    .notif-spinner {
      width: 16px; height: 16px;
      border: 2px solid #deecea; border-top-color: #3ab5a0;
      border-radius: 50%; animation: notifSpin 0.7s linear infinite; flex-shrink: 0;
    }
    @keyframes notifSpin { to { transform: rotate(360deg); } }
    .notif-empty { padding: 32px 16px; text-align: center; color: #8aaeaa; }
    .notif-empty p { font-size: 13px; font-weight: 600; color: #4a6b67; margin: 0 0 4px; }
    .notif-empty small { font-size: 12px; }
  `;
  if (!document.querySelector('#notif-styles')) {
    document.head.appendChild(notifStyles);
  }

  /* ================================================================
     5. DOWNLOAD QR TOKEN
  ================================================================ */
  window.downloadOfficialQR = function (loanRef) {
    const canvas = document.createElement('canvas');
    const qrData = `HIRAYA-AUTH-${loanRef}`;

    if (typeof QRious !== 'undefined') {
      new QRious({
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
      alert('QR Library not loaded. Please refresh the page.');
    }
  };

  /* ================================================================
     6. PAYMENT FLOW STATE
  ================================================================ */
  let selectedLoanData = null;
  let selectedMethod   = null;
  let _confirmedPayNo  = null;

  const methodDetails = {
    gcash:    { name: 'GCash',       icon: '💙' },
    maya:     { name: 'Maya',        icon: '💚' },
    bdo:      { name: 'BDO Bank',    icon: '🏦' },
    bpi:      { name: 'BPI',         icon: '🏛️' },
    landbank: { name: 'Landbank',    icon: '🌾' },
    visa:     { name: 'Visa/Card',   icon: '💳' }
  };

  /* ================================================================
     7. QR SCANNER
  ================================================================ */
  const qrDropZone      = document.getElementById('qrDropZone');
  const qrFileInput     = document.getElementById('qrFileInput');
  const btnConfirm      = document.getElementById('btnConfirmPayment');
  const qrValidationMsg = document.getElementById('qrValidationMsg');

  if (qrDropZone) {
    qrDropZone.addEventListener('click', () => {
      if (document.getElementById('qrPreviewContainer')?.classList.contains('hidden')) {
        qrFileInput?.click();
      }
    });
    qrDropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      qrDropZone.classList.add('dragging');
    });
    qrDropZone.addEventListener('dragleave', () => {
      qrDropZone.classList.remove('dragging');
    });
    qrDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      qrDropZone.classList.remove('dragging');
      if (e.dataTransfer.files[0]) handleQRFile(e.dataTransfer.files[0]);
    });
  }

  qrFileInput?.addEventListener('change', (e) => {
    if (e.target.files[0]) handleQRFile(e.target.files[0]);
  });

  function handleQRFile(file) {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      const img = new Image();
      img.onload = function () {
        const canvas = document.createElement('canvas');
        const ctx    = canvas.getContext('2d');
        canvas.width  = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = window.jsQR ? jsQR(imageData.data, imageData.width, imageData.height) : null;

        if (code && code.data === `HIRAYA-AUTH-${selectedLoanData?.ref}`) {
          processValidQR(e.target.result);
        } else {
          if (qrValidationMsg) {
            qrValidationMsg.textContent = '❌ Authentication Failed! Invalid or wrong QR token.';
            qrValidationMsg.style.color = '#dc2626';
          }
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function processValidQR(imageSrc) {
    const previewImg  = document.getElementById('qrPreviewImg');
    const previewWrap = document.getElementById('qrPreviewContainer');
    const scanContent = document.getElementById('scannerContent');

    if (previewImg)  previewImg.src = imageSrc;
    if (previewWrap) previewWrap.classList.remove('hidden');
    if (scanContent) scanContent.classList.add('hidden');

    if (qrValidationMsg) {
      qrValidationMsg.textContent = '✅ QR Verified! You can now proceed.';
      qrValidationMsg.style.color = '#15803d';
    }
    if (btnConfirm) btnConfirm.disabled = false;
    document.getElementById('btnResetQR')?.classList.remove('hidden');
  }

  window.resetScanner = function () {
    document.getElementById('qrPreviewContainer')?.classList.add('hidden');
    document.getElementById('scannerContent')?.classList.remove('hidden');
    if (qrFileInput) qrFileInput.value = '';
    if (btnConfirm)  btnConfirm.disabled = true;
    document.getElementById('btnResetQR')?.classList.add('hidden');
    if (qrValidationMsg) {
      qrValidationMsg.textContent = 'Waiting for QR verification...';
      qrValidationMsg.style.color = '';
    }
  };

  /* ================================================================
     8. NAVIGATION HANDLERS
  ================================================================ */

  // Quick amount buttons
  window.setQuickAmount = function (months) {
    if (!selectedLoanData) return;
    const total    = selectedLoanData.amount * months;
    const amtInput = document.getElementById('inputAmountToPay');
    if (amtInput) {
      amtInput.value = total.toFixed(2);
      amtInput.style.backgroundColor = '#eaf8f5';
      setTimeout(() => amtInput.style.backgroundColor = '', 350);
    }
  };

  // Step 2 — Select Method
  window.selectMethod = function (method, el) {
    selectedMethod = method;
    document.querySelectorAll('.method-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');

    const btn = document.getElementById('btnContinueToQR');
    if (btn) btn.disabled = false;
  };

  // Proceed to Step 3
  window.proceedToStep3 = function () {
    const amtInput   = document.getElementById('inputAmountToPay');
    const finalAmount = parseFloat(amtInput?.value || 0);

    if (!finalAmount || finalAmount < selectedLoanData.amount) {
      alert(`The amount cannot be lower than your monthly due of ₱${selectedLoanData.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`);
      return;
    }

    selectedLoanData.userSelectedAmount = finalAmount;

    hideSection('sectionStep2');
    showSection('sectionStep3');
    setStep(3);
    buildQRScreen();
  };

  function buildQRScreen() {
    const d = methodDetails[selectedMethod] || { name: selectedMethod, icon: '💳' };

    setText('sumLoanRef', selectedLoanData.ref);
    setText('sumMethod',  `${d.icon} ${d.name}`);
    setText('sumAmount',  `₱${selectedLoanData.userSelectedAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`);

    const form = document.getElementById('paymentForm');
    if (form) form.action = `/borrower/payments/make/${selectedLoanData.id}`;

    setVal('hiddenLoanId',  selectedLoanData.id);
    setVal('hiddenMethod',  selectedMethod);
    setVal('hiddenRef',     'TXN-' + Math.random().toString(36).toUpperCase().slice(-8));
    setVal('hiddenAmount',  selectedLoanData.userSelectedAmount);
    setVal('hiddenDate',    new Date().toISOString().split('T')[0]);

    resetScanner();
  }

  // Final submit
  window.submitPayment = function () {
    const btn = document.getElementById('btnConfirmPayment');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span style="display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,0.4);border-top-color:#fff;border-radius:50%;animation:erSpin 0.7s linear infinite;margin-right:8px;vertical-align:middle;"></span> Processing...';
    }
    document.getElementById('paymentForm')?.submit();
  };

  // Back buttons
  window.backToStep1 = function () {
    hideSection('sectionStep2');
    showSection('sectionSelectLoan');
    setStep(1);
  };

  window.backToStep2 = function () {
    hideSection('sectionStep3');
    showSection('sectionStep2');
    setStep(2);
  };

  /* ================================================================
     9. SUCCESS RECEIPT — auto-load after redirect
  ================================================================ */
  (function () {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') !== '1') return;

    window.addEventListener('load', function () {
      const payNo = params.get('ref');
      if (!payNo) return;

      hideSection('sectionSelectLoan');
      hideSection('sectionStep2');
      hideSection('sectionStep3');
      setStep(4);
      showSection('sectionStep5');

      _confirmedPayNo = payNo;
      _loadReceiptData(payNo);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  })();

  function _loadReceiptData(payNo) {
    const loadingEl = document.getElementById('receiptLoading');
    const cardEl    = document.getElementById('erCard');

    if (loadingEl) loadingEl.style.display = 'flex';
    if (cardEl)    cardEl.style.display    = 'none';

    fetch(`/borrower/payments/receipt-data/${payNo}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);

        setText('erPayNo',        data.payment_no);
        setText('erAmountVal',    `₱${parseFloat(data.amount_paid).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`);
        setText('erLoanRef',      data.loan_ref);
        setText('erLoanType',     data.type_name);
        setText('erBorrowerName', data.borrower_name);
        setText('erDateVerified', data.date_verified || '—');
        setText('erTxnRef',       data.reference_number || '—');

        const methodBadgeEl = document.getElementById('erMethodBadge');
        if (methodBadgeEl) {
          const icons = {
            gcash:    '💙 GCash',
            maya:     '💚 Maya',
            bdo:      '🏦 BDO Bank',
            bpi:      '🏛️ BPI',
            landbank: '🌾 Landbank',
            visa:     '💳 Visa/Card'
          };
          methodBadgeEl.textContent = icons[data.payment_method] || data.payment_method;
        }

        if (loadingEl) loadingEl.style.display = 'none';
        if (cardEl)    cardEl.style.display    = 'block';
      })
      .catch(() => {
        if (loadingEl) loadingEl.style.display = 'none';
        if (cardEl) {
          cardEl.style.display = 'block';
          cardEl.innerHTML = `<div style="padding:40px;text-align:center;color:#dc2626;">
            <div style="font-size:32px;margin-bottom:10px;">⚠️</div>
            <p style="font-weight:600;">Could not load receipt data.</p>
            <p style="font-size:12px;margin-top:6px;color:#9bbcb7;">Your payment was still processed successfully.</p>
          </div>`;
        }
      });
  }

  /* ================================================================
     10. HELPERS
  ================================================================ */
  function showSection(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('hidden'); el.style.display = ''; }
  }

  function hideSection(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.add('hidden'); el.style.display = 'none'; }
  }

  function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function setStep(n) {
    document.querySelectorAll('.step').forEach((s, i) => {
      s.classList.remove('active', 'done', 'todo');
      if      (i + 1 < n)  s.classList.add('done');
      else if (i + 1 === n) s.classList.add('active');
      else                  s.classList.add('todo');
    });
    document.querySelectorAll('.step-line').forEach((line, i) => {
      if (i + 1 < n) line.classList.add('done');
      else           line.classList.remove('done');
    });
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  window.printReceipt = function () { window.print(); };

  // Auto-dismiss flash messages
  setTimeout(() => {
    document.querySelectorAll('.flash-msg').forEach(el => {
      el.style.transition = 'opacity 0.4s';
      el.style.opacity    = '0';
      setTimeout(() => el.remove(), 400);
    });
  }, 4000);

  // Init
  document.addEventListener('DOMContentLoaded', function () {
    // Only init steps if not coming from success redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') !== '1') {
      hideSection('sectionStep2');
      hideSection('sectionStep3');
      hideSection('sectionStep5');
      setStep(1);
    }

    // ── Loan card click — event delegation so QR btn doesn't block ──
    document.querySelectorAll('.loan-select-card').forEach(function (card) {
      card.addEventListener('click', function (e) {
        // If QR token button was clicked, ignore — handled separately
        if (e.target.closest('.btn-qr-token')) return;

        const id     = card.dataset.loanId;
        const ref    = card.dataset.loanRef;
        const amount = parseFloat(card.dataset.loanAmount) || 0;
        const type   = card.dataset.loanType;

        selectedLoanData = { id, ref, amount, type };

        const amtInput = document.getElementById('inputAmountToPay');
        if (amtInput) amtInput.value = amount.toFixed(2);

        const hint = document.getElementById('minAmountHint');
        if (hint) hint.textContent = 'Minimum Monthly Due: ₱' + amount.toLocaleString('en-PH', { minimumFractionDigits: 2 });

        document.querySelectorAll('.loan-select-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');

        setTimeout(function () {
          hideSection('sectionSelectLoan');
          showSection('sectionStep2');
          setStep(2);
        }, 280);
      });
    });

    // ── QR Token button — separate clean handler ──
    document.querySelectorAll('.btn-qr-token').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const loanRef = btn.dataset.loanRef;
        downloadOfficialQR(loanRef);
      });
    });
  });

})();