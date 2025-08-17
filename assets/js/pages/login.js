import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth } from '../firebase-config.js';

const loginForm = document.querySelector('.login-form');
const loginBtn = loginForm.querySelector('.btn-primary');
const googleLoginBtn = document.querySelector('.social-btn');
const forgotPasswordLink = document.querySelector('.forgot-password a');

if(loginForm) {
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

if(googleLoginBtn) {
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

if(forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value.trim();
        if (!email) {
            alert("Please enter your email to reset password.");
            return;
        }
        try {
            await sendPasswordResetEmail(auth, email);
            alert(`Password reset email sent to ${email}.`);
        } catch (error) {
            alert("Failed to send reset email: " + error.message);
        }
    });
}
