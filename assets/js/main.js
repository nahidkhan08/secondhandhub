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
       sessionStorage.setItem('shh_flash', JSON.stringify({
        type: 'info',
        msg: 'You have been logged out.'
        }));
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



/* === ADD-ONLY: navbar messenger unread badge === */
(() => {
  const badge = document.getElementById('nav-msg-badge');
  if (!badge) return; // এই পেজে মেসেঞ্জার আইকন নেই

  onAuthStateChanged(auth, async (user) => {
    // লগআউট হলে ব্যাজ হাইড করো
    if (!user) {
      badge.style.display = 'none';
      return;
    }

    // live listen: এই ইউজার যার যার চ্যাটে অংশগ্রহণকারী
    const { collection, query, where, onSnapshot } =
      await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

    const q = query(collection(db, 'chats'), where('participants', 'array-contains', user.uid));

    onSnapshot(q, (snap) => {
      let unread = 0;

      snap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const updatedAtMs = data.updatedAt && typeof data.updatedAt.toMillis === 'function'
          ? data.updatedAt.toMillis()
          : 0;

        // আগে কখন দেখা হয়েছে, সেটা লোকালস্টোরেজে (messages.js সেট করে)
        const lastSeenRaw = localStorage.getItem(`chatSeen_${user.uid}_${docSnap.id}`) || '0';
        const lastSeen = parseInt(lastSeenRaw, 10) || 0;

        if (updatedAtMs && updatedAtMs > lastSeen) {
          unread += 1;
        }
      });

      if (unread > 0) {
        badge.textContent = unread > 99 ? '99+' : unread.toString();
        badge.style.display = 'inline-flex';
      } else {
        badge.style.display = 'none';
      }
    }, (err) => {
      console.warn('unread badge snapshot error:', err);
      badge.style.display = 'none';
    });
  });
})();




/* === ADD-ONLY: Toast utility (global: window.notify) === */
(function initToasts(){
  let root = document.getElementById('toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toast-root';
    document.body.appendChild(root);
  }
  const make = (msg, type='info', opts={}) => {
    const el = document.createElement('div');
    el.className = `shh-toast ${type}`;
    const iconMap = {
      success: 'fa-check-circle',
      error:   'fa-circle-exclamation',
      info:    'fa-circle-info',
      warn:    'fa-triangle-exclamation'
    };
    el.innerHTML = `
      <i class="fa ${iconMap[type]||iconMap.info} icon"></i>
      <div class="body">${msg}</div>
      <button class="close" aria-label="Dismiss">&times;</button>
    `;
    el.querySelector('.close').onclick = () => el.remove();
    root.appendChild(el);
    const ttl = opts.duration ?? 3000;  // ms
    if (ttl > 0) setTimeout(() => el.remove(), ttl);
  };
  window.notify = {
    success: (m,o)=>make(m,'success',o),
    error:   (m,o)=>make(m,'error',o),
    info:    (m,o)=>make(m,'info',o),
    warn:    (m,o)=>make(m,'warn',o)
  };
})();



/* === ADD-ONLY: Flash message reader (runs on every page) === */
document.addEventListener('DOMContentLoaded', () => {
  try {
    const raw = sessionStorage.getItem('shh_flash');
    if (!raw) return;
    sessionStorage.removeItem('shh_flash');
    const { type = 'info', msg = '', duration = 3000 } = JSON.parse(raw) || {};
    // একটু delay দিলে DOM/notify ready থাকে
    setTimeout(() => {
      if (window.notify && typeof window.notify[type] === 'function') {
        window.notify[type](msg, { duration });
      }
    }, 50);
  } catch (e) {
    // ignore
  }
});
