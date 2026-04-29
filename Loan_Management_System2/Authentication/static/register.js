document.addEventListener('DOMContentLoaded', () => {
    const steps = document.querySelectorAll('.step-content');
    const indicators = document.querySelectorAll('.step');
    const nextBtns = document.querySelectorAll('.btn-next');
    const prevBtns = document.querySelectorAll('.btn-prev');
    const regForm = document.getElementById('regForm');
    // --- BAGONG FRESH START LOGIC ---
// Ito ay hindi magbubura kung REFRESH lang ang ginawa ng user.
const isRefresh = performance.navigation.type === 1; 

if (typeof backendStep !== 'undefined' && backendStep === 0 && !isRefresh) {
    sessionStorage.removeItem('registration_draft');
    sessionStorage.removeItem('active_step');
    console.log("Session cleared because of new entry (not refresh).");
}

    let currentStep = (typeof backendStep !== 'undefined' && backendStep !== null) 
                      ? parseInt(backendStep) 
                      : (parseInt(sessionStorage.getItem('active_step')) || 0);

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

    async function loadFormData() {
        const saved = sessionStorage.getItem('registration_draft');
        if (!saved) {
            goToStep(currentStep);
            return;
        }
        const data = JSON.parse(saved);
        for (const key of Object.keys(data)) {
            const el = document.getElementById(key) || document.querySelector(`[name="${key}"]`);
            if (el) {
                if (el.type === 'checkbox') el.checked = data[key];
                else el.value = data[key];
                if (el.tagName === 'SELECT') {
                    el.dispatchEvent(new Event('change'));
                    if (key.includes('province') || key === 'employment_type' || key.includes('country')) {
                        await new Promise(r => setTimeout(r, 600)); 
                    }
                } else {
                    el.dispatchEvent(new Event('input'));
                }
            }
        }
        sync(); 
        goToStep(currentStep); 
    }

    document.addEventListener('input', (e) => {
        if (e.target.matches('input, select, textarea')) {
            saveFormData();
            sync(); 
        }
    });

    // --- 3. UPDATED STEP 1 VALIDATION (STRICT MODE) ---
    const inputSequence = ['f_name', 'm_name', 'l_name', 'email_input', 'contact_input'];
    
    inputSequence.forEach((id, index) => {
        const input = document.getElementById(id);
        if (input && index > 0) input.disabled = true;
        // Enforce 50 char limit sa UI
        if (input && ['f_name', 'm_name', 'l_name'].includes(id)) input.maxLength = 50;
    });

    function updateSequence() {
        for (let i = 0; i < inputSequence.length - 1; i++) {
            const current = document.getElementById(inputSequence[i]);
            const next = document.getElementById(inputSequence[i+1]);
            const isNoMiddle = document.getElementById('no_middle')?.checked;
            if (current && (current.classList.contains('is-valid') || (current.id === 'm_name' && isNoMiddle))) {
                if (next) next.disabled = false;
            } else if (next) {
                next.disabled = true;
            }
        }
    }

    inputSequence.forEach((id) => {
        const input = document.getElementById(id);
        if (!input) return;

        input.addEventListener('input', (e) => {
            let val = e.target.value;

            // NAME VALIDATION (First, Middle, Last)
            if (['f_name', 'l_name', 'm_name'].includes(id)) {
                // Bawal ang duldok, numbers, at special characters. Letters at spaces lang.
                val = val.replace(/[^a-zA-Z\s]/g, ''); 
                
                // Proper Title Case
                if (val.length > 0) {
                    val = val.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                }
                
                // Limit to 50 chars
                if (val.length > 50) val = val.substring(0, 50);
                e.target.value = val;

                const isRepeating = /(.)\1{3,}/.test(val.replace(/\s/g, '').toLowerCase()); // Bawal 4 na sunod-sunod
                const hasVowel = /[aeiouAEIOU]/.test(val);

                if (id === 'f_name' || id === 'l_name') {
                    if (val.trim().length < 5) showError(input, "Minimum 5 characters required.");
                    else if (isRepeating) showError(input, "Too many repetitive characters.");
                    else if (!hasVowel && val.length > 5) showError(input, "Invalid name (no vowels).");
                    else showValid(input);
                } else if (id === 'm_name') {
                    // Middle name: No minimum length, but follows character rules
                    if (isRepeating) showError(input, "Repetitive characters detected.");
                    else showValid(input);
                }
            }

            // EMAIL VALIDATION
            if (id === 'email_input') {
    val = val.toLowerCase().trim();
    e.target.value = val;

    
    const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.com$/;
    
    if (!emailRegex.test(val)) {
        showError(input, "Only .com email addresses are allowed.");
    } else {
        showValid(input);
    }
}

           
            if (id === 'contact_input') {
                const isRepeatDigits = /(.)\1{3,}/.test(val); 
                if (!/^09\d{9}$/.test(val)) {
                    showError(input, "Must be 09XXXXXXXXX (11 digits).");
                } else if (isRepeatDigits) {
                    showError(input, "Invalid: Too many repeating digits.");
                } else {
                    showValid(input);
                }
            }
        });
    });

    const workData = {
        "Government": { roles: ["Permanent", "Contractual", "JO"], employers: ["National Agency", "LGU"], nature: ["Public Admin", "Health", "Education"] },
        "Private": { roles: ["Staff", "Supervisor", "Manager"], employers: ["BPO", "Banking", "Retail"], nature: ["IT", "Finance", "Sales"] },
        "Self-Employed": { roles: ["Business Owner", "Freelancer"], employers: ["N/A"], nature: ["Retail", "Service"] }
    };

    const empType = document.getElementById('employment_type');
    if (empType) {
        empType.addEventListener('change', function() {
            const data = workData[this.value];
            if (data) {
                populateSelect('job_role', data.roles, "Select Role");
                populateSelect('employer_business', data.employers, "Select Employer");
                populateSelect('nature_of_work', data.nature, "Select Nature");
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
                window.scrollTo(0, 0);
            }
        });
    });

    prevBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            currentStep--;
            saveFormData();
            goToStep(currentStep);
            window.scrollTo(0, 0);
        });
    });

    function validateStep(index) {
        const currentStepEl = steps[index];
        const inputs = currentStepEl.querySelectorAll('input[required], select[required]');
        let isValid = true;
        inputs.forEach(input => {
            if (input.disabled) return;
            if (input.id === 'password' && input.value.length < 8) {
                showError(input, "Password must be at least 8 characters.");
                isValid = false;
            } else if (!input.value || input.classList.contains('is-invalid')) {
                showError(input, "This field is required and must be valid.");
                isValid = false;
            } else {
                showValid(input);
            }
        });
        return isValid;
    }

    async function init() {
        try {
            const res = await fetch('https://restcountries.com/v3.1/all?fields=name');
            const data = await res.json();
            const names = data.map(c => c.name.common).sort();
            let opts = '<option value="" disabled selected>Select</option>';
            names.forEach(n => opts += `<option value="${n}">${n}</option>`);
            if(document.getElementById('nationality_api')) document.getElementById('nationality_api').innerHTML = opts;
            if(document.getElementById('birth_country_api')) document.getElementById('birth_country_api').innerHTML = opts;
        } catch(e) {}

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
            data.sort((a,b) => a.name.localeCompare(b.name)).forEach(p => {
                el.innerHTML += `<option value="${p.name}" data-code="${p.code}">${p.name}</option>`;
            });
        } catch(e) {}
    }

    function bindPSGC(triggerId, targetId, next) {
        const t = document.getElementById(triggerId);
        const target = document.getElementById(targetId);
        if (!t || !target) return;
        t.addEventListener('change', async function() {
            const selectedOpt = this.options[this.selectedIndex];
            if (!selectedOpt || !selectedOpt.dataset.code) return;
            const code = selectedOpt.dataset.code;
            target.disabled = false; target.innerHTML = '<option>Loading...</option>';
            const path = next ? `provinces/${code}/cities-municipalities/` : `cities-municipalities/${code}/barangays/`;
            const res = await fetch(`https://psgc.gitlab.io/api/${path}`);
            const data = await res.json();
            target.innerHTML = '<option value="" disabled selected>Select</option>';
            data.sort((a,b) => a.name.localeCompare(b.name)).forEach(i => {
                target.innerHTML += `<option value="${i.name}" data-code="${i.code}">${i.name}</option>`;
            });
            const saved = JSON.parse(sessionStorage.getItem('registration_draft') || '{}');
            if (saved[targetId]) target.value = saved[targetId];
        });
    }

    function sync() {
        const fn = document.getElementById('f_name')?.value || "";
        const ln = document.getElementById('l_name')?.value || "";
        const email = document.getElementById('email_input')?.value || "";
        const contact = document.getElementById('contact_input')?.value || "";
        
        const fullName = document.getElementById('auto_full_name');
        if (fullName) fullName.value = `${fn} ${ln}`.trim();

        const revEmail = document.getElementById('review_email');
        if (revEmail) revEmail.value = email;

        const revContact = document.getElementById('review_contact');
        if (revContact) revContact.value = contact;
    }

    init();

    regForm.addEventListener('submit', (e) => {
        if (regForm.checkValidity()) {
            const submitBtn = regForm.querySelector('button[type="submit"]');
            submitBtn.classList.add('btn-loading');
        }
    });

    document.getElementById('no_middle')?.addEventListener('change', function() {
        const mName = document.getElementById('m_name');
        mName.disabled = this.checked;
        if (this.checked) {
            mName.value = "";
            showValid(mName);
        } else {
            mName.classList.remove('is-valid');
            updateSequence();
        }
        saveFormData();
    });
});