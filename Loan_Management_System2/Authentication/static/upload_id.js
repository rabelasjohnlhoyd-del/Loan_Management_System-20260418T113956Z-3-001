/* ============================================
   upload_id.js — Loan Management System
   Live camera selfie + ID file upload
   ============================================ */

const MAX_SIZE_MB = 5;
const MAX_BYTES   = MAX_SIZE_MB * 1024 * 1024;

// ── STATE MACHINE ──
let appState = 'idle'; // 'idle' | 'processing' | 'approved' | 'review' | 'rejected'

function setState(newState) {
  appState = newState;
  console.log('[upload_id] state →', newState);
}

// ── CAMERA STATE ──
let cameraStream     = null;
let capturedSelfieB64 = null; // base64 of captured selfie (jpeg)
let facingMode       = 'user'; // 'user' = front, 'environment' = back

// ══════════════════════════════════════════
// CAMERA MODAL
// ══════════════════════════════════════════

async function openCameraModal() {
  if (appState === 'processing') return;

  const modal = document.getElementById('camera-modal');
  const video = document.getElementById('camera-video');
  const errorEl = document.getElementById('camera-error');
  const captureBtn = document.getElementById('capture-btn');

  modal.style.display = 'flex';
  errorEl.style.display = 'none';
  video.style.display = 'block';
  captureBtn.disabled = false;

  document.body.style.overflow = 'hidden';

  await startCamera();
}

