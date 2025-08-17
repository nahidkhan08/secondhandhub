import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db } from './firebase-config.js';

function updateNavAuthState() {
    const guestView = document.getElementById('guest-view');
    const userView = document.getElementById('user-view');
    const navProfilePic = document.getElementById('nav-profile-pic');
    const navUsername = document.getElementById('nav-username');

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            if (guestView) guestView.style.display = 'none';
            if (userView) userView.style.display = 'flex';
            
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                if (navUsername) navUsername.textContent = userData.firstName || 'Profile';
                if (navProfilePic) {
                    navProfilePic.src = userData.photoBase64 || userData.photoURL || 'https://via.placeholder.com/40';
                }
            }
        } else {
            if (guestView) guestView.style.display = 'flex';
            if (userView) userView.style.display = 'none';
        }
    });
}

window.logout = async function() {
    try {
        await signOut(auth);
        window.location.href = 'login.html';
    } catch (error) {
        console.error("Logout error:", error);
    }
};

document.addEventListener('DOMContentLoaded', updateNavAuthState);

