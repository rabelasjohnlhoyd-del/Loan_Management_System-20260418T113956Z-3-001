/* ================================================================
   create_user.js — Create Staff Account  |  Full Validation
   ================================================================ */

(function () {
  'use strict';

  /* ================================================================
     SIDEBAR TOGGLE
     ================================================================ */
  const burgerBtn      = document.getElementById('burgerBtn');
  const sidebar        = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const SIDEBAR_KEY    = 'hiraya_admin_sidebar_open';
  const isMobile       = () => window.innerWidth <= 768;

  function openSidebar()  { document.body.classList.add('sidebar-open'); if (isMobile()) sidebarOverlay.classList.add('active'); if (!isMobile()) localStorage.setItem(SIDEBAR_KEY, '1'); }
  function closeSidebar() { document.body.classList.remove('sidebar-open'); sidebarOverlay.classList.remove('active'); if (!isMobile()) localStorage.setItem(SIDEBAR_KEY, '0'); }
  function toggleSidebar(){ document.body.classList.contains('sidebar-open') ? closeSidebar() : openSidebar(); }

  if (!isMobile() && localStorage.getItem(SIDEBAR_KEY) !== '0') openSidebar();

  burgerBtn?.addEventListener('click', toggleSidebar);
  sidebarOverlay?.addEventListener('click', closeSidebar);
  sidebar?.querySelectorAll('.nav-item, .user-dropdown a').forEach(l => l.addEventListener('click', () => { if (isMobile()) closeSidebar(); }));
  window.addEventListener('resize', () => {
    if (!isMobile()) { sidebarOverlay.classList.remove('active'); if (localStorage.getItem(SIDEBAR_KEY) !== '0') openSidebar(); }
    else closeSidebar();
  });

  /* ================================================================
     USER DROPDOWN
     ================================================================ */
  const userToggle   = document.getElementById('userDropdownToggle');
  const userDropdown = document.getElementById('userDropdown');

  userToggle?.addEventListener('click', function (e) { e.stopPropagation(); userDropdown.classList.toggle('open'); userToggle.classList.toggle('open'); });
  document.addEventListener('click', (e) => {
    if (!userToggle?.contains(e.target) && !userDropdown?.contains(e.target)) { userDropdown?.classList.remove('open'); userToggle?.classList.remove('open'); }
  });

  /* ================================================================
     NOTIFICATIONS
     ================================================================ */
  const ICON_SVG = {
    activity: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#4A7A82" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
    warning:  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#d97706" width="16" height="16"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>',
    check:    '<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#16a34a" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>',
    cross:    '<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#dc2626" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>',
  };
  function getIconSvg(type) {
    if (type === 'payment_due')   return ICON_SVG.warning;
    if (type === 'loan_approved') return ICON_SVG.check;
    if (type === 'loan_rejected') return ICON_SVG.cross;
    return ICON_SVG.activity;
  }

  const notifBtn      = document.getElementById('notifBtn');
  const notifDropdown = document.getElementById('notifDropdown');
  const notifDot      = document.getElementById('notifDot');
  const notifList     = document.getElementById('notifList');
  const notifMarkAll  = document.getElementById('notifMarkAll');

  function fetchUnreadCount() {
    fetch('/admin/api/notifications/count').then(r => r.json()).then(data => {
      if (data.count > 0) notifDot?.classList.remove('hidden'); else notifDot?.classList.add('hidden');
    }).catch(() => {});
  }
  fetchUnreadCount();
  setInterval(fetchUnreadCount, 60000);

  function renderNotifItem(n) {
    const unread = !n.is_read;
    let iconBg = '#d9eef1';
    if (n.type === 'payment_due')   iconBg = '#fef3c7';
    if (n.type === 'loan_approved') iconBg = '#dcfce7';
    if (n.type === 'loan_rejected') iconBg = '#fee2e2';
    return `<div class="notif-item${unread ? ' unread' : ''}" data-id="${n.id}" data-link="${n.link || ''}" style="display:flex;align-items:flex-start;gap:12px;padding:12px 16px;border-bottom:1px solid var(--gray-200);cursor:pointer;position:relative;background:${unread ? 'var(--primary-light)' : 'var(--white)'};">
      <div style="width:36px;height:36px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:${iconBg};">${getIconSvg(n.type)}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:600;color:#1a2332;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(n.title)}</div>
        <div style="font-size:12px;color:#64748b;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${escHtml(n.message || '')}</div>
        <div style="font-size:11px;color:#94a3b8;margin-top:3px;">${escHtml(n.time_ago)}</div>
      </div>
      ${unread ? `<span style="position:absolute;top:50%;right:14px;transform:translateY(-50%);width:7px;height:7px;border-radius:50%;background:#2a8f9d;flex-shrink:0;"></span>` : ''}
    </div>`;
  }

  function groupLabel(text, borderTop) {
    return `<div style="display:flex;align-items:center;gap:8px;padding:8px 16px 4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#94a3b8;background:#f4f6f8;${borderTop ? 'border-top:1px solid #e5e9ed;' : ''}border-bottom:1px solid #e5e9ed;"><span>${text}</span></div>`;
  }

  function fetchNotifications() {
    if (!notifList) return;
    notifList.innerHTML = `<div style="display:flex;align-items:center;gap:10px;padding:20px 16px;font-size:13px;color:#94a3b8;">Loading notifications...</div>`;
    fetch('/admin/api/notifications').then(r => r.json()).then(data => {
      const items = data.notifications || [];
      if (!items.length) { notifList.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;padding:36px 16px;text-align:center;"><p style="font-size:13px;font-weight:600;color:#64748b;margin:0 0 4px;">You're all caught up!</p><small style="font-size:12px;color:#94a3b8;">No new notifications</small></div>`; return; }
      const pending = items.filter(n => n.type === 'payment_due');
      const activity = items.filter(n => n.type !== 'payment_due');
      let html = '';
      if (pending.length)  { html += groupLabel('Pending Applications', false); html += pending.map(renderNotifItem).join(''); }
      if (activity.length) { html += groupLabel('Recent Activity', pending.length > 0); html += activity.map(renderNotifItem).join(''); }
      notifList.innerHTML = html;
      notifList.querySelectorAll('[data-id]').forEach(el => {
        el.addEventListener('click', function () {
          const id = this.dataset.id; const link = this.dataset.link;
          if (this.classList.contains('unread')) { fetch(`/admin/api/notifications/${id}/read`, { method: 'POST' }).catch(() => {}); this.classList.remove('unread'); this.style.background = '#ffffff'; fetchUnreadCount(); }
          if (link && link !== 'null' && link !== '') { notifDropdown.classList.remove('open'); window.location.href = link; }
        });
      });
    }).catch(() => { notifList.innerHTML = '<div style="padding:20px 16px;text-align:center;color:#94a3b8;font-size:13px;">Could not load notifications.</div>'; });
  }

  notifBtn?.addEventListener('click', function (e) { e.stopPropagation(); const opening = !notifDropdown.classList.contains('open'); notifDropdown.classList.toggle('open'); if (opening) fetchNotifications(); });
  document.addEventListener('click', (e) => { if (!document.getElementById('notifWrap')?.contains(e.target)) notifDropdown?.classList.remove('open'); });
  notifMarkAll?.addEventListener('click', () => { fetch('/admin/api/notifications/read-all', { method: 'POST' }).then(() => { notifDot?.classList.add('hidden'); fetchNotifications(); }).catch(() => {}); });

  function escHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ================================================================
     PASSWORD TOGGLE
     ================================================================ */
  window.togglePw = function (id, btn) {
    const input = document.getElementById(id);
    input.type = input.type === 'password' ? 'text' : 'password';
    btn.textContent = input.type === 'password' ? 'Show' : 'Hide';
  };

  /* ================================================================
     ROLE DESCRIPTION HELPER
     ================================================================ */
  const roleDesc = {
    admin:        'Full administrative access: manage loans, payments, and borrowers.',
    loan_officer: 'Operations access: process applications and communicate with borrowers.',
    auditor:      'Read-only access: view reports, loans, and activity logs only.',
    super_admin:  'Owner access: all features plus system settings and user management.'
  };

  document.querySelector('select[name="role"]')?.addEventListener('change', function () {
    const box  = document.getElementById('roleInfo');
    const text = document.getElementById('roleInfoText');
    if (this.value && roleDesc[this.value]) { text.textContent = roleDesc[this.value]; box.style.display = 'flex'; }
    else box.style.display = 'none';
  });

  /* ================================================================
     ACTIVE NAV HIGHLIGHT
     ================================================================ */
  const path = window.location.pathname;
  document.querySelectorAll('.nav-item').forEach(el => {
    const href = el.getAttribute('href');
    if (href && href !== '#' && path.startsWith(href)) el.classList.add('active');
  });


  /* ================================================================
     ██╗   ██╗ █████╗ ██╗     ██╗██████╗  █████╗ ████████╗██╗ ██████╗ ███╗   ██╗
     ██║   ██║██╔══██╗██║     ██║██╔══██╗██╔══██╗╚══██╔══╝██║██╔═══██╗████╗  ██║
     ██║   ██║███████║██║     ██║██║  ██║███████║   ██║   ██║██║   ██║██╔██╗ ██║
     ╚██╗ ██╔╝██╔══██║██║     ██║██║  ██║██╔══██║   ██║   ██║██║   ██║██║╚██╗██║
      ╚████╔╝ ██║  ██║███████╗██║██████╔╝██║  ██║   ██║   ██║╚██████╔╝██║ ╚████║
       ╚═══╝  ╚═╝  ╚═╝╚══════╝╚═╝╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝ ╚═════╝ ╚═╝  ╚═══╝
     ================================================================ */

  /* ── DOM refs ── */
  const form       = document.getElementById('createUserForm');
  const submitBtn  = document.getElementById('submitBtn');
  const submitNote = document.getElementById('submitNote');

  const fields = {
    full_name:      document.getElementById('full_name'),
    email:          document.getElementById('email'),
    contact_number: document.getElementById('contact_number'),
    role:           document.getElementById('role'),
    pw:             document.getElementById('pw'),
    pw2:            document.getElementById('pw2'),
  };

  /* ── Validation state per field ── */
  const state = {
    full_name:      false,
    email:          false,
    contact_number: true,  // optional — starts as valid (empty = OK)
    role:           false,
    pw:             false,
    pw2:            false,
  };

  /* ── Async check flags ── */
  let emailCheckTimer   = null;
  let contactCheckTimer = null;
  let emailChecking     = false;
  let contactChecking   = false;

  /* ── Helpers ── */
  function setMsg(id, text, type) {
    const el = document.getElementById('msg-' + id);
    if (!el) return;
    el.textContent = text;
    el.className   = 'field-msg ' + (type || '');
  }

  function markValid(fieldName) {
    fields[fieldName]?.classList.remove('is-invalid');
    fields[fieldName]?.classList.add('is-valid');
    state[fieldName] = true;
    refreshSubmit();
  }

  function markInvalid(fieldName) {
    fields[fieldName]?.classList.remove('is-valid');
    fields[fieldName]?.classList.add('is-invalid');
    state[fieldName] = false;
    refreshSubmit();
  }

  function markNeutral(fieldName) {
    fields[fieldName]?.classList.remove('is-valid', 'is-invalid');
  }

  function showSpinner(id, show) {
    const el = document.getElementById('spinner-' + id);
    if (el) el.classList.toggle('visible', show);
  }

  function refreshSubmit() {
    const allOk   = Object.values(state).every(Boolean);
    const asyncOk = !emailChecking && !contactChecking;
    submitBtn.disabled = !(allOk && asyncOk);
    submitNote.textContent = allOk && asyncOk ? '' : 'Fix the errors above to continue.';
  }

  /* ──────────────────────────────────────────
     FULL NAME VALIDATION
  ────────────────────────────────────────── */
  function validateFullName() {
    const val = fields.full_name.value.trim();

    if (!val) {
      setMsg('full_name', '⚠ Full name is required.', 'error');
      markInvalid('full_name'); return;
    }
    if (val.length < 2) {
      setMsg('full_name', '⚠ Must be at least 2 characters.', 'error');
      markInvalid('full_name'); return;
    }
    if (val.length > 50) {
      setMsg('full_name', '⚠ Maximum 50 characters.', 'error');
      markInvalid('full_name'); return;
    }
    // Only letters (including accented/Filipino), spaces, hyphens, periods, apostrophes
    if (!/^[A-Za-zÀ-ÖØ-öø-ÿÑñ\s\-.']+$/.test(val)) {
      setMsg('full_name', '⚠ Only letters, spaces, hyphens, and apostrophes are allowed.', 'error');
      markInvalid('full_name'); return;
    }
    // No leading/trailing spaces (already trimmed) — but check double spaces
    if (/\s{2,}/.test(val)) {
      setMsg('full_name', '⚠ No multiple consecutive spaces.', 'error');
      markInvalid('full_name'); return;
    }
    // Gibberish detection: 5+ same consecutive characters
    if (/(.)\1{4,}/.test(val)) {
      setMsg('full_name', '⚠ Name contains too many repeated characters.', 'error');
      markInvalid('full_name'); return;
    }
    // Must have at least one space (first + last name)
    if (!val.includes(' ')) {
      setMsg('full_name', '⚠ Please enter first and last name.', 'error');
      markInvalid('full_name'); return;
    }
    // No part shorter than 1 char
    const parts = val.split(/\s+/).filter(Boolean);
    if (parts.some(p => p.replace(/['-]/g, '').length < 1)) {
      setMsg('full_name', '⚠ Each name part must be at least 1 character.', 'error');
      markInvalid('full_name'); return;
    }

    setMsg('full_name', '✓ Looks good!', 'ok');
    markValid('full_name');
  }

  fields.full_name.addEventListener('input',  validateFullName);
  fields.full_name.addEventListener('blur',   validateFullName);

  /* ──────────────────────────────────────────
     EMAIL VALIDATION + UNIQUENESS CHECK
  ────────────────────────────────────────── */
  function isValidEmailFormat(email) {
    // RFC-5321 compatible, strict
    return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/.test(email);
  }

  function validateEmailFormat() {
    const val = fields.email.value.trim();
    if (!val) {
      setMsg('email', '⚠ Email address is required.', 'error');
      markInvalid('email'); return false;
    }
    if (val.length > 50) {
      setMsg('email', '⚠ Email must not exceed 50 characters.', 'error');
      markInvalid('email'); return false;
    }
    if (!isValidEmailFormat(val)) {
      setMsg('email', '⚠ Please enter a valid email address.', 'error');
      markInvalid('email'); return false;
    }
    // Block disposable-looking domains
    const disposable = ['mailinator.com','guerrillamail.com','10minutemail.com','throwam.com','yopmail.com','trashmail.com','fakeinbox.com','maildrop.cc','sharklasers.com','dispostable.com'];
    const domain = val.split('@')[1]?.toLowerCase();
    if (disposable.includes(domain)) {
      setMsg('email', '⚠ Disposable email addresses are not allowed.', 'error');
      markInvalid('email'); return false;
    }
    return true;
  }

  async function checkEmailUniqueness(email) {
    try {
      const res  = await fetch(`/admin/api/check-email?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      return data.available !== false; // true = available
    } catch {
      return true; // if check fails, allow — backend will catch on submit
    }
  }

  function onEmailInput() {
    clearTimeout(emailCheckTimer);
    markNeutral('email');
    state.email = false;
    setMsg('email', '', '');
    refreshSubmit();

    const val = fields.email.value.trim();
    if (!val) return;

    if (!validateEmailFormat()) return;

    // Debounce uniqueness check
    emailCheckTimer = setTimeout(async () => {
      emailChecking = true;
      showSpinner('email', true);
      setMsg('email', 'Checking availability…', 'info');
      refreshSubmit();

      const available = await checkEmailUniqueness(val);
      emailChecking = false;
      showSpinner('email', false);

      if (!available) {
        setMsg('email', '⚠ This email is already registered.', 'error');
        markInvalid('email');
      } else {
        setMsg('email', '✓ Email is available.', 'ok');
        markValid('email');
      }
    }, 700);
  }

  function onEmailBlur() {
    if (!validateEmailFormat()) return;
    // If timer not fired yet, fire immediately
    clearTimeout(emailCheckTimer);
    const val = fields.email.value.trim();
    if (!val || !isValidEmailFormat(val)) return;

    emailChecking = true;
    showSpinner('email', true);
    setMsg('email', 'Checking availability…', 'info');
    refreshSubmit();

    checkEmailUniqueness(val).then(available => {
      emailChecking = false;
      showSpinner('email', false);
      if (!available) {
        setMsg('email', '⚠ This email is already registered.', 'error');
        markInvalid('email');
      } else {
        setMsg('email', '✓ Email is available.', 'ok');
        markValid('email');
      }
    });
  }

  fields.email.addEventListener('input', onEmailInput);
  fields.email.addEventListener('blur',  onEmailBlur);

  /* ──────────────────────────────────────────
     CONTACT NUMBER VALIDATION + UNIQUENESS
  ────────────────────────────────────────── */
  function normalizePHPhone(raw) {
    // Strip spaces, hyphens, parentheses
    let d = raw.replace(/[\s\-().]/g, '');
    if (d.startsWith('+63')) d = '0' + d.slice(3);
    if (d.startsWith('63') && d.length === 12) d = '0' + d.slice(2);
    return d;
  }

  function isValidPHPhone(raw) {
    if (!raw) return false;
    const d = normalizePHPhone(raw);
    // Must be exactly 11 digits starting with 09, and raw input max 12 chars
    // No 3+ consecutive same digits
    if (/(\d)\1{2,}/.test(normalizePHPhone(raw))) return false;
    return /^09\d{9}$/.test(d) && raw.replace(/[\s\-().]/g, '').length <= 11;
  }

  async function checkContactUniqueness(number) {
    try {
      const res  = await fetch(`/admin/api/check-contact?contact=${encodeURIComponent(number)}`);
      const data = await res.json();
      return data.available !== false;
    } catch {
      return true;
    }
  }

  function onContactInput() {
    clearTimeout(contactCheckTimer);
    markNeutral('contact_number');
    state.contact_number = true; // optional — reset to valid
    setMsg('contact_number', '', '');
    refreshSubmit();

    const val = fields.contact_number.value.trim();
    if (!val) {
      // empty is fine — optional field
      markNeutral('contact_number');
      state.contact_number = true;
      refreshSubmit();
      return;
    }

    if (!isValidPHPhone(val)) {
      setMsg('contact_number', '⚠ Enter a valid PH number (09XXXXXXXXX, 11 digits). No 3+ same consecutive digits.', 'error');
      markInvalid('contact_number');
      state.contact_number = false;
      refreshSubmit();
      return;
    }

    state.contact_number = false;
    contactCheckTimer = setTimeout(async () => {
      contactChecking = true;
      showSpinner('contact_number', true);
      setMsg('contact_number', 'Checking availability…', 'info');
      refreshSubmit();

      const normalized = normalizePHPhone(val);
      const available  = await checkContactUniqueness(normalized);
      contactChecking  = false;
      showSpinner('contact_number', false);

      if (!available) {
        setMsg('contact_number', '⚠ This contact number is already registered.', 'error');
        markInvalid('contact_number');
        state.contact_number = false;
      } else {
        setMsg('contact_number', '✓ Contact number is available.', 'ok');
        markValid('contact_number');
        state.contact_number = true;
      }
      refreshSubmit();
    }, 700);
  }

  function onContactBlur() {
    clearTimeout(contactCheckTimer);
    const val = fields.contact_number.value.trim();
    if (!val) { markNeutral('contact_number'); state.contact_number = true; refreshSubmit(); return; }
    if (!isValidPHPhone(val)) {
      setMsg('contact_number', '⚠ Enter a valid PH number (09XXXXXXXXX, 11 digits). No 3+ same consecutive digits.', 'error');
      markInvalid('contact_number');
      state.contact_number = false;
      refreshSubmit();
      return;
    }

    contactChecking = true;
    showSpinner('contact_number', true);
    setMsg('contact_number', 'Checking availability…', 'info');
    refreshSubmit();

    const normalized = normalizePHPhone(val);
    checkContactUniqueness(normalized).then(available => {
      contactChecking = false;
      showSpinner('contact_number', false);
      if (!available) {
        setMsg('contact_number', '⚠ This contact number is already registered.', 'error');
        markInvalid('contact_number');
        state.contact_number = false;
      } else {
        setMsg('contact_number', '✓ Contact number is available.', 'ok');
        markValid('contact_number');
        state.contact_number = true;
      }
      refreshSubmit();
    });
  }

  // Hard enforce 11-character limit (blocks paste overflow too)
  fields.contact_number.addEventListener('input', function () {
    if (this.value.length > 11) {
      this.value = this.value.slice(0, 11);
    }
    onContactInput();
  });
  fields.contact_number.addEventListener('blur',  onContactBlur);

  /* ──────────────────────────────────────────
     ROLE VALIDATION
  ────────────────────────────────────────── */
  const validRoles = ['admin', 'loan_officer', 'auditor', 'super_admin'];

  function validateRole() {
    const val = fields.role.value;
    if (!val || !validRoles.includes(val)) {
      setMsg('role', '⚠ Please select a valid role.', 'error');
      markInvalid('role');
    } else {
      setMsg('role', '✓ Role selected.', 'ok');
      markValid('role');
    }
  }

  fields.role.addEventListener('change', validateRole);
  fields.role.addEventListener('blur',   validateRole);

  /* ──────────────────────────────────────────
     PASSWORD VALIDATION + STRENGTH METER
  ────────────────────────────────────────── */
  const PW_RULES = [
    { id: 'chk-len',       test: v => v.length >= 8,                     label: 'At least 8 characters'      },
    { id: 'chk-upper',     test: v => /[A-Z]/.test(v),                   label: 'Uppercase letter (A–Z)'     },
    { id: 'chk-lower',     test: v => /[a-z]/.test(v),                   label: 'Lowercase letter (a–z)'     },
    { id: 'chk-digit',     test: v => /[0-9]/.test(v),                   label: 'Number (0–9)'               },
    { id: 'chk-special',   test: v => /[!@#$%^&*()\-_=+\[\]{};:'",.<>?/\\|`~]/.test(v), label: 'Special character' },
    { id: 'chk-no-repeat', test: v => !(/(.)\1{3,}/.test(v)),            label: 'No 4+ repeated chars'       },
  ];

  const STRENGTH_LEVELS = [
    { label: 'Too short',  color: '#e5e9ed', pct: 0   },
    { label: 'Very weak',  color: '#dc2626', pct: 20  },
    { label: 'Weak',       color: '#ea580c', pct: 40  },
    { label: 'Fair',       color: '#d97706', pct: 60  },
    { label: 'Strong',     color: '#16a34a', pct: 80  },
    { label: 'Very strong',color: '#0d9488', pct: 100 },
  ];

  function scorePassword(val) {
    if (!val) return 0;
    let score = 0;
    if (val.length >= 8)  score++;
    if (val.length >= 12) score++;
    if (/[A-Z]/.test(val))     score++;
    if (/[a-z]/.test(val))     score++;
    if (/[0-9]/.test(val))     score++;
    if (/[!@#$%^&*()\-_=+\[\]{};:'",.<>?/\\|`~]/.test(val)) score++;
    if (!(/(.)\1{3,}/.test(val))) score++;
    // cap at 5 levels
    return Math.min(5, score);
  }

  function validatePassword() {
    const val  = fields.pw.value;
    const wrap = document.getElementById('pw-strength-wrap');

    if (!val) {
      wrap.classList.remove('visible');
      setMsg('pw', '⚠ Password is required.', 'error');
      markInvalid('pw');
      // also revalidate confirm
      if (fields.pw2.value) validateConfirm();
      return;
    }

    wrap.classList.add('visible');

    // Update checklist
    let passed = 0;
    PW_RULES.forEach(rule => {
      const el = document.getElementById(rule.id);
      if (!el) return;
      const ok = rule.test(val);
      el.classList.toggle('pass', ok);
      if (ok) passed++;
    });

    // Strength bar
    const score  = scorePassword(val);
    const level  = STRENGTH_LEVELS[score];
    const fill   = document.getElementById('pw-strength-fill');
    const lbl    = document.getElementById('pw-strength-label');
    fill.style.width      = level.pct + '%';
    fill.style.background = level.color;
    lbl.textContent       = level.label;
    lbl.style.color       = level.color;

    // Additional rules
    if (val.length > 128) {
      setMsg('pw', '⚠ Password must not exceed 128 characters.', 'error');
      markInvalid('pw');
      return;
    }
    // Check all required rules pass (all 6)
    const allPass = PW_RULES.every(r => r.test(val));
    if (!allPass) {
      const remaining = PW_RULES.filter(r => !r.test(val)).length;
      setMsg('pw', `⚠ ${remaining} requirement${remaining > 1 ? 's' : ''} not met — see checklist below.`, 'error');
      markInvalid('pw');
    } else {
      setMsg('pw', `✓ ${level.label} password.`, 'ok');
      markValid('pw');
    }

    // Re-validate confirm if it has a value
    if (fields.pw2.value) validateConfirm();
  }

  fields.pw.addEventListener('input', validatePassword);
  fields.pw.addEventListener('blur',  validatePassword);

  /* ──────────────────────────────────────────
     CONFIRM PASSWORD VALIDATION
  ────────────────────────────────────────── */
  function validateConfirm() {
    const pw  = fields.pw.value;
    const pw2 = fields.pw2.value;

    if (!pw2) {
      setMsg('pw2', '⚠ Please confirm your password.', 'error');
      markInvalid('pw2'); return;
    }
    if (pw !== pw2) {
      setMsg('pw2', '⚠ Passwords do not match.', 'error');
      markInvalid('pw2'); return;
    }
    setMsg('pw2', '✓ Passwords match.', 'ok');
    markValid('pw2');
  }

  fields.pw2.addEventListener('input', validateConfirm);
  fields.pw2.addEventListener('blur',  validateConfirm);

  /* ──────────────────────────────────────────
     FORM SUBMIT — FINAL GATE
  ────────────────────────────────────────── */
  form.addEventListener('submit', function (e) {
    // Run all validations synchronously first
    validateFullName();
    validateEmailFormat();
    validateRole();
    validatePassword();
    validateConfirm();

    // Re-check optional contact
    const cVal = fields.contact_number.value.trim();
    if (cVal && !isValidPHPhone(cVal)) {
      setMsg('contact_number', '⚠ Enter a valid PH number.', 'error');
      markInvalid('contact_number');
      state.contact_number = false;
    }

    const allOk   = Object.values(state).every(Boolean);
    const asyncOk = !emailChecking && !contactChecking;

    if (!allOk || !asyncOk) {
      e.preventDefault();

      // Scroll to first invalid field
      const firstInvalid = form.querySelector('.is-invalid');
      if (firstInvalid) {
        firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstInvalid.focus();
      }

      submitNote.textContent = 'Please fix all errors before submitting.';
      return;
    }

    // Show loading state
    submitBtn.disabled      = true;
    submitBtn.textContent   = 'Creating…';
    submitNote.textContent  = '';
  });

  /* ──────────────────────────────────────────
     LIVE SUBMIT BUTTON TOOLTIP
  ────────────────────────────────────────── */
  submitBtn.addEventListener('mouseenter', () => {
    if (submitBtn.disabled) {
      const errors = Object.entries(state)
        .filter(([, v]) => !v)
        .map(([k]) => k.replace('_', ' '))
        .join(', ');
      submitNote.textContent = errors ? `Fix: ${errors}.` : 'Checking fields…';
    }
  });
  submitBtn.addEventListener('mouseleave', () => {
    if (!submitBtn.disabled) submitNote.textContent = '';
  });

})();