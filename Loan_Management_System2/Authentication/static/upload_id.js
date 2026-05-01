/* ================================================================
   upload_id.js — SECURE FINTECH VERSION
   Identity Cross-Verification & Biometric Matching
   ================================================================ */

const MAX_SIZE_MB = 5;
const MAX_BYTES   = MAX_SIZE_MB * 1024 * 1024;

// ── STATE MACHINE ──
let appState = 'idle'; // 'idle' | 'processing' | 'approved' | 'review' | 'rejected'

function setState(newState) {
  appState = newState;
  console.log('[Security State Check] →', newState);
}

// ── CAMERA STATE ──
let cameraStream     = null;
let capturedSelfieB64 = null; 
let facingMode       = 'user'; 

// ══════════════════════════════════════════
// CAMERA MODAL LOGIC
// ══════════════════════════════════════════

async function openCameraModal() {
  if (appState === 'processing') return;

  const modal = document.getElementById('camera-modal');
  const video = document.getElementById('camera-video');
  
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  await startCamera();
}

async function startCamera() {
  const video = document.getElementById('camera-video');
  stopCamera();

  try {
    const constraints = {
      video: { facingMode: facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    };
    cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = cameraStream;
  } catch (err) {
    alert('Camera Error: ' + err.message);
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
}

function closeCameraModal() {
  stopCamera();
  document.getElementById('camera-modal').style.display = 'none';
  document.body.style.overflow = '';
}

function capturePhoto() {
  const video  = document.getElementById('camera-video');
  const canvas = document.getElementById('camera-canvas');

  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');

  if (facingMode === 'user') {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  
  capturedSelfieB64 = canvas.toDataURL('image/jpeg', 0.92).split(',')[1];

  // UI Preview
  document.getElementById('selfie-preview-img').src = 'data:image/jpeg;base64,' + capturedSelfieB64;
  document.getElementById('selfie-prompt').style.display = 'none';
  document.getElementById('selfie-captured').style.display = 'block';
  document.getElementById('selfie-zone').classList.add('has-file');
  document.getElementById('selfie_base64').value = capturedSelfieB64;

  closeCameraModal();
  if (appState === 'rejected') resetToIdle();
  clearError('selfie-error');
}

// ══════════════════════════════════════════
// UPLOAD HELPERS
// ══════════════════════════════════════════

function showError(errorId, message) {
  const err = document.getElementById(errorId);
  if (err) { err.textContent = message; err.style.display = 'block'; }
}

function clearError(errorId) {
  const err = document.getElementById(errorId);
  if (err) { err.textContent = ''; err.style.display = 'none'; }
}

function resetToIdle() {
  if (appState === 'processing') return;
  setState('idle');
  document.getElementById('verification_status').value = 'pending';
  document.getElementById('validation-result').style.display = 'none';
  const btn = document.getElementById('submit-btn');
  btn.disabled = false;
  btn.innerHTML = 'VALIDATE IDENTITY & FINISH';
}

function clearAllFiles() {
  document.getElementById('valid_id').value = '';
  document.getElementById('id-zone').classList.remove('has-file');
  document.getElementById('id-preview').classList.remove('visible');
  capturedSelfieB64 = null;
  document.getElementById('selfie_base64').value = '';
  document.getElementById('selfie-prompt').style.display = 'block';
  document.getElementById('selfie-captured').style.display = 'none';
  document.getElementById('selfie-zone').classList.remove('has-file');
}

function showAnalyzingOverlay(show) {
  const overlay = document.getElementById('analyzing-overlay');
  if (overlay) overlay.style.display = show ? 'flex' : 'none';
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ══════════════════════════════════════════
// SECURE SUBMIT HANDLER (ANTI-BYPASS)
// ══════════════════════════════════════════

async function handleSubmitClick(e) {
  e.preventDefault();

  if (appState === 'processing') return;

  const btn = document.getElementById('submit-btn');
  const idInput = document.getElementById('valid_id');
  const idTypeEl = document.getElementById('id_type');

  // Basic Validation
  // Basic Validation
const idNumberEl = document.getElementById('id_number');
if (!idTypeEl.value || !idInput.files[0] || !capturedSelfieB64) {
    alert("Please provide ID type, ID photo, and live selfie.");
    return;
}
if (!idNumberEl.value.trim()) {
    alert("Please enter your ID number.");
    idNumberEl.focus();
    return;
}



if (appState === 'approved') {
    document.getElementById('finalIdForm').submit();
    return;
}


if (appState === 'review') {
    const confirm = window.confirm("Your documents need manual review. Submit anyway?");
    if (confirm) {
        document.getElementById('finalIdForm').submit();
    }
    return;
}

  // --- START AI VERIFICATION ---
  setState('processing');
  showAnalyzingOverlay(true);
  btn.disabled = true;

  try {
    const idFile = idInput.files[0];
    const idB64 = await toBase64(idFile);

    const response = await fetch('/auth/validate-id-api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_image: idB64,
        selfie_image: capturedSelfieB64,
        id_type: idTypeEl.value 
      })
    });

    const result = await response.json();
    showAnalyzingOverlay(false);

    if (result.action === 'approve') {
      setState('approved');
      document.getElementById('verification_status').value = 'verified';
      showValidationResult('success', 'Identity Verified!', 'Biometric match and name check successful.');
      btn.disabled = false;
      btn.innerHTML = 'COMPLETE REGISTRATION';
      
    } else if (result.action === 'review') {
      setState('review');
      document.getElementById('verification_status').value = 'pending';
      showValidationResult('warning', 'Manual Review Required', result.overall_reason);
      btn.disabled = false;
      btn.innerHTML = 'SUBMIT FOR REVIEW';

    } else {
      // REJECTED: Security Breach o Identity Mismatch
      setState('rejected');
      showValidationResult('error', 'Verification Failed', result.overall_reason, [
        "Ensure the ID name matches your registered name.",
        "Ensure your face is clearly visible in the selfie.",
        "Screenshots and screen photos are strictly rejected."
      ]);
      clearAllFiles(); // Force clear para bawal i-bypass
      btn.disabled = true;
      btn.innerHTML = 'Please Retake Documents';
    }

  } catch (err) {
    showAnalyzingOverlay(false);
    alert("Security service error. Please refresh and try again.");
    resetToIdle();
  }
}

// ══════════════════════════════════════════
// INIT
// ══════════════════════════════════════════

function showValidationResult(type, title, message, details = []) {
  const box = document.getElementById('validation-result');
  box.className = `validation-box val-${type}`;
  document.getElementById('val-icon').textContent = type === 'success' ? '✅' : (type === 'warning' ? '⚠️' : '❌');
  document.getElementById('val-title').textContent = title;
  document.getElementById('val-message').textContent = message;
  
  const detEl = document.getElementById('val-details');
  detEl.innerHTML = '';
  details.forEach(d => { const li = document.createElement('li'); li.textContent = d; detEl.appendChild(li); });
  
  box.style.display = 'flex';
  box.scrollIntoView({ behavior: 'smooth' });
}

document.addEventListener('DOMContentLoaded', () => {
  initFlash();
  
  // Setup ID Upload Zone
  const idZone = document.getElementById('id-zone');
  const idInput = document.getElementById('valid_id');
  const idPreview = document.getElementById('id-preview');

  idInput.addEventListener('change', () => {
    if (idInput.files[0]) {
      idZone.classList.add('has-file');
      idPreview.classList.add('visible');
      idPreview.querySelector('.preview-name').textContent = idInput.files[0].name;
      resetToIdle();
    }
  });

  const btn = document.getElementById('submit-btn');
  if (btn) btn.addEventListener('click', handleSubmitClick);
});

function initFlash() {
  document.querySelectorAll('.flash-msg').forEach(el => {
    el.querySelector('.f-close').addEventListener('click', () => el.remove());
  });
}