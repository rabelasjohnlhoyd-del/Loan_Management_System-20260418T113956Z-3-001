document.addEventListener('DOMContentLoaded', () => {
    const steps = document.querySelectorAll('.step-content');
    const indicators = document.querySelectorAll('.step');
    const nextBtns = document.querySelectorAll('.btn-next');
    const prevBtns = document.querySelectorAll('.btn-prev');
    const regForm = document.getElementById('regForm');

    // --- REFRESH DETECTION ---
    const sessionKey = 'hiraya_session_alive';
    const isRefresh = sessionStorage.getItem(sessionKey) === 'true';
    sessionStorage.setItem(sessionKey, 'true');

    if (!isRefresh && (typeof backendStep === 'undefined' || backendStep === null || backendStep === 0)) {
        
        if (!sessionStorage.getItem('active_step')) {
            sessionStorage.removeItem('registration_draft');
        }
    }

    
    let currentStep;
    if (isRefresh && sessionStorage.getItem('active_step') !== null) {
        
        currentStep = parseInt(sessionStorage.getItem('active_step'));
    } else if (typeof backendStep !== 'undefined' && backendStep !== null && backendStep !== 0) {
       
        currentStep = parseInt(backendStep);
    } else {
        // Fresh visit o fallback
        currentStep = parseInt(sessionStorage.getItem('active_step')) || 0;
    }

    // --- ERROR / VALID DISPLAY ---
    const showError = (input, message) => {
        input.classList.add('is-invalid');
        input.classList.remove('is-valid');
        let errorDisplay = input.parentElement.querySelector('.inline-error');
        if (!errorDisplay) {
            errorDisplay = document.createElement('div');
            errorDisplay.className = 'inline-error';
            errorDisplay.style.color = '#ef4444';
            errorDisplay.style.fontSize = '11px';
            errorDisplay.style.marginTop = '4px';
            input.parentElement.appendChild(errorDisplay);
        }
        errorDisplay.textContent = message;
        errorDisplay.style.display = 'block';
    };

    const showValid = (input) => {
        input.classList.remove('is-invalid');
        input.classList.add('is-valid');
        const errorDisplay = input.parentElement.querySelector('.inline-error');
        if (errorDisplay) errorDisplay.style.display = 'none';
        updateSequence();
    };

    const clearValidation = (input) => {
        input.classList.remove('is-invalid', 'is-valid');
        const errorDisplay = input.parentElement?.querySelector('.inline-error');
        if (errorDisplay) errorDisplay.style.display = 'none';
    };

    // --- SAVE FORM DATA ---
    function saveFormData() {
        const formData = {};
        document.querySelectorAll('input, select, textarea').forEach(input => {
            const key = input.id || input.name;
            if (key) {
                formData[key] = (input.type === 'checkbox') ? input.checked : input.value;
            }
        });
        sessionStorage.setItem('registration_draft', JSON.stringify(formData));
        sessionStorage.setItem('active_step', currentStep);
    }

    // --- REVALIDATE ON RESTORE (marks fields valid/invalid without showing errors aggressively) ---
    function revalidateField(el) {
        const id = el.id || el.name;
        const val = el.value;
        if (!val || val.trim() === '') return;

        if (el.tagName === 'SELECT') {
            if (val) showValid(el);
            return;
        }
        if (['f_name', 'l_name', 'm_name'].includes(id)) {
            const trimmed = val.trim().replace(/\s/g, '').replace(/-/g, '').toLowerCase();
            const isRepeating = /(.)\1{3,}/.test(trimmed);
            const hasVowel = /[aeiouAEIOU]/.test(val);
            const allSame = trimmed.length > 0 && new Set(trimmed).size === 1;
            if (id === 'f_name' || id === 'l_name') {
                if (val.trim().length >= 2 && !allSame && !isRepeating && (hasVowel || val.trim().length <= 3)) showValid(el);
            } else {
                if (!isRepeating && !(allSame && trimmed.length > 2)) showValid(el);
            }
            return;
        }
        if (id === 'email_input') {
    const atIndex = val.indexOf('@');
    const localP = atIndex >= 0 ? val.substring(0, atIndex) : val;
    const domainP = atIndex >= 0 ? val.substring(atIndex + 1) : '';
    const domainParts = domainP.split('.');
    const tld = domainParts[domainParts.length - 1];
    const strictEmailRegex = /^[a-z][a-z0-9.]{4,29}@[a-z0-9][a-z0-9\-]{3,62}\.[a-z]{2,10}$/;
    if (
        localP.length >= 6 &&
        strictEmailRegex.test(val) &&
        !isDisposableEmail(val) &&
        ALLOWED_DOMAINS.includes(domainP) &&
        !/\.{2,}/.test(val) &&
        domainParts.length >= 2 &&
        domainParts.length <= 4 &&
        !domainParts.some(p => p.length === 0) &&
        tld.length >= 2 &&
        tld.length <= 10 &&
        /^[a-z]+$/.test(tld)
    ) showValid(el);
    return;
}
        if (id === 'contact_input') {
            if (/^09\d{9}$/.test(val) && !hasSequentialDigits(val) && !/(.)\1{5,}/.test(val)) showValid(el);
            return;
        }
        if (id === 'zip_code') {
            if (/^\d{4}$/.test(val)) showValid(el);
            return;
        }
        if (id === 'house_street') {
            if (validateHouseStreet(val) === null) showValid(el);
            return;
        }
        if (id === 'dob') {
            const dob = new Date(val);
            const today = new Date();
            const age = today.getFullYear() - dob.getFullYear() - (
                today < new Date(today.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0
            );
            if (!isNaN(age) && age >= 18 && age <= 100) showValid(el);
            return;
        }
        if (el.name === 'password') {
            if (validatePassword(val) === null) showValid(el);
            return;
        }
    }

    // --- LOAD FORM DATA (handles refresh restore, PSGC cascade order) ---
    async function loadFormData() {
        const saved = sessionStorage.getItem('registration_draft');
        if (!saved) {
            goToStep(currentStep);
            return;
        }
        const data = JSON.parse(saved);

        // Step 1: Trigger cascading dropdowns in the correct order
        const cascadeKeys = ['birth_country_api', 'nationality_api', 'employment_type',
                             'curr_province_api', 'curr_city_api',
                             'birth_province_api', 'birth_city_api'];

        for (const key of cascadeKeys) {
            if (!data[key]) continue;
            const el = document.getElementById(key);
            if (!el) continue;
            el.value = data[key];
            el.dispatchEvent(new Event('change'));
            // PSGC province/city need extra time to fetch and populate options
            if (key.includes('province')) await new Promise(r => setTimeout(r, 1400));
            else if (key.includes('city') && !key.includes('birth_city')) await new Promise(r => setTimeout(r, 1400));
            else await new Promise(r => setTimeout(r, 300));

            if (el.value) showValid(el);

            // After province loads, pre-set the city value so bindPSGC restores it
            if (key === 'curr_province_api' && data['curr_city_api']) {
                const cityEl = document.getElementById('curr_city_api');
                if (cityEl) cityEl.value = data['curr_city_api'];
            }
            // After city loads, restore barangay
            if (key === 'curr_city_api') {
                await new Promise(r => setTimeout(r, 1400));
                const brgyEl = document.getElementById('curr_barangay_api');
                if (brgyEl && data['curr_barangay_api']) {
                    brgyEl.value = data['curr_barangay_api'];
                    if (brgyEl.value) showValid(brgyEl);
                }
            }
            if (key === 'birth_province_api' && data['birth_city_api']) {
                const bcityEl = document.getElementById('birth_city_api');
                if (bcityEl) bcityEl.value = data['birth_city_api'];
            }
        }

        // Step 2: Restore all other fields
        for (const key of Object.keys(data)) {
            if (cascadeKeys.includes(key)) continue;
            const el = document.getElementById(key) || document.querySelector(`[name="${key}"]`);
            if (!el) continue;
            if (el.type === 'checkbox') {
                el.checked = data[key];
            } else {
                el.value = data[key];
                revalidateField(el);
            }
        }

        // Restore no_middle checkbox effect
        const noMiddle = document.getElementById('no_middle');
        const mName = document.getElementById('m_name');
        if (noMiddle && mName && data['no_middle'] === true) {
            noMiddle.checked = true;
            mName.disabled = true;
            mName.value = '';
            showValid(mName);
        }

        // Restore source of funds "others" visibility
        const sof = document.getElementById('source_of_funds');
        const sofOthers = document.getElementById('source_others_input');
        if (sof && sofOthers && sof.value === 'Others') {
            sofOthers.style.display = 'block';
        }

        // Restore birth country toggle visibility
        const bc = document.getElementById('birth_country_api');
        if (bc && bc.value) {
            const isPH = bc.value === 'Philippines';
            const phWrap = document.getElementById('ph_birth_wrap');
            const intlWrap = document.getElementById('intl_birth_wrap');
            if (phWrap) phWrap.style.display = isPH ? 'block' : 'none';
            if (intlWrap) intlWrap.style.display = isPH ? 'none' : 'block';
        }

        updateSequence();
        sync();
        goToStep(currentStep);  
    }

    document.addEventListener('input', (e) => {
        if (e.target.matches('input, select, textarea')) {
            saveFormData();
            sync();
        }
    });
    document.addEventListener('change', (e) => {
        if (e.target.matches('input[type="checkbox"], select')) {
            saveFormData();
        }
    });

    const ALLOWED_DOMAINS = [
    'gmail.com', 'yahoo.com', 'yahoo.com.ph', 'outlook.com', 'hotmail.com',
    'live.com', 'icloud.com', 'me.com', 'protonmail.com', 'proton.me',
    'aol.com', 'zoho.com', 'mail.com', 'gmx.com', 'tutanota.com',
    'deped.gov.ph', 'doh.gov.ph', 'up.edu.ph', 'dlsu.edu.ph', 'ateneo.edu.ph',
    'ust.edu.ph', 'pup.edu.ph', 'mapua.edu.ph', 'tip.edu.ph', 'feu.edu.ph'
];

  
    const DISPOSABLE_DOMAINS = [
        'mailinator.com','guerrillamail.com','tempmail.com','throwam.com',
        'yopmail.com','sharklasers.com','guerrillamailblock.com','grr.la',
        'guerrillamail.info','spam4.me','trashmail.com','fakeinbox.com',
        'maildrop.cc','dispostable.com','10minutemail.com','mintemail.com',
        'tempr.email','discard.email','spamgourmet.com','mailnull.com'
    ];

    function isDisposableEmail(email) {
        const domain = email.split('@')[1]?.toLowerCase();
        return domain ? DISPOSABLE_DOMAINS.includes(domain) : false;
    }

    function hasSequentialDigits(val) {
        const digits = val.replace(/\D/g, '');
        for (let i = 0; i < digits.length - 3; i++) {
            const a = +digits[i], b = +digits[i+1], c = +digits[i+2], d = +digits[i+3];
            if (b-a===1 && c-b===1 && d-c===1) return true;
            if (a-b===1 && b-c===1 && c-d===1) return true;
        }
        return false;
    }

    function validatePassword(val) {
        if (val.length < 8) return "Password must be at least 8 characters.";
        if (!/[A-Z]/.test(val)) return "Must contain at least one uppercase letter.";
        if (!/[a-z]/.test(val)) return "Must contain at least one lowercase letter.";
        if (!/[0-9]/.test(val)) return "Must contain at least one number.";
        if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(val)) return "Must contain at least one special character (!@#$%...).";
        if (/(.)\1{3,}/.test(val)) return "Password has too many repeating characters.";
        return null;
    }

    // FIX 2: Address max length changed from 100 to 70
    function validateHouseStreet(val) {
        const trimmed = val.trim();
        if (trimmed.length < 5) return "Address must be at least 5 characters.";
        if (trimmed.length > 70) return "Address is too long (max 70 characters).";
        const hasNumber = /\d/.test(trimmed);
        const hasKeyword = /\b(lot|blk|block|unit|phase|purok|sitio|st|street|ave|avenue|road|rd|drive|dr|village|vill|subd|subdivision|brgy|barangay|bldg|building|floor|flr|compound|cpd|zone|no\.?)\b/i.test(trimmed);
        if (!hasNumber && !hasKeyword) return "Enter a valid address (e.g. house no., street, village).";
        const letters = trimmed.replace(/[\s\d\W]/g, '').toLowerCase();
        if (letters.length > 5) {
            const freq = {};
            for (const ch of letters) freq[ch] = (freq[ch] || 0) + 1;
            const maxFreq = Math.max(...Object.values(freq));
            if (maxFreq / letters.length > 0.55) return "Invalid address entered.";
        }
        if (/[^aeiou\s\d\W]{7,}/i.test(trimmed)) return "Invalid address entered.";
        return null;
    }

    // --- STEP 1 INPUT SEQUENCE ---
    const inputSequence = ['f_name', 'm_name', 'l_name', 'email_input', 'contact_input'];

    inputSequence.forEach((id, index) => {
        const input = document.getElementById(id);
        if (input && index > 0 && !sessionStorage.getItem('registration_draft')) {
            input.disabled = true;
        }
        if (input && ['f_name', 'm_name', 'l_name'].includes(id)) input.maxLength = 50;
    });

    // FIX 1: updateSequence now respects no_middle — hindi na ma-re-enable ang m_name kapag naka-check
    function updateSequence() {
        const isNoMiddle = document.getElementById('no_middle')?.checked;
        for (let i = 0; i < inputSequence.length - 1; i++) {
            const current = document.getElementById(inputSequence[i]);
            const next = document.getElementById(inputSequence[i + 1]);
            if (!current || !next) continue;

            // Never re-enable m_name if no_middle is checked
            if (next.id === 'm_name' && isNoMiddle) continue;

            const currentValid = current.classList.contains('is-valid') ||
                                 (current.id === 'm_name' && isNoMiddle);
            if (currentValid) {
                next.disabled = false;
            } else {
                if (!next.classList.contains('is-valid')) {
                    next.disabled = true;
                }
            }
        }
    }

    // --- NAME, EMAIL, CONTACT LIVE VALIDATION ---
    inputSequence.forEach((id) => {
        const input = document.getElementById(id);
        if (!input) return;

        input.addEventListener('input', (e) => {
            let val = e.target.value;

            if (['f_name', 'l_name', 'm_name'].includes(id)) {
                val = val.replace(/[^a-zA-Z\s\-]/g, '');
                val = val.replace(/\s{2,}/g, ' ');
                if (val.length > 0) {
                    val = val.split(' ').map(w => {
                        if (w.includes('-')) return w.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join('-');
                        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
                    }).join(' ');
                }
                if (val.length > 50) val = val.substring(0, 50);
                e.target.value = val;

                const trimmed = val.trim().replace(/\s/g, '').replace(/-/g, '').toLowerCase();
                const isRepeating = /(.)\1{3,}/.test(trimmed);
                const hasVowel = /[aeiouAEIOU]/.test(val);
                const allSame = trimmed.length > 0 && new Set(trimmed).size === 1;

                if (id === 'f_name' || id === 'l_name') {
                    if (val.trim().length < 2) showError(input, "Minimum 2 characters required.");
                    else if (allSame && trimmed.length > 2) showError(input, "Invalid name (all same letters).");
                    else if (isRepeating) showError(input, "Too many repetitive characters.");
                    else if (!hasVowel && val.trim().length > 3) showError(input, "Invalid name (no vowels detected).");
                    else showValid(input);
                } else {
                    if (val.trim().length === 0) {
                        if (!document.getElementById('no_middle')?.checked) showError(input, "Enter middle name or check the box below.");
                    } else if (isRepeating) showError(input, "Repetitive characters detected.");
                    else if (allSame && trimmed.length > 2) showError(input, "Invalid name (all same letters).");
                    else showValid(input);
                }
            }

            // FIX 3: Stricter email validation — hindi na mapapasok ang loydrabelas@gma.l.com at similar
            if (id === 'email_input') {
                val = val.toLowerCase().trim();
                e.target.value = val;

                const atIndex = val.indexOf('@');
                const localPart = atIndex >= 0 ? val.substring(0, atIndex) : val;
                const domainPart = atIndex >= 0 ? val.substring(atIndex + 1) : '';
                const domainParts = domainPart.split('.');
                const tld = domainParts[domainParts.length - 1];

                // Strict regex: local part 5-30 chars starting with letter, domain max 63 chars, TLD 2-10 letters only
                const strictEmailRegex = /^[a-z][a-z0-9.]{4,29}@[a-z0-9][a-z0-9\-]{0,62}\.[a-z]{2,10}$/;

                if (!val.includes('@'))
                    showError(input, "Enter a valid email address.");
                else if (localPart.length < 6)
                    showError(input, "Email username must be at least 6 characters.");
                else if (localPart.length > 30)
                    showError(input, "Email username must not exceed 30 characters.");
                else if (!/^[a-z]/.test(localPart))
                    showError(input, "Email username must start with a letter.");
                else if (!/^[a-z0-9.]+$/.test(localPart))
                    showError(input, "Only letters, numbers, and dots are allowed.");
                else if (/\.{2,}/.test(localPart))
                    showError(input, "Email cannot have consecutive dots.");
                else if (localPart.startsWith('.') || localPart.endsWith('.'))
                    showError(input, "Email cannot start or end with a dot.");
                else if (domainParts.length < 2 || domainParts.length > 4)
                    showError(input, "Invalid email domain.");
                else if (domainParts.some(p => p.length === 0))
                    showError(input, "Invalid email domain (empty part detected).");
                else if (tld.length < 2 || tld.length > 10 || !/^[a-z]+$/.test(tld))
                    showError(input, "Invalid domain extension (e.g. .com, .net, .ph).");
                else if (!domainPart.includes('.') || domainPart.startsWith('.') || domainPart.endsWith('.'))
                    showError(input, "Enter a valid domain (e.g. gmail.com).");
                else if (!/^[a-z0-9]/.test(domainPart))
                    showError(input, "Domain must start with a letter or number.");
                else if (!strictEmailRegex.test(val))
                    showError(input, "Enter a valid email address (e.g. juan@gmail.com).");
                else if (isDisposableEmail(val))
                    showError(input, "Disposable/temporary email addresses are not allowed.");
                else if (!ALLOWED_DOMAINS.includes(domainPart))
                    showError(input, "Please use a valid email provider (e.g. Gmail, Yahoo, Outlook).");
                else
                showValid(input);
            }

            if (id === 'contact_input') {
                val = val.replace(/\D/g, '').substring(0, 11);
                e.target.value = val;
                const isAllSame = val.length > 4 && new Set(val).size === 1;
                if (!/^09/.test(val)) showError(input, "Contact number must start with 09.");
                else if (val.length !== 11) showError(input, "Must be exactly 11 digits (09XXXXXXXXX).");
                else if (isAllSame) showError(input, "Invalid: All digits are the same.");
                else if (/(.)\1{5,}/.test(val)) showError(input, "Invalid: Too many repeating digits.");
                else if (hasSequentialDigits(val)) showError(input, "Invalid: Sequential digits detected.");
                else showValid(input);
            }
        });
    });

    // --- PASSWORD LIVE VALIDATION ---
    const passwordField = document.querySelector('input[name="password"]');
    const confirmPasswordField = document.querySelector('input[name="confirm_password"]');
    if (passwordField) {
        passwordField.addEventListener('input', () => {
            const err = validatePassword(passwordField.value);
            if (err) showError(passwordField, err);
            else showValid(passwordField);
            if (confirmPasswordField && confirmPasswordField.value.length > 0) {
                confirmPasswordField.dispatchEvent(new Event('input'));
            }
        });
    }
    if (confirmPasswordField) {
        confirmPasswordField.addEventListener('input', () => {
            if (confirmPasswordField.value !== passwordField?.value) showError(confirmPasswordField, "Passwords do not match.");
            else if (validatePassword(confirmPasswordField.value)) showError(confirmPasswordField, validatePassword(confirmPasswordField.value));
            else showValid(confirmPasswordField);
        });
    }

    // --- ZIP CODE ---
    const zipCode = document.getElementById('zip_code');
    if (zipCode) {
        zipCode.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '').substring(0, 4);
            if (e.target.value.length === 4) showValid(zipCode);
            else showError(zipCode, "Zip code must be exactly 4 digits.");
        });
    }

    // --- HOUSE / STREET ---
    const houseStreet = document.getElementById('house_street');
    if (houseStreet) {
        // FIX 2: Also enforce maxLength 70 via JS as a safeguard
        houseStreet.maxLength = 70;
        houseStreet.addEventListener('input', (e) => {
            const err = validateHouseStreet(e.target.value);
            if (err) showError(houseStreet, err);
            else showValid(houseStreet);
        });
    }

    // --- DOB ---
    const dobField = document.getElementById('dob');
    if (dobField) {
        dobField.addEventListener('change', () => {
            const dob = new Date(dobField.value);
            const today = new Date();
            const age = today.getFullYear() - dob.getFullYear() - (
                today < new Date(today.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0
            );
            if (isNaN(age) || age < 18) showError(dobField, "You must be at least 18 years old to register.");
            else if (age > 100) showError(dobField, "Please enter a valid date of birth.");
            else showValid(dobField);
        });
    }

    // --- WORK DATA ---
    const workData = {
        "Government":    { roles: ["Permanent", "Contractual", "Job Order (JO)", "Casual"], employers: ["National Government Agency", "Local Government Unit (LGU)", "GOCC"], nature: ["Public Administration", "Health Services", "Education", "Social Services", "Military / Police"] },
        "Private":       { roles: ["Rank-and-File / Staff", "Supervisor", "Manager", "Officer", "Director", "Executive"], employers: ["BPO / Call Center", "Banking & Finance", "Retail / Trade", "Manufacturing", "Real Estate", "Healthcare", "Technology"], nature: ["IT / Technology", "Finance & Accounting", "Sales & Marketing", "Operations", "Human Resources", "Legal / Compliance"] },
        "Self-Employed": { roles: ["Sole Business Owner", "Partner / Co-Owner", "Freelancer", "Independent Contractor"], employers: ["Sole Proprietorship", "Partnership", "Corporation"], nature: ["Retail / Trading", "Food & Beverage", "Professional Services", "Construction / Repairs", "Transportation", "Agriculture"] },
        "OFW":           { roles: ["Land-based Worker", "Sea-based Worker (Seafarer)", "Performing Artist"], employers: ["Foreign Company", "Ship / Vessel"], nature: ["Domestic / Household", "Professional / Technical", "Skilled Worker", "Maritime / Seafaring"] }
    };

    const empType = document.getElementById('employment_type');
    if (empType) {
        empType.addEventListener('change', function() {
            const data = workData[this.value];
            if (data) {
                populateSelect('job_role', data.roles, "Select Role");
                populateSelect('employer_business', data.employers, "Select Employer / Business Type");
                populateSelect('nature_of_work', data.nature, "Select Nature of Work");
                showValid(this);
            }
        });
    }

    function populateSelect(id, list, placeholder) {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = `<option value="" disabled selected>${placeholder}</option>`;
        list.forEach(item => el.innerHTML += `<option value="${item}">${item}</option>`);
        el.disabled = false;
    }

    // --- SOURCE OF FUNDS ---
    const sourceOfFunds = document.getElementById('source_of_funds');
    const sourceOthers = document.getElementById('source_others_input');
    if (sourceOfFunds && sourceOthers) {
        sourceOfFunds.addEventListener('change', function() {
            sourceOthers.style.display = this.value === 'Others' ? 'block' : 'none';
            if (this.value !== 'Others') sourceOthers.value = '';
            showValid(this);
        });
    }

    // --- BIRTH COUNTRY TOGGLE ---
    const birthCountry = document.getElementById('birth_country_api');
    if (birthCountry) {
        birthCountry.addEventListener('change', function() {
            const isPH = this.value === 'Philippines';
            const phWrap = document.getElementById('ph_birth_wrap');
            const intlWrap = document.getElementById('intl_birth_wrap');
            if (phWrap) phWrap.style.display = isPH ? 'block' : 'none';
            if (intlWrap) intlWrap.style.display = isPH ? 'none' : 'block';
            showValid(this);
        });
    }

    // --- STEP NAVIGATION ---
    function goToStep(index) {
        steps.forEach((s, i) => s.classList.toggle('active', i === index));
        indicators.forEach((s, i) => s.classList.toggle('step--active', i <= index));
        currentStep = index;
    }

    nextBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (validateStep(currentStep)) {
                currentStep++;
                saveFormData();
                goToStep(currentStep);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    });

    prevBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            currentStep--;
            saveFormData();
            goToStep(currentStep);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });


    document.addEventListener('change', (e) => {
    if (e.target.tagName === 'SELECT' && e.target.value && !e.target.disabled) {
        const specialSelects = ['employment_type', 'source_of_funds', 'birth_country_api', 'curr_province_api', 'curr_city_api', 'birth_province_api', 'birth_city_api', 'nationality_api'];
        if (!specialSelects.includes(e.target.id)) {
            showValid(e.target);
        } else {
            
            if (e.target.classList.contains('is-invalid')) {
                e.target.classList.remove('is-invalid');
                const errorDisplay = e.target.parentElement?.querySelector('.inline-error');
                if (errorDisplay) errorDisplay.style.display = 'none';
            }
        }
    }
});

    // --- STEP VALIDATION ---
    function validateStep(index) {
        const currentStepEl = steps[index];
        let isValid = true;
        const inputs = currentStepEl.querySelectorAll('input[required], select[required]');
        inputs.forEach(input => {
            if (input.disabled || input.readOnly) return;
            let parent = input.parentElement;
            while (parent && parent !== document.body) {
                if (parent.style && parent.style.display === 'none') return;
                parent = parent.parentElement;
            }
            if (input.type === 'checkbox') {
                if (!input.checked) { showError(input, "You must agree to continue."); isValid = false; }
                return;
            }
            if (!input.value || input.value.trim() === '') {
                showError(input, "This field is required.");
                isValid = false;
                return;
            }
            if (!input.classList.contains('is-valid') && !input.classList.contains('is-invalid')) {
                revalidateField(input);
            }
            if (input.classList.contains('is-invalid')) {
    isValid = false;
} else if (!input.classList.contains('is-valid')) {

    input.classList.remove('is-invalid');
    const errorDisplay = input.parentElement?.querySelector('.inline-error');
    if (errorDisplay) errorDisplay.style.display = 'none';
}
        });

        if (index === 3) {
            const pw = document.querySelector('input[name="password"]');
            const cpw = document.querySelector('input[name="confirm_password"]');
            if (pw && cpw) {
                const pwErr = validatePassword(pw.value);
                if (pwErr) { showError(pw, pwErr); isValid = false; }
                if (pw.value !== cpw.value) { showError(cpw, "Passwords do not match."); isValid = false; }
            }
        }
        return isValid;
    }

    // --- SYNC REVIEW FIELDS ---
    function sync() {
        const fn = document.getElementById('f_name')?.value || "";
        const mn = document.getElementById('m_name')?.value || "";
        const ln = document.getElementById('l_name')?.value || "";
        const parts = [fn, mn, ln].filter(Boolean);
        const fullName = document.getElementById('auto_full_name');
        if (fullName) fullName.value = parts.join(' ').trim();
        const revEmail = document.getElementById('review_email');
        if (revEmail) revEmail.value = document.getElementById('email_input')?.value || "";
        const revContact = document.getElementById('review_contact');
        if (revContact) revContact.value = document.getElementById('contact_input')?.value || "";
    }

    // --- INIT ---
    async function init() {
        try {
            const res = await fetch('https://restcountries.com/v3.1/all?fields=name');
            const data = await res.json();
            const names = data.map(c => c.name.common).sort();
            let opts = '<option value="" disabled selected>Select</option>';
            names.forEach(n => opts += `<option value="${n}">${n}</option>`);
            if (document.getElementById('nationality_api')) document.getElementById('nationality_api').innerHTML = opts;
            if (document.getElementById('birth_country_api')) document.getElementById('birth_country_api').innerHTML = opts;
        } catch (e) { console.warn('Could not load countries:', e); }

        await loadProvinces('curr_province_api');
        await loadProvinces('birth_province_api');
        bindPSGC('curr_province_api', 'curr_city_api', true);
        bindPSGC('curr_city_api', 'curr_barangay_api', false);
        bindPSGC('birth_province_api', 'birth_city_api', true);

        await loadFormData();
    }

    async function loadProvinces(id) {
        const el = document.getElementById(id);
        if (!el) return;
        try {
            const res = await fetch('https://psgc.gitlab.io/api/provinces/');
            const data = await res.json();
            data.sort((a, b) => a.name.localeCompare(b.name)).forEach(p => {
                el.innerHTML += `<option value="${p.name}" data-code="${p.code}">${p.name}</option>`;
            });
        } catch (e) { console.warn('Could not load provinces:', e); }
    }

    function bindPSGC(triggerId, targetId, isProvince) {
        const t = document.getElementById(triggerId);
        const target = document.getElementById(targetId);
        if (!t || !target) return;
        t.addEventListener('change', async function() {
            const selectedOpt = this.options[this.selectedIndex];
            if (!selectedOpt || !selectedOpt.dataset.code) return;
            const code = selectedOpt.dataset.code;
            target.disabled = false;
            target.innerHTML = '<option>Loading...</option>';
            const path = isProvince
                ? `provinces/${code}/cities-municipalities/`
                : `cities-municipalities/${code}/barangays/`;
            try {
                const res = await fetch(`https://psgc.gitlab.io/api/${path}`);
                const data = await res.json();
                target.innerHTML = '<option value="" disabled selected>Select</option>';
                data.sort((a, b) => a.name.localeCompare(b.name)).forEach(i => {
                    target.innerHTML += `<option value="${i.name}" data-code="${i.code}">${i.name}</option>`;
                });
                const saved = JSON.parse(sessionStorage.getItem('registration_draft') || '{}');
                if (saved[targetId]) {
                    target.value = saved[targetId];
                    if (target.value) showValid(target);
                }
            } catch (e) { console.warn(`Could not load data for ${targetId}:`, e); }
        });
    }

    // FIX 1: No middle name checkbox — correctly disables/enables m_name field
    document.getElementById('no_middle')?.addEventListener('change', function() {
        const mName = document.getElementById('m_name');
        if (this.checked) {
            mName.disabled = true;
            mName.value = '';
            mName.classList.remove('is-invalid');
            mName.classList.add('is-valid');
            const errorDisplay = mName.parentElement.querySelector('.inline-error');
            if (errorDisplay) errorDisplay.style.display = 'none';
        } else {
            mName.disabled = false;
            clearValidation(mName);
        }
        updateSequence();
        saveFormData();
    });

    // --- FORM SUBMIT ---
    regForm.addEventListener('submit', (e) => {
        if (!validateStep(currentStep)) {
            e.preventDefault();
            return;
        }
        if (regForm.checkValidity()) {
            const submitBtn = regForm.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.classList.add('btn-loading');
            sessionStorage.removeItem('registration_draft');
            sessionStorage.removeItem('active_step');
            sessionStorage.removeItem('hiraya_session_alive');
        }
    });

    init();
});