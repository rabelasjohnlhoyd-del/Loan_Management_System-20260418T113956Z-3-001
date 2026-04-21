/* apply.js — Loan Application Form Logic */

/* ═══════════════════════════════════════
   1. ACTIVE NAV HIGHLIGHT
═══════════════════════════════════════ */
(function () {
  var path = window.location.pathname;
  document.querySelectorAll('.nav-item').forEach(function (el) {
    var href = el.getAttribute('href');
    if (href && href !== '#' && path.startsWith(href)) {
      el.classList.add('active');
    }
  });
})();

/* ═══════════════════════════════════════
   2. MOBILE SIDEBAR TOGGLE
═══════════════════════════════════════ */
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

/* ═══════════════════════════════════════
   3. TOAST NOTIFICATION SYSTEM
═══════════════════════════════════════ */
(function () {
  var style = document.createElement('style');
  style.textContent = [
    '#toast-container{position:fixed;top:20px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:10px;pointer-events:none;}',
    '.toast{pointer-events:all;min-width:300px;max-width:380px;background:#1e293b;color:#e2e8f0;border-radius:12px;padding:14px 18px;display:flex;align-items:flex-start;gap:12px;box-shadow:0 8px 32px rgba(0,0,0,.35);border-left:4px solid #38bdf8;animation:toastIn .35s cubic-bezier(.21,1.02,.73,1) forwards;font-size:13px;line-height:1.5;}',
    '.toast.toast--success{border-left-color:#22c55e;}',
    '.toast.toast--danger{border-left-color:#ef4444;}',
    '.toast.toast--warning{border-left-color:#f59e0b;}',
    '.toast.toast--info{border-left-color:#38bdf8;}',
    '.toast-icon{font-size:18px;flex-shrink:0;margin-top:1px;}',
    '.toast-body{flex:1;}',
    '.toast-title{font-weight:600;font-size:13px;margin-bottom:2px;color:#f1f5f9;}',
    '.toast-msg{font-size:12px;color:#94a3b8;}',
    '.toast-close{background:none;border:none;color:#64748b;cursor:pointer;font-size:16px;padding:0;line-height:1;flex-shrink:0;margin-top:-2px;}',
    '.toast-close:hover{color:#e2e8f0;}',
    '.toast.toast--out{animation:toastOut .3s ease forwards;}',
    '@keyframes toastIn{from{opacity:0;transform:translateX(40px) scale(.95)}to{opacity:1;transform:translateX(0) scale(1)}}',
    '@keyframes toastOut{from{opacity:1;transform:translateX(0) scale(1);max-height:120px}to{opacity:0;transform:translateX(40px) scale(.95);max-height:0;margin-bottom:-10px}}',

    /* Status Modal */
    '#sn-overlay{display:none;position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,.65);',
    'align-items:center;justify-content:center;backdrop-filter:blur(6px);padding:16px;}',
    '#sn-overlay.open{display:flex;}',
    '#sn-box{background:#0f172a;border:1px solid #1e293b;border-radius:20px;padding:36px 32px;',
    'width:100%;max-width:460px;box-shadow:0 32px 80px rgba(0,0,0,.6);',
    'animation:snIn .35s cubic-bezier(.21,1.02,.73,1);}',
    '@keyframes snIn{from{opacity:0;transform:scale(.9) translateY(20px)}to{opacity:1;transform:scale(1) translateY(0)}}',
    '.sn-icon-wrap{width:72px;height:72px;border-radius:50%;display:flex;align-items:center;',
    'justify-content:center;margin:0 auto 18px;font-size:32px;}',
    '.sn-icon-wrap.rejected{background:rgba(239,68,68,.12);border:2px solid rgba(239,68,68,.3);}',
    '.sn-icon-wrap.approved{background:rgba(34,197,94,.12);border:2px solid rgba(34,197,94,.3);}',
    '.sn-icon-wrap.under_review{background:rgba(56,189,248,.12);border:2px solid rgba(56,189,248,.3);}',
    '.sn-icon-wrap.pending{background:rgba(245,158,11,.12);border:2px solid rgba(245,158,11,.3);}',
    '#sn-box h3{text-align:center;font-size:20px;font-weight:700;margin:0 0 6px;}',
    '#sn-box h3.rejected{color:#ef4444;}',
    '#sn-box h3.approved{color:#22c55e;}',
    '#sn-box h3.under_review{color:#38bdf8;}',
    '#sn-box h3.pending{color:#f59e0b;}',
    '#sn-box .sn-sub{color:#94a3b8;font-size:13px;text-align:center;margin:0 0 20px;line-height:1.7;}',
    '.sn-card{border-radius:10px;padding:14px 16px;margin-bottom:16px;}',
    '.sn-card.rejected{background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.2);border-left:4px solid #ef4444;}',
    '.sn-card.approved{background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.2);border-left:4px solid #22c55e;}',
    '.sn-card.under_review{background:rgba(56,189,248,.06);border:1px solid rgba(56,189,248,.2);border-left:4px solid #38bdf8;}',
    '.sn-card.pending{background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.2);border-left:4px solid #f59e0b;}',
    '.sn-card-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:6px;}',
    '.sn-card-text{color:#e2e8f0;font-size:13px;line-height:1.6;}',
    '.sn-divider{height:1px;background:#1e293b;margin:16px 0;}',
    '.sn-tips-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#64748b;margin-bottom:8px;}',
    '.sn-tip{display:flex;align-items:flex-start;gap:8px;font-size:12px;color:#94a3b8;line-height:1.5;margin-bottom:5px;}',
    '.sn-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;margin-top:5px;}',
    '.sn-dot.rejected{background:#ef4444;}.sn-dot.approved{background:#22c55e;}',
    '.sn-dot.under_review{background:#38bdf8;}.sn-dot.pending{background:#f59e0b;}',
    '.sn-actions{display:flex;gap:10px;margin-top:22px;}',
    '.sn-btn{flex:1;padding:11px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;border:none;transition:all .2s;}',
    '.sn-btn:hover{opacity:.85;transform:translateY(-1px);}',
    '.sn-dismiss{background:#1e293b;color:#94a3b8;}',
    '.sn-primary.rejected{background:#ef4444;color:#fff;}',
    '.sn-primary.approved{background:#22c55e;color:#fff;}',
    '.sn-primary.under_review{background:#38bdf8;color:#0f172a;}',
    '.sn-primary.pending{background:#f59e0b;color:#0f172a;}',
    /* Queue counter badge */
    '.sn-counter{display:inline-block;background:#334155;color:#94a3b8;font-size:10px;',
    'font-weight:700;padding:2px 8px;border-radius:20px;margin:0 auto 14px;text-align:center;}',

    /* Amount slider */
    '.amt-slider-wrap{margin-top:8px;}',
    '.amt-slider-wrap input[type=range]{width:100%;accent-color:#3ab5a0;cursor:pointer;}',
    '.amt-slider-labels{display:flex;justify-content:space-between;font-size:11px;color:#64748b;margin-top:4px;}',

    /* Calc pulse */
    '@keyframes calcPulse{0%{background:#d4f0eb}100%{background:transparent}}',
    '.calc-pulse{animation:calcPulse .6s ease;}',

    /* ─── Progress steps — sidebar-matched colors ─── */
    '#apply-steps{display:flex;align-items:center;gap:0;margin-bottom:24px;}',
    '.apply-step{display:flex;align-items:center;gap:8px;flex:1;}',
    '.apply-step:last-child{flex:none;}',

    /* Default (future) step */
    '.step-dot{width:28px;height:28px;border-radius:50%;background:#e8f7f5;border:2px solid #b2ddd7;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#2a9485;flex-shrink:0;transition:all .3s;}',

    /* Active step — sidebar gradient top color */
    '.step-dot.active{background:#2a9080;border-color:#2a9080;color:#ffffff;}',

    /* Done/completed step — sidebar gradient bottom color */
    '.step-dot.done{background:#1e6e60;border-color:#1e6e60;color:#ffffff;}',

    /* Step label */
    '.step-label{font-size:11px;color:#94a3b8;white-space:nowrap;}',
    '.step-label.active{color:#2a9080;font-weight:600;}',

    /* Connector line */
    '.step-line{flex:1;height:2px;background:#b2ddd7;margin:0 4px;}',
    '.step-line.done{background:#1e6e60;}'

  ].join('');
  document.head.appendChild(style);

  /* Toast container */
  var container = document.createElement('div');
  container.id  = 'toast-container';
  document.body.appendChild(container);

  window.showToast = function (type, title, msg, duration) {
    duration = duration || 5000;
    var icons = { success: '✅', danger: '❌', warning: '⚠️', info: 'ℹ️' };
    var toast = document.createElement('div');
    toast.className = 'toast toast--' + type;
    toast.innerHTML =
      '<span class="toast-icon">' + (icons[type] || 'ℹ️') + '</span>' +
      '<div class="toast-body">' +
        '<div class="toast-title">' + title + '</div>' +
        (msg ? '<div class="toast-msg">' + msg + '</div>' : '') +
      '</div>' +
      '<button class="toast-close" aria-label="Close">✕</button>';
    container.appendChild(toast);
    toast.querySelector('.toast-close').addEventListener('click', function () {
      dismiss(toast);
    });
    var t = setTimeout(function () { dismiss(toast); }, duration);
    toast._t = t;
  };

  function dismiss(toast) {
    clearTimeout(toast._t);
    toast.classList.add('toast--out');
    setTimeout(function () { toast.remove(); }, 350);
  }
})();

