import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth } from '../firebase-config.js';

const loginForm = document.querySelector('.login-form');
const loginBtn = loginForm.querySelector('.btn-primary');
const googleLoginBtn = document.querySelector('.social-btn');
// const forgotPasswordLink = document.querySelector('.forgot-password a'); // (পুরনো ডিরেক্ট-রিসেট লজিক আর দরকার নেই)

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="spinner"></span> Logging in...';
    try {
      await signInWithEmailAndPassword(auth, email, password);
      window.location.href = "index.html";
    } catch (error) {
      alert("Login failed: " + error.message);
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = "Log In";
    }
  });
}

if (googleLoginBtn) {
  googleLoginBtn.addEventListener('click', async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);

      /* ===== ADD-ONLY: ensure users/{uid} doc for Google Login ===== */
      try {
        const user = auth.currentUser;
        if (user) {
          const { doc, setDoc } =
            await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
          const { db } = await import('../firebase-config.js');

          const parts = (user.displayName || '').trim().split(' ');
          const firstName = parts[0] || '';
          const lastName  = parts.slice(1).join(' ') || '';

          await setDoc(doc(db, 'users', user.uid), {
            firstName,
            lastName,
            email: user.email || '',
            photoURL: user.photoURL || null,
            residence: 'Off Campus',
            profileComplete: false,
            createdAt: new Date().toISOString()
          }, { merge: true });
        }
      } catch (e) {
        // নীরবে ইগনোর; লোগইন চালু থাকবে
        console.warn('users doc ensure (google login) failed:', e);
      }
      /* ===== END ADD-ONLY ===== */

      window.location.href = "index.html";
    } catch (error) {
      alert("Google login failed: " + error.message);
    }
  });
}

/* === ADD-ONLY: Forgot Password Modal (send reset link) === */
// 🔸 উপরে already import করা sendPasswordResetEmail এবং auth এখানেই ব্যবহার করছি (পুনরায় import নেই)
(function setupForgotModal() {
  const trigger = document.querySelector('.forgot-password a');
  if (!trigger) return;

  const ensureModal = () => {
    let modal = document.getElementById('resetModal');
    if (modal) return modal;

    const html = `
      <div id="resetModal" class="modal" style="display:none;">
        <div class="modal-content">
          <h3 style="margin-bottom:6px;">Reset your password</h3>
          <p style="margin-bottom:12px;">Enter your account email. We'll send you a secure reset link.</p>
          <input type="email" id="resetEmail" placeholder="you@example.com" style="width:100%;padding:12px;border:1px solid #ddd;border-radius:4px;">
          <div id="resetMsg" style="margin-top:10px;font-size:14px;opacity:.9;"></div>
          <div class="modal-buttons">
            <button id="sendResetBtn" class="btn-primary">Send reset link</button>
            <button id="cancelResetBtn" class="btn-secondary" style="padding:14px;border:1px solid #ddd;background:#fff;border-radius:4px;cursor:pointer;">Cancel</button>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    modal = document.getElementById('resetModal');

    // events
    const sendBtn = modal.querySelector('#sendResetBtn');
    const cancelBtn = modal.querySelector('#cancelResetBtn');
    const emailInput = modal.querySelector('#resetEmail');
    const msg = modal.querySelector('#resetMsg');

    const setMsg = (text, ok=false) => {
      msg.textContent = text || '';
      msg.style.color = ok ? '#0a7d22' : '#c0392b';
    };

    cancelBtn.addEventListener('click', () => { modal.style.display = 'none'; setMsg(''); });

    sendBtn.addEventListener('click', async () => {
      const email = (emailInput.value || '').trim();
      if (!email) { setMsg('Please enter a valid email.'); return; }

      sendBtn.disabled = true;
      const prev = sendBtn.textContent;
      sendBtn.innerHTML = '<span class="spinner"></span> Sending...';
      setMsg('');

      try {
        // Reset link পাঠাবো আমাদের reset পেজে
        const actionCodeSettings = { url: `${location.origin}/reset.html` };
        await sendPasswordResetEmail(auth, email, actionCodeSettings);
        setMsg(`Password reset link sent to ${email}. Check your inbox (and spam).`, true);
      } catch (e) {
        setMsg(e.message || 'Failed to send reset link.');
      } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = prev;
      }
    });

    // click-outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) { modal.style.display = 'none'; setMsg(''); }
    });

    return modal;
  };

  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    const modal = ensureModal();

    // ইমেইল ইনপুট থেকে প্রিফিল
    const emailFromInput = document.getElementById('email')?.value?.trim();
    if (emailFromInput) modal.querySelector('#resetEmail').value = emailFromInput;

    modal.style.display = 'flex';
  });
})();
