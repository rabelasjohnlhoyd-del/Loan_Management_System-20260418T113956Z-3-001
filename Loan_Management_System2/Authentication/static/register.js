document.addEventListener('DOMContentLoaded', () => {
    const steps = document.querySelectorAll('.step-content');
    const indicators = document.querySelectorAll('.step');
    const nextBtns = document.querySelectorAll('.btn-next');
    const prevBtns = document.querySelectorAll('.btn-prev');
    const regForm = document.getElementById('regForm');
    let currentStep = 0;

    // --- 1. DATA MAPPING PARA SA STEP 3 ---
    const workData = {
        "Government": {
            roles: ["Permanent Employee", "Contractual / JO", "Elective Official", "Uniformed Personnel (AFP/PNP)"],
            employers: ["National Government Agency", "Local Government Unit (LGU)", "Government Owned Corp (GOCC)", "Public School/University"],
            nature: ["Public Administration", "Education", "Healthcare", "Security & Defense", "Social Services"]
        },
        "Private": {
            roles: ["Staff / Associate", "Supervisor", "Manager", "Executive", "Software Engineer", "Admin Assistant"],
            employers: ["BPO / Shared Services", "Banking / Finance", "Retail / Malls", "Manufacturing", "Tech Company", "Construction"],
            nature: ["Customer Service", "IT / Technology", "Accounting / Finance", "Sales & Marketing", "Human Resources"]
        },
        "Self-Employed": {
            roles: ["Business Owner", "Freelancer / Virtual Assistant", "Professional (Doctor/Lawyer)", "Sole Proprietor"],
            employers: ["Home-based Business", "Small/Medium Enterprise (SME)", "Professional Practice", "E-commerce"],
            nature: ["Wholesale / Retail", "Professional Services", "Consultancy", "Freelancing / Creative Arts"]
        },
        "OFW": {
            roles: ["Seafarer", "Domestic Worker", "Engineer / Technical", "Healthcare Worker (Nurse)", "Hospitality Service"],
            employers: ["Foreign Agency", "Direct Hire (Foreign Co.)", "Manning Agency", "International NGO"],
            nature: ["Maritime / Shipping", "Construction / Maintenance", "Domestic Service", "Professional Work Overseas"]
        }
    };

    // --- 2. APIs (Countries & Nationalities) ---
    async function initAPIs() {
        try {
            const res = await fetch('https://restcountries.com/v3.1/all?fields=name');
            const data = await res.json();
            const names = data.map(c => c.name.common).sort();
            let opts = '<option value="" disabled selected>Select Country</option>';
            names.forEach(n => opts += `<option value="${n}">${n}</option>`);
            
            document.getElementById('nationality_api').innerHTML = opts;
            document.getElementById('birth_country_api').innerHTML = opts;
            
            loadFormData(); 
        } catch (e) { console.log("API Error", e); }
    }
    initAPIs();

    // --- 3. SECURITY VALIDATION LOGIC (FINTECH GRADE) ---
    function validateStep(stepIndex) {
        const currentStepEl = steps[stepIndex];
        const inputs = currentStepEl.querySelectorAll('input[required], select[required]');
        
        // Check standard HTML5 validation first
        for (let input of inputs) {
            if (!input.checkValidity()) {
                input.reportValidity();
                return false;
            }
        }

        // --- STEP 1 SECURITY CHECKS ---
        if (stepIndex === 0) {
            const phone = document.getElementById('contact_input').value;
            const dob = document.getElementById('dob').value;

            // 1. Phone Format (09XXXXXXXXX)
            if (!/^09\d{9}$/.test(phone)) {
                alert("Invalid Phone Number. Must be 11 digits and start with 09.");
                return false;
            }

            // 2. Age Check (Must be 18+)
            const birthDate = new Date(dob);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) { age--; }

            if (age < 18) {
                alert("You must be at least 18 years old to create an account.");
                return false;
            }
        }

        // --- STEP 4 SECURITY CHECKS ---
        if (stepIndex === 3) {
            const pass = document.getElementsByName('password')[0].value;
            const confirm = document.getElementsByName('confirm_password')[0].value;
            const terms = document.getElementsByName('terms')[0].checked;

            if (pass.length < 8) {
                alert("Password must be at least 8 characters long.");
                return false;
            }
            if (pass !== confirm) {
                alert("Passwords do not match.");
                return false;
            }
            if (!terms) {
                alert("You must agree to the Terms & Conditions.");
                return false;
            }
        }

        return true;
    }

    // --- 4. DYNAMIC STEP 3 LOGIC ---
    const empTypeSelect = document.getElementById('employment_type');
    const roleSelect = document.getElementById('job_role');
    const employerSelect = document.getElementById('employer_business');
    const natureSelect = document.getElementById('nature_of_work');

    empTypeSelect.addEventListener('change', function() {
        const data = workData[this.value];
        if (data) {
            populateSelect(roleSelect, data.roles, "Select Role");
            populateSelect(employerSelect, data.employers, "Select Employer Type");
            populateSelect(natureSelect, data.nature, "Select Nature of Work");
            roleSelect.disabled = false;
            employerSelect.disabled = false;
            natureSelect.disabled = false;
        }
    });

    function populateSelect(el, list, placeholder) {
        let opts = `<option value="" disabled selected>${placeholder}</option>`;
        list.forEach(item => opts += `<option value="${item}">${item}</option>`);
        el.innerHTML = opts;
    }

    // --- 5. PSGC LOCATION LOGIC ---
    // (Existing loadPSGC and bindPSGC logic maintained)
    async function loadPSGC(id) {
        const el = document.getElementById(id);
        if (el.options.length > 2) return;
        try {
            const res = await fetch('https://psgc.gitlab.io/api/provinces/');
            const data = await res.json();
            data.sort((a,b) => a.name.localeCompare(b.name)).forEach(p => {
                el.innerHTML += `<option value="${p.name}" data-code="${p.code}">${p.name}</option>`;
            });
        } catch(e) {}
    }
    loadPSGC('curr_province_api');

    function bindPSGC(triggerId, targetId, next = true) {
        const t = document.getElementById(triggerId);
        const target = document.getElementById(targetId);
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
        });
    }
    bindPSGC('curr_province_api', 'curr_city_api', true);
    bindPSGC('curr_city_api', 'curr_barangay_api', false);
    bindPSGC('birth_province_api', 'birth_city_api', true);

    // --- 6. NAVIGATION & SYNC ---
    function sync() {
        const fn = document.getElementById('f_name').value.trim();
        const mn = document.getElementById('no_middle').checked ? "" : document.getElementById('m_name').value.trim();
        const ln = document.getElementById('l_name').value.trim();
        const email = document.getElementById('email_input').value.trim();
        const contact = document.getElementById('contact_input').value.trim();

        // Important: Combine names for AI verification reference
        const fullName = [fn, mn, ln].filter(Boolean).join(' ');
        document.getElementById('auto_full_name').value = fullName;
        document.getElementById('review_email').value = email;
        document.getElementById('review_contact').value = contact;
    }

    nextBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (validateStep(currentStep)) { // 🛡️ Validate before moving
                sync();
                saveFormData();
                steps[currentStep].classList.remove('active');
                currentStep++;
                steps[currentStep].classList.add('active');
                indicators.forEach((s, i) => s.classList.toggle('step--active', i <= currentStep));
                window.scrollTo(0, 0);
            }
        });
    });

    prevBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            steps[currentStep].classList.remove('active');
            currentStep--;
            steps[currentStep].classList.add('active');
            indicators.forEach((s, i) => s.classList.toggle('step--active', i <= currentStep));
            window.scrollTo(0, 0);
        });
    });

    // --- 7. FORM SUBMIT & STORAGE ---
    function saveFormData() {
        const formData = {};
        document.querySelectorAll('input:not([type="password"]), select').forEach(input => {
            const key = input.id || input.name;
            if (key) formData[key] = (input.type === 'checkbox') ? input.checked : input.value;
        });
        localStorage.setItem('registration_draft', JSON.stringify(formData));
    }

    function loadFormData() {
        const saved = localStorage.getItem('registration_draft');
        if (!saved) return;
        const data = JSON.parse(saved);
        Object.keys(data).forEach(key => {
            const el = document.getElementById(key) || document.querySelector(`[name="${key}"]`);
            if (el) {
                if (el.type === 'checkbox') el.checked = data[key];
                else el.value = data[key];
                el.dispatchEvent(new Event('change'));
            }
        });
    }

    regForm.addEventListener('submit', (e) => {
        if (!validateStep(currentStep)) {
            e.preventDefault();
        } else {
            localStorage.removeItem('registration_draft'); // Clear on success
        }
    });

    document.getElementById('no_middle').addEventListener('change', function() {
        const mName = document.getElementById('m_name');
        mName.disabled = this.checked;
        if (this.checked) mName.value = "";
    });
});