/* ═══════════════════════════════════════
   4. STATUS NOTIFICATION QUEUE
   Reads _NOTIFICATIONS array from template.
   Filters out already-seen ones via localStorage.
   Shows modals one-by-one: approved first,
   then rejected, then others.
   Each modal has a queue counter (e.g. "1 of 2").
═══════════════════════════════════════ */
(function () {
  if (typeof _NOTIFICATIONS === 'undefined' || !_NOTIFICATIONS.length) return;

  /* ── Config per status ── */
  var CONFIG = {
    approved: {
      icon: '🎉',
      heading: 'Application Approved!',
      color: 'approved',
      cardLabel: 'Great news',
      cardText: 'Your loan amount will be processed and disbursed to your registered account. Check My Loans for your repayment schedule.',
      tips: [
        'Your loan will be disbursed shortly.',
        'Check your registered contact for disbursement details.',
        'Review your repayment schedule under My Loans.',
        'Set reminders for your monthly due dates to avoid penalties.',
      ],
      primaryLabel: 'View My Loans →',
      primaryFn: function () {
        var link = document.querySelector('a[href*="my_loans"], a[href*="loans"]');
        window.location.href = link ? link.href : '/loans';
      },
    },
    rejected: {
      icon: '❌',
      heading: 'Application Not Approved',
      color: 'rejected',
      cardLabel: 'Reason from reviewer',
      tips: [
        'Read the reason carefully before reapplying.',
        'Ensure your ID verification is fully approved.',
        'Consider applying for a lower amount or a longer term.',
        'Reach out to your loan officer for further guidance.',
      ],
      primaryLabel: 'Apply Again →',
      primaryFn: function () {
        var link = document.querySelector('a[href*="apply"]');
        window.location.href = link ? link.href : '/apply';
      },
    },
    under_review: {
      icon: '🔍',
      heading: 'Application Under Review',
      color: 'under_review',
      cardLabel: 'Status update',
      cardText: 'Our loan officers are currently reviewing your documents and application details. This usually takes 1–3 business days.',
      tips: [
        'Your application is currently being evaluated.',
        'This typically takes 1–3 business days.',
        'Make sure your profile information is complete.',
        'You will be notified once a decision has been made.',
      ],
      primaryLabel: 'Got It',
      primaryFn: function () {},
    },
    pending: {
      icon: '⏳',
      heading: 'Application Pending',
      color: 'pending',
      cardLabel: 'What\'s next',
      cardText: 'Your application has been submitted and is in the queue for review. Please ensure all required documents are uploaded.',
      tips: [
        'Your application is queued for review.',
        'Ensure all required documents are uploaded.',
        'Complete your profile if not yet done.',
        'Check back in 1–2 business days for an update.',
      ],
      primaryLabel: 'Got It',
      primaryFn: function () {},
    },
  };

  /* ── Filter out already-seen notifications ── */
  var queue = _NOTIFICATIONS.filter(function (n) {
    var key = 'sn_seen_' + n.id + '_' + n.status;
    try { return !localStorage.getItem(key); } catch (e) { return true; }
  });

  if (!queue.length) return;

  var currentIndex = 0;

  /* ── Build modal DOM once, reuse ── */
  var overlay = document.createElement('div');
  overlay.id  = 'sn-overlay';
  overlay.innerHTML =
    '<div id="sn-box" role="dialog" aria-modal="true">' +
      '<div id="sn-counter" class="sn-counter" style="display:none;"></div>' +
      '<div id="sn-icon-wrap" class="sn-icon-wrap"></div>' +
      '<h3 id="sn-heading"></h3>' +
      '<p id="sn-sub" class="sn-sub"></p>' +
      '<div id="sn-card" class="sn-card">' +
        '<div id="sn-card-label" class="sn-card-label"></div>' +
        '<div id="sn-card-text" class="sn-card-text"></div>' +
      '</div>' +
      '<div class="sn-divider"></div>' +
      '<div class="sn-tips-label">What you can do next</div>' +
      '<div id="sn-tips"></div>' +
      '<div class="sn-actions">' +
        '<button class="sn-btn sn-dismiss" id="sn-dismiss-btn">Dismiss</button>' +
        '<button class="sn-btn sn-primary" id="sn-primary-btn"></button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);

  function markSeen(n) {
    try { localStorage.setItem('sn_seen_' + n.id + '_' + n.status, '1'); } catch (e) {}
  }

  function renderModal(index) {
    var n   = queue[index];
    var cfg = CONFIG[n.status] || CONFIG['rejected'];

    /* Counter badge — only show if more than 1 */
    var counter = document.getElementById('sn-counter');
    if (queue.length > 1) {
      counter.textContent = (index + 1) + ' of ' + queue.length;
      counter.style.display = 'block';
    } else {
      counter.style.display = 'none';
    }

    /* Icon */
    var iconWrap = document.getElementById('sn-icon-wrap');
    iconWrap.className = 'sn-icon-wrap ' + cfg.color;
    iconWrap.textContent = cfg.icon;

    /* Heading */
    var heading = document.getElementById('sn-heading');
    heading.className = cfg.color;
    heading.textContent = cfg.heading;

    /* Sub text */
    document.getElementById('sn-sub').innerHTML =
      'Your <strong style="color:#e2e8f0">' + n.type_name + '</strong> application' +
      (n.reference_no ? ' <strong style="color:#e2e8f0">(' + n.reference_no + ')</strong>' : '') +
      {
        approved:     ' has been approved.',
        rejected:     ' was reviewed and was not approved at this time.',
        under_review: ' is currently being evaluated by our team.',
        pending:      ' has been submitted and is awaiting review.',
      }[n.status];

    /* Card */
    var card = document.getElementById('sn-card');
    card.className = 'sn-card ' + cfg.color;
    document.getElementById('sn-card-label').textContent = cfg.cardLabel;
    document.getElementById('sn-card-text').textContent  =
      n.status === 'rejected'
        ? (n.rejection_reason || 'No specific reason was provided. Please contact your loan officer.')
        : cfg.cardText;

    /* Tips */
    document.getElementById('sn-tips').innerHTML = cfg.tips.map(function (t) {
      return '<div class="sn-tip"><span class="sn-dot ' + cfg.color + '"></span>' + t + '</div>';
    }).join('');

    /* Primary button */
    var primaryBtn = document.getElementById('sn-primary-btn');
    primaryBtn.className = 'sn-btn sn-primary ' + cfg.color;
    primaryBtn.textContent = queue.length > 1 && index < queue.length - 1
      ? 'Next →'
      : cfg.primaryLabel;

    /* Store current config for button handler */
    overlay._currentCfg = cfg;
    overlay._currentN   = n;
  }

  function openModal(index) {
    renderModal(index);
    /* Re-trigger animation */
    var box = document.getElementById('sn-box');
    box.style.animation = 'none';
    void box.offsetWidth;
    box.style.animation = '';
    overlay.classList.add('open');
  }

  function closeAndNext() {
    markSeen(overlay._currentN);
    currentIndex++;
    if (currentIndex < queue.length) {
      /* Brief pause between modals so it feels intentional */
      overlay.classList.remove('open');
      setTimeout(function () { openModal(currentIndex); }, 350);
    } else {
      overlay.classList.remove('open');
    }
  }

  /* Dismiss = mark seen, show next */
  document.getElementById('sn-dismiss-btn').addEventListener('click', closeAndNext);

  /* Primary button = mark seen, run action OR show next */
  document.getElementById('sn-primary-btn').addEventListener('click', function () {
    var cfg = overlay._currentCfg;
    var isLast = currentIndex >= queue.length - 1;
    markSeen(overlay._currentN);
    currentIndex++;
    if (currentIndex < queue.length) {
      overlay.classList.remove('open');
      setTimeout(function () { openModal(currentIndex); }, 350);
    } else {
      overlay.classList.remove('open');
      if (isLast) cfg.primaryFn();
    }
  });

  /* Click outside or Escape = dismiss current, show next */
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeAndNext();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.classList.contains('open')) closeAndNext();
  });

  /* Start the queue */
  setTimeout(function () { openModal(0); }, 500);

})();

