// FILE: assets/js/pages/reset.js
import {
  verifyPasswordResetCode,
  confirmPasswordReset
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth } from '../firebase-config.js';

const params = new URLSearchParams(window.location.search);
const oobCode = params.get('oobCode');
const mode = params.get('mode');

const emailInfo = document.getElementById('resetEmailInfo');
const statusEl  = document.getElementById('resetStatus');
const btn       = document.getElementById('doResetBtn');
const newPass   = document.getElementById('newPass');
const confirmPass = document.getElementById('confirmPass');

function setStatus(msg, ok=false) {
  statusEl.textContent = msg || '';
  statusEl.style.color = ok ? '#0a7d22' : '#c0392b';
}

(async function init() {
  if (!oobCode || mode !== 'resetPassword') {
    setStatus('Invalid or missing reset code.');
    btn.disabled = true;
    return;
  }

  try {
    const email = await verifyPasswordResetCode(auth, oobCode);
    emailInfo.textContent = `Resetting password for: ${email}`;
  } catch (e) {
    setStatus(e.message || 'Reset link is invalid or expired.');
    btn.disabled = true;
  }
})();

btn.addEventListener('click', async () => {
  const p1 = newPass.value.trim();
  const p2 = confirmPass.value.trim();

  if (p1.length < 6) { setStatus('Password must be at least 6 characters.'); return; }
  if (p1 !== p2)     { setStatus('Passwords do not match.'); return; }

  btn.disabled = true;
  const prev = btn.textContent;
  btn.innerHTML = '<span class="spinner"></span> Updating...';
  setStatus('');

  try {
    await confirmPasswordReset(auth, oobCode, p1);
    setStatus('✅ Password updated successfully. You can now log in.', true);
  } catch (e) {
    setStatus(e.message || 'Failed to set new password.');
  } finally {
    btn.disabled = false;
    btn.textContent = prev;
  }
});
