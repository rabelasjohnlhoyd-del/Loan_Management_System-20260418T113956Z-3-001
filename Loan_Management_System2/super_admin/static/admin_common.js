/* ================================================================
   admin_common.js — Shared Logic for LMS Admin Pages
   Handles: Sidebar Dropdown, Mobile Menu, User Actions, Reports
   ================================================================ */

document.addEventListener('DOMContentLoaded', function() {
    'use strict';

    // 1. SIDEBAR USER DROPDOWN (Matches Dashboard Reference)
    const userToggle = document.getElementById('userDropdownToggle');
    const userDropdown = document.getElementById('userDropdown');

    if (userToggle && userDropdown) {
        userToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            this.classList.toggle('open');
            userDropdown.classList.toggle('open');
        });

        // Close dropdown when clicking anywhere else
        document.addEventListener('click', function(e) {
            if (!userToggle.contains(e.target) && !userDropdown.contains(e.target)) {
                userToggle.classList.remove('open');
                userDropdown.classList.remove('open');
            }
        });
    }

    // 2. MOBILE SIDEBAR TOGGLE
    const menuBtn = document.getElementById('menuBtn');
    const sidebar = document.getElementById('sidebar');

    if (menuBtn && sidebar) {
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('mobile-open');
        });
    }

    // 3. AUTO-DISMISS FLASH MESSAGES
    setTimeout(() => {
        document.querySelectorAll('.flash-msg').forEach(el => {
            el.style.transition = 'opacity 0.5s ease';
            el.style.opacity = '0';
            setTimeout(() => el.remove(), 500);
        });
    }, 5000);

    // 4. PASSWORD VISIBILITY TOGGLE (For Manage Users / Profile)
    window.togglePw = function(inputId, btn) {
        const input = document.getElementById(inputId);
        if (!input) return;
        if (input.type === 'password') {
            input.type = 'text';
            btn.textContent = 'Hide';
        } else {
            input.type = 'password';
            btn.textContent = 'Show';
        }
    };

    // 5. MANAGE USERS: ROLE INFO BOX
    const roleSelect = document.querySelector('select[name="role"]');
    const roleInfo = document.getElementById('roleInfo');
    const roleText = document.getElementById('roleInfoText');

    if (roleSelect && roleInfo) {
        const descriptions = {
            admin: 'Can approve loans, verify payments, and manage borrowers.',
            loan_officer: 'Can process applications and communicate with borrowers.',
            auditor: 'View-only access to reports and activity logs.',
            super_admin: 'Full system access including user management.'
        };
        roleSelect.addEventListener('change', function() {
            if (this.value && descriptions[this.value]) {
                roleText.textContent = descriptions[this.value];
                roleInfo.style.display = 'flex';
            } else {
                roleInfo.style.display = 'none';
            }
        });
    }

    // 6. REPORTS: NAVIGATION HELPERS
    window.goAmort = function() {
        const val = document.getElementById('loanIdInput')?.value.trim();
        if (!val) { alert('Please enter a Loan ID.'); return; }
        // Note: Replace '/0' logic if your URL structure differs
        window.location.href = `/admin/reports/amortization/${val}`;
    };

    window.goBorrowerHistory = function() {
        const val = document.getElementById('borrowerIdInput')?.value.trim();
        if (!val) { alert('Please enter a Borrower ID.'); return; }
        window.location.href = `/admin/reports/borrower-history/${val}`;
    };
});