/* ═══════════════════════════════════════
   5. APPLICATION PROGRESS STEPS
   Shows which step of the form is complete
═══════════════════════════════════════ */
(function () {
  var form = document.getElementById('apply-form');
  if (!form) return;

  var stepsEl = document.createElement('div');
  stepsEl.id  = 'apply-steps';
  stepsEl.innerHTML =
    '<div class="apply-step">' +
      '<div class="step-dot active" id="sdot-1">1</div>' +
      '<span class="step-label active" id="slbl-1">Loan Type</span>' +
    '</div>' +
    '<div class="step-line" id="sline-1"></div>' +
    '<div class="apply-step">' +
      '<div class="step-dot" id="sdot-2">2</div>' +
      '<span class="step-label" id="slbl-2">Plan</span>' +
    '</div>' +
    '<div class="step-line" id="sline-2"></div>' +
    '<div class="apply-step">' +
      '<div class="step-dot" id="sdot-3">3</div>' +
      '<span class="step-label" id="slbl-3">Amount &amp; Term</span>' +
    '</div>' +
    '<div class="step-line" id="sline-3"></div>' +
    '<div class="apply-step">' +
      '<div class="step-dot" id="sdot-4">4</div>' +
      '<span class="step-label" id="slbl-4">Submit</span>' +
    '</div>';

  form.insertBefore(stepsEl, form.firstChild);

  window._updateSteps = function (step) {
    for (var i = 1; i <= 4; i++) {
      var dot  = document.getElementById('sdot-' + i);
      var lbl  = document.getElementById('slbl-' + i);
      var line = document.getElementById('sline-' + i);
      if (!dot) continue;
      dot.classList.remove('active', 'done');
      lbl.classList.remove('active');
      if (line) line.classList.remove('done');
      if (i < step)  { dot.classList.add('done'); dot.textContent = '✓'; if (line) line.classList.add('done'); }
      if (i === step) { dot.classList.add('active'); lbl.classList.add('active'); }
      if (i > step)  { dot.textContent = i; }
    }
  };
  window._updateSteps(1);
})();