async function startCamera() {
  const video = document.getElementById('camera-video');
  const errorEl = document.getElementById('camera-error');
  const errorMsg = document.getElementById('camera-error-msg');

  // Stop any existing stream
  stopCamera();

  try {
    const constraints = {
      video: {
        facingMode: facingMode,
        width:  { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    };

    cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = cameraStream;
    video.style.display = 'block';
    errorEl.style.display = 'none';

  } catch (err) {
    console.error('[camera] Error:', err);
    video.style.display = 'none';
    errorEl.style.display = 'flex';

    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      errorMsg.textContent = 'Camera permission denied.';
    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      errorMsg.textContent = 'No camera found on this device.';
    } else if (err.name === 'NotReadableError') {
      errorMsg.textContent = 'Camera is already in use by another application.';
    } else {
      errorMsg.textContent = `Camera error: ${err.message}`;
    }
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
  const video = document.getElementById('camera-video');
  if (video) video.srcObject = null;
}

function closeCameraModal() {
  stopCamera();
  const modal = document.getElementById('camera-modal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';

  // Hide countdown if showing
  const countdown = document.getElementById('camera-countdown');
  if (countdown) countdown.style.display = 'none';
}

async function switchCamera() {
  facingMode = facingMode === 'user' ? 'environment' : 'user';
  await startCamera();
}

function capturePhoto() {
  const video    = document.getElementById('camera-video');
  const canvas   = document.getElementById('camera-canvas');
  const countdown = document.getElementById('camera-countdown');
  const captureBtn = document.getElementById('capture-btn');

  if (!cameraStream || !video.videoWidth) {
    alert('Camera is not ready. Please wait a moment.');
    return;
  }

  // Brief countdown: 3... 2... 1...
  captureBtn.disabled = true;
  countdown.style.display = 'flex';

  let count = 3;
  countdown.textContent = count;

  const interval = setInterval(() => {
    count--;
    if (count > 0) {
      countdown.textContent = count;
    } else {
      clearInterval(interval);
      countdown.style.display = 'none';
      takeSnapshot(video, canvas);
      captureBtn.disabled = false;
    }
  }, 700);
}

function takeSnapshot(video, canvas) {
  // Set canvas size to video dimensions
  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext('2d');

  // Mirror the image if using front camera (looks natural)
  if (facingMode === 'user') {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  // Reset transform
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // Get base64 jpeg
  capturedSelfieB64 = canvas.toDataURL('image/jpeg', 0.92).split(',')[1];

  // Show preview
  const previewImg   = document.getElementById('selfie-preview-img');
  const promptEl     = document.getElementById('selfie-prompt');
  const capturedEl   = document.getElementById('selfie-captured');
  const selfieZone   = document.getElementById('selfie-zone');

  previewImg.src = 'data:image/jpeg;base64,' + capturedSelfieB64;
  promptEl.style.display   = 'none';
  capturedEl.style.display = 'block';
  selfieZone.classList.add('has-file');

  // Store in hidden input
  document.getElementById('selfie_base64').value = capturedSelfieB64;

  // Convert base64 to File object and set it in the hidden file input
  base64ToFile(capturedSelfieB64, 'live_selfie.jpg', 'image/jpeg').then(file => {
    const dt = new DataTransfer();
    dt.items.add(file);
    document.getElementById('selfie').files = dt.files;
  });

  // Close modal
  closeCameraModal();

  // If state was rejected, reset to idle so user can re-validate
  if (appState === 'rejected') {
    resetToIdle();
  }

  clearError('selfie-error');
}

function base64ToFile(b64, filename, mimeType) {
  return fetch(`data:${mimeType};base64,${b64}`)
    .then(res => res.blob())
    .then(blob => new File([blob], filename, { type: mimeType }));
}


// ══════════════════════════════════════════
// FLASH MESSAGE AUTO-DISMISS
// ══════════════════════════════════════════

function initFlash() {
  document.querySelectorAll('.flash-msg').forEach((el, i) => {
    setTimeout(() => dismissFlash(el), 5000 + i * 400);
    const btn = el.querySelector('.f-close');
    if (btn) btn.addEventListener('click', () => dismissFlash(el));
  });
}

function dismissFlash(el) {
  el.style.transition = 'all 0.3s ease';
  el.style.opacity    = '0';
  el.style.transform  = 'translateX(16px)';
  setTimeout(() => el.remove(), 300);
}


// ══════════════════════════════════════════
// FIELD ERROR HELPERS
// ══════════════════════════════════════════

function showError(errorId, message) {
  const err = document.getElementById(errorId);
  if (err) { err.textContent = message; err.style.display = 'block'; }
}

function clearError(errorId) {
  const err = document.getElementById(errorId);
  if (err) { err.textContent = ''; err.style.display = 'none'; }
}


// ══════════════════════════════════════════
// ID FILE UPLOAD ZONE
// ══════════════════════════════════════════

function setupUploadZone(zoneId, inputId, previewId, errorId, allowedTypes) {
  const zone    = document.getElementById(zoneId);
  const input   = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  if (!zone || !input || !preview) return;

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('drag-over');
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file, input, zone, preview, errorId, allowedTypes);
  });

  input.addEventListener('change', () => {
    const file = input.files[0];
    if (file) handleFile(file, input, zone, preview, errorId, allowedTypes);
    resetToIdle();
  });
}

function handleFile(file, input, zone, preview, errorId, allowedTypes) {
  clearError(errorId);

  const ext = file.name.split('.').pop().toLowerCase();
  if (!allowedTypes.includes(ext)) {
    showError(errorId, `Invalid file type. Allowed: ${allowedTypes.join(', ').toUpperCase()}`);
    zone.classList.remove('has-file');
    return;
  }

  if (file.size > MAX_BYTES) {
    showError(errorId, `File too large. Maximum size is ${MAX_SIZE_MB}MB.`);
    zone.classList.remove('has-file');
    return;
  }

  zone.classList.add('has-file');
  preview.classList.add('visible');
  preview.querySelector('.preview-name').textContent = file.name;

  if (!input.files.length) {
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
  }
}


// ══════════════════════════════════════════
// RESET TO IDLE
// ══════════════════════════════════════════

function resetToIdle() {
  if (appState === 'processing') return;
  setState('idle');
  document.getElementById('verification_status').value = 'pending';

  const box = document.getElementById('validation-result');
  if (box) box.style.display = 'none';

  const btn = document.getElementById('submit-btn');
  if (btn) {
    btn.disabled  = false;
    btn.innerHTML = '<span class="btn-icon-complete"></span> VALIDATE &amp; COMPLETE REGISTRATION';
  }
}


// ══════════════════════════════════════════
// CLEAR FILES (after rejection)
// ══════════════════════════════════════════

function clearAllFiles() {
  // Clear ID file
  const idInput = document.getElementById('valid_id');
  if (idInput) idInput.value = '';
  const idZone = document.getElementById('id-zone');
  if (idZone) idZone.classList.remove('has-file');
  const idPreview = document.getElementById('id-preview');
  if (idPreview) idPreview.classList.remove('visible');

  // Clear selfie capture
  capturedSelfieB64 = null;
  document.getElementById('selfie_base64').value = '';
  const selfieInput = document.getElementById('selfie');
  if (selfieInput) selfieInput.value = '';

  const promptEl   = document.getElementById('selfie-prompt');
  const capturedEl = document.getElementById('selfie-captured');
  const selfieZone = document.getElementById('selfie-zone');

  if (promptEl)   promptEl.style.display   = 'block';
  if (capturedEl) capturedEl.style.display = 'none';
  if (selfieZone) selfieZone.classList.remove('has-file');
}


// ══════════════════════════════════════════
// VALIDATION RESULT BOX
// ══════════════════════════════════════════

function showValidationResult(type, title, message, details = []) {
  const box       = document.getElementById('validation-result');
  const iconEl    = document.getElementById('val-icon');
  const titleEl   = document.getElementById('val-title');
  const msgEl     = document.getElementById('val-message');
  const detailsEl = document.getElementById('val-details');

  box.className       = `validation-box val-${type}`;
  const icons         = { success: '✅', warning: '⚠️', error: '❌' };
  iconEl.textContent  = icons[type] || '🔍';
  titleEl.textContent = title;
  msgEl.textContent   = message;

  detailsEl.innerHTML = '';
  details.forEach(d => {
    const li = document.createElement('li');
    li.textContent = d;
    detailsEl.appendChild(li);
  });

  box.style.display = 'flex';
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showAnalyzingOverlay(show) {
  const overlay = document.getElementById('analyzing-overlay');
  if (overlay) overlay.style.display = show ? 'flex' : 'none';
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader   = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}

function getMime(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const map = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', pdf: 'application/pdf' };
  return map[ext] || 'image/jpeg';
}


// ══════════════════════════════════════════
// MAIN SUBMIT HANDLER
// ══════════════════════════════════════════

async function handleSubmitClick() {

  if (appState === 'processing') return;

  if (appState === 'rejected') {
    showValidationResult('error',
      'Please Re-upload Your Documents',
      'Your previous submission was rejected. Please take a new selfie and re-upload your ID.',
      ['Make sure the ID is a physical card, not a screenshot.',
       'Ensure your face is clearly visible in the live selfie.']
    );
    return;
  }

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;

  const form      = document.querySelector('form');
  const idInput   = document.getElementById('valid_id');
  const idTypeEl  = document.getElementById('id_type');

  clearError('id-error');
  clearError('selfie-error');
  clearError('id-type-error');

  // ── Validate fields ──
  let valid = true;

  if (idTypeEl && !idTypeEl.value) {
    showError('id-type-error', 'Please select your ID type.');
    valid = false;
  }
  if (!idInput.files.length) {
    showError('id-error', 'Please upload your government-issued ID.');
    valid = false;
  }
  if (!capturedSelfieB64) {
    showError('selfie-error', 'Please take a live selfie using the camera.');
    valid = false;
  }

  if (!valid) {
    btn.disabled = false;
    return;
  }

  // Already validated — submit directly
  if (appState === 'approved' || appState === 'review') {
    setState('processing');
    btn.innerHTML = '<span class="btn-icon-complete"></span> Processing...';
    form.submit();
    return;
  }

  // ── START GEMINI VALIDATION ──
  setState('processing');
  showAnalyzingOverlay(true);

  try {
    const idFile = idInput.files[0];
    const idType = idTypeEl ? idTypeEl.value : 'Unknown';

    const idB64 = await toBase64(idFile);
    // selfie is already base64 from camera capture
    const selfieB64 = capturedSelfieB64;

    const response = await fetch('/auth/validate-id-api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_image:     idB64,
        selfie_image: selfieB64,
        id_mime:      getMime(idFile),
        selfie_mime:  'image/jpeg',
        id_type:      idType
      })
    });

    const result = await response.json();
    showAnalyzingOverlay(false);

    // API error fallback
    if (result.error) {
      setState('review');
      document.getElementById('verification_status').value = 'pending';
      showValidationResult('warning',
        'Auto-Validation Unavailable',
        'We could not verify your documents automatically. Your submission will be reviewed manually by our team within 1-2 business days.',
        ['Make sure your ID photo is clear and your face is visible in your selfie.',
         'Our team will review and notify you via email.']
      );
      btn.disabled  = false;
      btn.innerHTML = '<span class="btn-icon-complete"></span> SUBMIT FOR MANUAL REVIEW';
      return;
    }

    const details = [
      `ID Check: ${result.id_reason}`,
      `Selfie Check: ${result.selfie_reason}`
    ];
    if (result.id_type_match === false) {
      details.push(`ID Type Mismatch: You selected "${idType}" but the uploaded ID appears to be a different type.`);
    }

    // ── APPROVED ──
    if (result.action === 'approve') {
      setState('approved');
      document.getElementById('verification_status').value = 'verified';
      showValidationResult('success',
        'Documents Verified!',
        result.overall_reason,
        details
      );
      btn.disabled  = false;
      btn.innerHTML = '<span class="btn-icon-complete"></span> COMPLETE REGISTRATION';

    // ── MANUAL REVIEW ──
    } else if (result.action === 'review') {
      setState('review');
      document.getElementById('verification_status').value = 'pending';
      showValidationResult('warning',
        'Documents Need Manual Review',
        result.overall_reason + ' Your account will be reviewed by our team within 1–2 business days.',
        details
      );
      btn.disabled  = false;
      btn.innerHTML = '<span class="btn-icon-complete"></span> SUBMIT FOR REVIEW';

    // ── REJECTED ──
    } else {
      setState('rejected');
      document.getElementById('verification_status').value = 'pending';

      const rejectDetails = [];
      if (!result.valid_id)
        rejectDetails.push(`ID Issue: ${result.id_reason}`);
      if (!result.clear_selfie)
        rejectDetails.push(`Selfie Issue: ${result.selfie_reason}`);
      if (result.id_type_match === false)
        rejectDetails.push(`Wrong ID type: You selected "${idType}" but uploaded a different document.`);
      rejectDetails.push('Tip: Use good lighting and ensure all ID text is clearly readable.');
      rejectDetails.push('For selfie: face the camera directly with good lighting and no obstructions.');

      showValidationResult('error',
        'Documents Not Accepted',
        'Please take a new selfie and re-upload your ID to continue.',
        rejectDetails
      );

      clearAllFiles();
      btn.disabled  = true;
      btn.innerHTML = '<span class="btn-icon-complete"></span> Re-upload & Retake to Continue';
    }

  } catch (err) {
    showAnalyzingOverlay(false);
    setState('review');
    document.getElementById('verification_status').value = 'pending';
    showValidationResult('warning',
      'Connection Error',
      'Could not reach the validation service. Your submission will be reviewed manually by our team.',
      ['Please check your internet connection.',
       'Our team will review your documents and notify you via email.']
    );
    btn.disabled  = false;
    btn.innerHTML = '<span class="btn-icon-complete"></span> SUBMIT FOR MANUAL REVIEW';
  }
}


// ══════════════════════════════════════════
// KEYBOARD: close modal on Escape
// ══════════════════════════════════════════

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeCameraModal();
  }
});


// ══════════════════════════════════════════
// INIT
// ══════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  initFlash();

  // Only setup ID upload zone (selfie is camera-only now)
  setupUploadZone('id-zone', 'valid_id', 'id-preview', 'id-error', ['jpg', 'jpeg', 'png', 'pdf']);

  const btn = document.getElementById('submit-btn');
  if (btn) btn.addEventListener('click', handleSubmitClick);
});


