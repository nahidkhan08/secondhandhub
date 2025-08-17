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

// Profile dropdown toggle functionality
document.addEventListener('DOMContentLoaded', function() {
    const profileToggle = document.getElementById('user-profile-toggle');
    const dropdownMenu = document.getElementById('profile-dropdown');
    
    if (profileToggle && dropdownMenu) {
        profileToggle.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent the click from bubbling up
            dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
        });
        
        // Close dropdown when clicking anywhere else
        document.addEventListener('click', function() {
            dropdownMenu.style.display = 'none';
        });
    }
});


/* ==================== */
(() => {
  onAuthStateChanged(auth, async (user) => {
    if (!user) return;

    try {
      const userRef = doc(db, 'users', user.uid);
      let snap;
      try {
        snap = await getDoc(userRef);
      } catch (e) {
        // read error হলে পরেও create ট্রাই করব
        snap = null;
        console.warn('users getDoc blocked or failed (will try create):', e?.code || e?.message);
      }

      // doc না থাকলে বা প্রাথমিক তথ্য মিসিং হলে create/merge
      if (!snap || !snap.exists()) {
        const { setDoc, serverTimestamp } =
          await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const parts = (user.displayName || '').trim().split(' ');
        const firstName = parts[0] || '';
        const lastName  = parts.slice(1).join(' ') || '';
        await setDoc(userRef, {
          firstName,
          lastName,
          email: user.email || '',
          photoBase64: null,
          photoURL: user.photoURL || null,
          residence: 'Off Campus',
          profileComplete: false,
          createdAt: serverTimestamp()
        }, { merge: true });
      } else {
        const data = snap.data() || {};
        if ((!data.firstName && user.displayName) || (!data.photoURL && user.photoURL)) {
          const { setDoc } =
            await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
          const parts = (user.displayName || '').trim().split(' ');
          const firstName = parts[0] || '';
          const lastName  = parts.slice(1).join(' ') || '';
          await setDoc(userRef, {
            firstName: data.firstName || firstName,
            lastName:  data.lastName  || lastName,
            photoURL:  data.photoURL  || user.photoURL || null
          }, { merge: true });
        }
      }
      const navUsername = document.getElementById('nav-username');
      const navProfilePic = document.getElementById('nav-profile-pic');

      if (navUsername && (!navUsername.textContent || navUsername.textContent === 'Profile' || navUsername.textContent === 'User')) {
        const first = (user.displayName || '').trim().split(' ')[0] || 'Profile';
        navUsername.textContent = first;
      }
      if (navProfilePic && (navProfilePic.src.includes('placeholder') || !navProfilePic.src)) {
        if (user.photoURL) navProfilePic.src = user.photoURL;
      }
    } catch (e) {
      console.error('ensureUserDoc (add-only) failed:', e);
    }
  });
})();