/* ═══════════════════════════════════════
   6. MAIN FORM LOGIC
═══════════════════════════════════════ */
(function () {
  var loanTypeSelect = document.getElementById('loan_type_id');
  var planGroup      = document.getElementById('plan-group');
  var planSelect     = document.getElementById('loan_plan_id');
  var planHint       = document.getElementById('plan-hint');
  var amountGroup    = document.getElementById('amount-group');
  var amountInput    = document.getElementById('amount');
  var amountHint     = document.getElementById('amount-hint');
  var termGroup      = document.getElementById('term-group');
  var termSelect     = document.getElementById('term_months');
  var submitBtn      = document.getElementById('submit-btn');
  var applyForm      = document.getElementById('apply-form');

  if (!loanTypeSelect || !applyForm) return;

  var calcMonthly   = document.getElementById('calc-monthly');
  var calcPrincipal = document.getElementById('calc-principal');
  var calcRate      = document.getElementById('calc-rate');
  var calcTerm      = document.getElementById('calc-term');
  var calcInterest  = document.getElementById('calc-interest');
  var calcTotal     = document.getElementById('calc-total');

  var selectedPlan = null;

  function peso(val) {
    return '₱' + parseFloat(val || 0).toLocaleString('en-PH', {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    });
  }

  function resetCalculator() {
    if (calcMonthly)   calcMonthly.textContent   = '₱0.00';
    if (calcPrincipal) calcPrincipal.textContent = '₱0.00';
    if (calcRate)      calcRate.textContent       = '0%';
    if (calcTerm)      calcTerm.textContent       = '— months';
    if (calcInterest)  calcInterest.textContent   = '₱0.00';
    if (calcTotal)     calcTotal.textContent      = '₱0.00';
  }

  function monthlyPayment(principal, annualRate, months) {
    if (!principal || !months) return 0;
    if (annualRate === 0) return principal / months;
    var r = (annualRate / 100) / 12;
    return principal * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
  }

  function pulseCalc() {
    var rows = document.querySelectorAll('.calc-row.cr-highlight');
    rows.forEach(function (r) {
      r.classList.remove('calc-pulse');
      void r.offsetWidth;
      r.classList.add('calc-pulse');
    });
  }

  function updateCalculator() {
    if (!selectedPlan) { resetCalculator(); return; }
    var principal = parseFloat(amountInput.value) || 0;
    var months    = parseInt(termSelect.value)    || 0;
    var rate      = parseFloat(selectedPlan.interest_rate) || 0;
    if (!principal || !months) { resetCalculator(); return; }

    var monthly  = monthlyPayment(principal, rate, months);
    var total    = monthly * months;
    var interest = total - principal;

    if (calcMonthly)   calcMonthly.textContent   = peso(monthly);
    if (calcPrincipal) calcPrincipal.textContent = peso(principal);
    if (calcRate)      calcRate.textContent       = rate + '%';
    if (calcTerm)      calcTerm.textContent       = months + ' month' + (months !== 1 ? 's' : '');
    if (calcInterest)  calcInterest.textContent   = peso(interest);
    if (calcTotal)     calcTotal.textContent      = peso(total);
    pulseCalc();
  }

  /* --- Amount Slider --- */
  function buildAmountSlider(min, max) {
    var old = document.getElementById('amt-slider-wrap');
    if (old) old.remove();
    var wrap = document.createElement('div');
    wrap.id = 'amt-slider-wrap';
    wrap.className = 'amt-slider-wrap';
    wrap.innerHTML =
      '<input type="range" id="amt-slider" min="' + min + '" max="' + max +
      '" step="1000" value="' + min + '">' +
      '<div class="amt-slider-labels">' +
        '<span>₱' + Number(min).toLocaleString() + '</span>' +
        '<span>₱' + Number(max).toLocaleString() + '</span>' +
      '</div>';
    amountInput.parentElement.after(wrap);

    var slider = document.getElementById('amt-slider');
    slider.addEventListener('input', function () {
      amountInput.value = slider.value;
      updateCalculator();
    });
    amountInput.addEventListener('input', function () {
      var v = parseFloat(amountInput.value);
      if (!isNaN(v)) slider.value = Math.min(Math.max(v, min), max);
      updateCalculator();
    });
  }

  /* --- Populate Plans --- */
  function populatePlans(typeId, preselectPlanId) {
    var filtered = (_PLANS_DATA || []).filter(function (p) {
      return String(p.loan_type_id) === String(typeId);
    });

    planSelect.innerHTML = '<option value="">— Select Plan —</option>';
    planHint.textContent = '';
    amountGroup.style.display = 'none';
    termGroup.style.display   = 'none';
    amountInput.value         = '';
    termSelect.innerHTML      = '<option value="">— Select Term —</option>';
    selectedPlan              = null;
    resetCalculator();
    var old = document.getElementById('amt-slider-wrap');
    if (old) old.remove();

    if (!filtered.length) {
      planGroup.style.display = 'none';
      return;
    }

    filtered.forEach(function (p) {
      var opt = document.createElement('option');
      opt.value       = p.id;
      opt.textContent = p.plan_name + ' — ' + p.interest_rate + '% p.a.' +
        ' (₱' + Number(p.min_amount).toLocaleString() +
        ' – ₱' + Number(p.max_amount).toLocaleString() + ')';
      planSelect.appendChild(opt);
    });
    planGroup.style.display = '';

    /* Auto-select a specific plan if provided (from ?plan= param) */
    if (preselectPlanId) {
      planSelect.value = preselectPlanId;
      onPlanChange();
    } else if (filtered.length === 1) {
      planSelect.value = filtered[0].id;
      onPlanChange();
      showToast('info', 'Plan Auto-Selected',
        filtered[0].plan_name + ' is the only available plan.', 3500);
    }

    if (window._updateSteps) window._updateSteps(2);
  }

  /* --- On Plan Change --- */
  function onPlanChange() {
    var planId = planSelect.value;
    if (!planId) {
      amountGroup.style.display = 'none';
      termGroup.style.display   = 'none';
      selectedPlan = null;
      resetCalculator();
      if (window._updateSteps) window._updateSteps(2);
      return;
    }

    selectedPlan = (_PLANS_DATA || []).find(function (p) {
      return String(p.id) === String(planId);
    });
    if (!selectedPlan) return;

    amountInput.min         = selectedPlan.min_amount;
    amountInput.max         = selectedPlan.max_amount;
    amountInput.placeholder = '₱' + Number(selectedPlan.min_amount).toLocaleString() +
                              ' – ₱' + Number(selectedPlan.max_amount).toLocaleString();
    amountHint.textContent  =
      'Min: ₱' + Number(selectedPlan.min_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 }) +
      '  |  Max: ₱' + Number(selectedPlan.max_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 });
    amountGroup.style.display = '';
    buildAmountSlider(selectedPlan.min_amount, selectedPlan.max_amount);

    /* Build term options */
    termSelect.innerHTML = '<option value="">— Select Term —</option>';
    var minT = parseInt(selectedPlan.term_months_min);
    var maxT = parseInt(selectedPlan.term_months_max);
    var steps = [];
    if (maxT <= 12) {
      for (var m = minT; m <= maxT; m++) steps.push(m);
    } else {
      for (var m = minT; m <= maxT; m += 6) {
        steps.push(m);
        if (m + 6 > maxT && m !== maxT) steps.push(maxT);
      }
    }
    steps = steps.filter(function (v, i, a) { return a.indexOf(v) === i; });
    steps.forEach(function (t) {
      var opt = document.createElement('option');
      opt.value       = t;
      opt.textContent = t + ' month' + (t !== 1 ? 's' : '') +
        (t >= 12 ? ' (' + (t / 12).toFixed(1).replace('.0', '') +
        ' yr' + (t >= 24 ? 's' : '') + ')' : '');
      termSelect.appendChild(opt);
    });
    termGroup.style.display = '';

    /* Collateral + fee hints */
    var hint = '';
    if (selectedPlan.collateral_required) {
      hint += '<span style="color:#f59e0b;">⚠ Collateral required: ' +
        (selectedPlan.collateral_notes || 'See officer for details') + '</span>';
    } else {
      hint += '<span style="color:#22c55e;">✔ No collateral required</span>';
    }
    if (parseFloat(selectedPlan.processing_fee) > 0) {
      hint += '<br><span style="color:#94a3b8;font-size:12px;">Processing fee: ' +
        selectedPlan.processing_fee + '% of principal</span>';
    }
    planHint.innerHTML = hint;

    updateCalculator();
    if (window._updateSteps) window._updateSteps(3);
    showToast('success', 'Plan Selected',
      selectedPlan.plan_name + ' — ' + selectedPlan.interest_rate + '% p.a.', 3000);
  }

  /* --- Upload Zone --- */
  (function () {
    var docInput = document.getElementById('documents');
    var docZone  = document.getElementById('doc-zone');
    if (!docInput || !docZone) return;
    docInput.addEventListener('change', function () {
      var files = docInput.files;
      if (!files || !files.length) return;
      var label = docZone.querySelector('p');
      if (label) label.textContent = files.length + ' file(s) selected';

      var oversized = [], invalid = [];
      var allowed   = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
      var maxSize   = 5 * 1024 * 1024;
      Array.from(files).forEach(function (f) {
        if (!allowed.includes(f.type)) invalid.push(f.name);
        if (f.size > maxSize)          oversized.push(f.name);
      });
      if (invalid.length)   showToast('danger',  'Invalid File Type', invalid.join(', ')   + ' — only JPG, PNG, PDF.', 5000);
      if (oversized.length) showToast('warning', 'File Too Large',    oversized.join(', ') + ' exceeds 5MB.',          5000);
      if (!invalid.length && !oversized.length)
        showToast('success', files.length + ' File(s) Ready', 'Documents attached.', 3000);
    });
  })();

  /* --- Amount blur validation --- */
  amountInput && amountInput.addEventListener('blur', function () {
    if (!selectedPlan || !amountInput.value) return;
    var v   = parseFloat(amountInput.value);
    var min = parseFloat(selectedPlan.min_amount);
    var max = parseFloat(selectedPlan.max_amount);
    if (v < min) showToast('warning', 'Amount Too Low',  'Minimum is ' + peso(min), 4000);
    else if (v > max) showToast('warning', 'Amount Too High', 'Maximum is ' + peso(max), 4000);
    else if (window._updateSteps) window._updateSteps(4);
  });

  termSelect && termSelect.addEventListener('change', function () {
    updateCalculator();
    if (this.value && amountInput.value && window._updateSteps) window._updateSteps(4);
  });

  /* --- Form Submit --- */
  applyForm.addEventListener('submit', function (e) {
    var typeId = loanTypeSelect.value;
    var planId = planSelect  ? planSelect.value  : '';
    var amount = parseFloat(amountInput ? amountInput.value : 0);
    var term   = termSelect  ? termSelect.value  : '';
    var errors = [];

    if (!typeId) errors.push('Please select a loan type.');
    if (!planId) errors.push('Please select a loan plan.');
    if (!amount || isNaN(amount) || amount <= 0) errors.push('Please enter a valid loan amount.');
    if (!term)   errors.push('Please select a loan term.');
    if (selectedPlan) {
      if (amount < selectedPlan.min_amount || amount > selectedPlan.max_amount) {
        errors.push('Amount must be between ' + peso(selectedPlan.min_amount) +
          ' and ' + peso(selectedPlan.max_amount) + '.');
      }
    }

    if (errors.length) {
      e.preventDefault();
      errors.forEach(function (msg, i) {
        setTimeout(function () {
          showToast('danger', 'Required Field', msg, 5000);
        }, i * 200);
      });
      return;
    }

    submitBtn.disabled      = true;
    submitBtn.innerHTML     = 'Submitting… <span style="opacity:.6">please wait</span>';
    submitBtn.style.opacity = '0.75';
    showToast('info', 'Submitting Application', 'Please wait…', 8000);
  });

  /* --- Listeners --- */
  loanTypeSelect.addEventListener('change', function () { populatePlans(this.value); });
  planSelect && planSelect.addEventListener('change', onPlanChange);

  /* ═══════════════════════════════════════
     AUTO-SELECT FROM ?plan= QUERY PARAM
     Runs once on page load if _SELECTED_PLAN_ID
     is set from the Flask template.
  ═══════════════════════════════════════ */
  (function () {
    if (typeof _SELECTED_PLAN_ID === 'undefined' || !_SELECTED_PLAN_ID) return;

    var targetPlan = (_PLANS_DATA || []).find(function (p) {
      return String(p.id) === String(_SELECTED_PLAN_ID);
    });
    if (!targetPlan) return;

    /* Step 1: set the loan type dropdown */
    loanTypeSelect.value = targetPlan.loan_type_id;

    /* Step 2: populate plans for that type, and pre-select the plan */
    populatePlans(targetPlan.loan_type_id, _SELECTED_PLAN_ID);

    showToast('success', 'Plan Pre-Selected',
      targetPlan.plan_name + ' has been selected for you.', 4000);
  })();

})();