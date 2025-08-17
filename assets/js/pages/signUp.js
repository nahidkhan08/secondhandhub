import { createUserWithEmailAndPassword, updateProfile, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db } from '../firebase-config.js';

const signupForm = document.querySelector('.signup-form');
const googleSignupBtn = document.querySelector('.google-signup');

const residenceMapping = {
    'yksg1': 'Younus Khan Scholar\'s Garden 1',
    'yksg2a': 'Yunus Khan Scholar Garden 2(A block)',
    'yksg2b': 'Yunus Khan Scholar Garden 2(B block)',
    'diss': 'Daffodil Institute of Social Sciences',
    'rasg1a': 'Rawshan Ara Scholars Garden 1 (A block)',
    'rasg1b': 'Rawshan Ara Scholars Garden 1 (B block)',
    'rasg2': 'Rawshan Ara Scholars Garden 2',
    'other': 'Other Residence',
    'none': 'Off Campus'
};

if(signupForm) {
    signupForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const firstName = document.getElementById('first-name').value.trim();
        const lastName = document.getElementById('last-name').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const residenceValue = document.getElementById('residence').value;
        const termsChecked = document.getElementById('terms').checked;
        const submitBtn = signupForm.querySelector('button[type="submit"]');

        if (!termsChecked) {
            alert("Please accept the Terms & Conditions");
            return;
        }

        const residenceToStore = residenceMapping[residenceValue] || residenceValue;

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner"></span> Creating account...';

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            await updateProfile(user, {
                displayName: `${firstName} ${lastName}`
            });

            await setDoc(doc(db, "users", user.uid), {
                firstName,
                lastName,
                email,
                residence: residenceToStore,
                createdAt: new Date().toISOString()
            });

            window.location.href = "login.html";
        } catch (error) {
            alert("Signup failed: " + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Create account";
        }
    });
}

if (googleSignupBtn) {
    googleSignupBtn.addEventListener('click', async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);

            /* ===== ADD-ONLY: ensure users/{uid} doc for Google sign-up ===== */
            const user = auth.currentUser;
            if (user) {
                const parts = (user.displayName || '').trim().split(' ');
                const firstName = parts[0] || '';
                const lastName  = parts.slice(1).join(' ') || '';
                await setDoc(doc(db, 'users', user.uid), {
                    firstName,
                    lastName,
                    email: user.email || '',
                    photoURL: user.photoURL || null,
                    residence: 'Off Campus',
                    createdAt: new Date().toISOString()
                }, { merge: true });
            }
            /* ===== END ADD-ONLY ===== */

            window.location.href = "profile.html";
        } catch (error) {
            alert("Google signup failed: " + error.message);
        }
    });
}
