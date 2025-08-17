import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection, query, where, getDocs, doc, onSnapshot,
  addDoc, serverTimestamp, orderBy, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db } from '../firebase-config.js';

const conversationsList = document.getElementById('conversations-list').querySelector('.list-body');
const chatWindow = document.getElementById('chat-window');
const chatHeader = document.getElementById('chat-header');
const chatMessages = document.getElementById('chat-messages');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');

let currentUser = null;
let currentChatId = null;
let unsubscribeFromMessages = null;

/* ---------- profile cache helper ---------- */
const userCache = new Map();
async function getUserProfile(uid) {
  if (userCache.has(uid)) return userCache.get(uid);
  const snap = await getDoc(doc(db, "users", uid));
  const data = snap.exists() ? snap.data() : {};
  const profile = {
    displayName: [data.firstName, data.lastName].filter(Boolean).join(' ') || 'Unknown User',
    // ✅ FIX: Google photoURL fallback যোগ করা হলো
    photo: data.photoBase64 || data.photoURL || data.photo || 'https://via.placeholder.com/50'
  };
  userCache.set(uid, profile);
  return profile;
}

/* ---------- Option A: ensure parent chat exists (read blocked হলেও create ট্রাই করবে) ---------- */
async function ensureChatExists(chatId, currentUid) {
  const chatRef = doc(db, 'chats', chatId);

  let exists = false;
  try {
    const snap = await getDoc(chatRef);       // rules read ব্লক করলে নিচে create হবে
    exists = snap.exists();
  } catch (e) {
    exists = false;
    console.warn('getDoc blocked (ok for new chats):', e.code || e.message);
  }

  if (!exists) {
    const parts = chatId.split('_');
    if (parts.length < 3) throw new Error('Bad chatId format');
    const [a, b, productId] = parts;

    if (currentUid !== a && currentUid !== b) {
      throw new Error('You are not a participant of this chat');
    }

    await setDoc(chatRef, {
      participants: [a, b],
      productId,
      productTitle: 'Chat',
      createdAt: serverTimestamp()
    });
  }
  return chatRef;
}

/* ---------- auth gate ---------- */
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    loadConversations();

    const urlParams = new URLSearchParams(window.location.search);
    const chatIdFromUrl = urlParams.get('chatId');
    if (chatIdFromUrl) {
      loadChat(chatIdFromUrl);
    }
  } else {
    window.location.href = 'login.html';
  }
});

/* ---------- conversations list ---------- */
async function loadConversations() {
  const q = query(collection(db, "chats"), where("participants", "array-contains", currentUser.uid));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    conversationsList.innerHTML = "<p>No conversations yet.</p>";
    return;
  }

  conversationsList.innerHTML = '';
  for (const docSnap of querySnapshot.docs) {
    const chatData = docSnap.data();
    const otherUserId = chatData.participants.find(id => id !== currentUser.uid);
    const profile = await getUserProfile(otherUserId);

    const conversationItem = document.createElement('div');
    conversationItem.className = 'conversation-item';
    conversationItem.dataset.chatId = docSnap.id;
    conversationItem.innerHTML = `
      <img src="${profile.photo}" alt="${profile.displayName}">
      <div>
        <h4>${chatData.productTitle}</h4>
        <p>Chat with ${profile.displayName}</p>
      </div>
    `;
    conversationItem.addEventListener('click', () => loadChat(docSnap.id));
    conversationsList.appendChild(conversationItem);
  }
}

/* ---------- open a chat ---------- */
async function loadChat(chatId) {
  currentChatId = chatId;

  // highlight active
  document.querySelectorAll('.conversation-item').forEach(item => {
    item.classList.toggle('active', item.dataset.chatId === chatId);
  });

  // stop previous listener
  if (unsubscribeFromMessages) unsubscribeFromMessages();

  chatHeader.style.display = 'flex';
  messageForm.style.display = 'flex';
  chatMessages.innerHTML = '';

  // 1) ensure parent exists (critical)
  try {
    await ensureChatExists(chatId, currentUser.uid);
  } catch (e) {
    console.error('ensureChatExists failed:', e);
    chatMessages.innerHTML = `<p>Could not open this chat (${e.message}).</p>`;
    return;
  }

  // 2) verify access (participants must include current user)
  const chatRef = doc(db, "chats", chatId);
  const chatSnap = await getDoc(chatRef);
  if (!chatSnap.exists() ||
      !Array.isArray(chatSnap.data().participants) ||
      !chatSnap.data().participants.includes(currentUser.uid)) {
    chatMessages.innerHTML = `<p>You do not have access to this chat.</p>`;
    return;
  }

  // header info (peer + title)
  try {
    const otherUserId = chatSnap.data().participants.find(id => id !== currentUser.uid);
    const otherProfile = await getUserProfile(otherUserId);
    chatHeader.innerHTML = `
      <div class="chat-peer">
        <img src="${otherProfile.photo}" alt="${otherProfile.displayName}"
             style="width:32px;height:32px;border-radius:50%;object-fit:cover;margin-right:8px;">
        <div>
          <div style="font-weight:600">${otherProfile.displayName}</div>
          <div style="font-size:12px;opacity:.8">${chatSnap.data().productTitle || ''}</div>
        </div>
      </div>
    `;
  } catch {
    chatHeader.textContent = chatSnap.data().productTitle || 'Chat';
  }

  // 3) live messages stream
  const messagesQuery = query(collection(db, "chats", chatId, "messages"), orderBy("timestamp"));

  unsubscribeFromMessages = onSnapshot(
    messagesQuery,
    (snapshot) => {
      chatMessages.innerHTML = '';
      snapshot.forEach(docSnap => {
        const msg = docSnap.data();
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        bubble.classList.add(msg.senderId === currentUser.uid ? 'sent' : 'received');
        bubble.textContent = msg.text;
        chatMessages.appendChild(bubble);
      });
      chatMessages.scrollTop = chatMessages.scrollHeight;
    },
    (error) => {
      console.error('messages onSnapshot error:', error);
      chatMessages.innerHTML = `<p>Could not load messages. (${error.code})</p>`;
    }
  );
}

/* ---------- send message ---------- */
messageForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentChatId) return;

  const text = messageInput.value.trim();
  if (!text) return;
  if (text.length > 1000) {
    alert('Message too long. Max 1000 characters.');
    return;
  }

  try {
    // (optional) precheck: you are a participant?
    const chatSnap = await getDoc(doc(db, 'chats', currentChatId));
    if (!chatSnap.exists() || !chatSnap.data().participants?.includes(currentUser.uid)) {
      alert('You are not a participant of this chat.');
      return;
    }

    await addDoc(collection(db, "chats", currentChatId, "messages"), {
      text,
      senderId: currentUser.uid,
      timestamp: serverTimestamp()
    });
    messageInput.value = '';
  } catch (err) {
    console.error('send message failed:', err);
    alert(`Could not send message. (${err.code || 'unknown'})`);
  }
});
