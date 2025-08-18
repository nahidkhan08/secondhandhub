import { collection, query, where, getDocs, limit, orderBy, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db } from '../firebase-config.js';

const latestProductsGrid = document.getElementById('latestProductsGrid');
const modal = document.getElementById('product-modal');
let latestProducts = [];

async function fetchLatestProducts() {
    if (!latestProductsGrid) return;
    latestProductsGrid.innerHTML = `<p>Loading latest products...</p>`;
    try {
        const q = query(collection(db, "products"), where("status", "==", "active"), orderBy("createdAt", "desc"), limit(8));
        const querySnapshot = await getDocs(q);
        renderLatestProducts(querySnapshot.docs);
    } catch (error) {
        console.error("Error fetching latest products:", error);
        latestProductsGrid.innerHTML = `<p>Could not load products. Please ensure Firestore indexes are configured.</p>`;
    }
}

function renderLatestProducts(docs) {
    if (docs.length === 0) {
        latestProductsGrid.innerHTML = `<p>No products available right now.</p>`;
        return;
    }
    latestProducts = docs.map(doc => ({ id: doc.id, ...doc.data() }));
    latestProductsGrid.innerHTML = latestProducts.map(product => `
        <div class="product-card" data-id="${product.id}">
            <div class="product-img-container"><img src="${product.images?.[0] || 'https://via.placeholder.com/300x200'}" alt="${product.title}" class="product-img"></div>
            <div class="product-details">
                <h3 class="product-title">${product.title}</h3>
                <p class="product-price">৳${product.price}</p>
            </div>
        </div>
    `).join('');

    /* 🔹 ADD-ONLY: marquee-like ribbon build */
    renderLatestRibbon();
}

async function showProductDetails(productId) {
    const product = latestProducts.find(p => p.id === productId);
    if (!product || !modal) return;
    const sellerDoc = await getDoc(doc(db, "users", product.sellerId));
    const sellerName = sellerDoc.exists() ? `${sellerDoc.data().firstName} ${sellerDoc.data().lastName}` : 'Unknown Seller';
    const modalContent = modal.querySelector('.modal-content');
    modalContent.innerHTML = `
        <button class="modal-close-btn">&times;</button>
        <div class="modal-product-layout">
            <div class="modal-image-gallery">
                <img src="${product.images[0]}" alt="${product.title}" class="main-image">
                <div class="thumbnails">${product.images.map((img, index) => `<img src="${img}" class="thumb ${index === 0 ? 'active' : ''}" data-src="${img}">`).join('')}</div>
            </div>
            <div class="modal-product-info">
                <h2>${product.title}</h2>
                <p class="price">৳${product.price}</p>
                <p class="description">${product.description}</p>
                <div class="seller-info">
                    <p><strong>Seller:</strong> ${sellerName}</p>
                    <p><strong>Location:</strong> ${product.hall || 'Not specified'}</p>
                </div>
                <button class="btn-primary chat-btn" data-seller-id="${product.sellerId}" data-product-id="${product.id}" data-product-title="${product.title}">Chat with Seller</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('show'), 10);
    modal.querySelector('.modal-close-btn').addEventListener('click', () => {
        modal.classList.remove('show');
        setTimeout(() => modal.style.display = 'none', 300);
    });
    modal.querySelectorAll('.thumb').forEach(thumb => {
        thumb.addEventListener('click', (e) => {
            modal.querySelector('.main-image').src = e.target.dataset.src;
            modal.querySelectorAll('.thumb').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
        });
    });
    
    // Chat with Seller
    modal.querySelector('.chat-btn').addEventListener('click', async (e) => {
        const { sellerId, productId, productTitle } = e.currentTarget.dataset; // important
        if (!auth.currentUser) {
            notify.info("Please login to chat with the seller.");
            window.location.href = 'login.html';
            return;
        }
        const buyerId = auth.currentUser.uid;

        // self-chat block
        if (buyerId === sellerId) {
            notify.warn("You can't chat with yourself.");
            return;
        }
        // dataset guard
        if (!sellerId || !productId) {
            notify.error('Invalid product or seller info.');
            return;
        }

        const [u1, u2] = [buyerId, sellerId].sort();
        const chatId = `${u1}_${u2}_${productId}`;
        try {
            await getOrCreateChat(buyerId, sellerId, productId, productTitle);
        } catch (err) {
            console.error('chat create failed', err);
        } finally {
            window.location.href = `messages.html?chatId=${chatId}`;
        }
    });
}

async function getOrCreateChat(buyerId, sellerId, productId, productTitle) {
    const [u1, u2] = [buyerId, sellerId].sort();
    const chatId = `${u1}_${u2}_${productId}`;
    const chatRef = doc(db, "chats", chatId);
    const chatSnap = await getDoc(chatRef);
    if (!chatSnap.exists()) {
        await setDoc(chatRef, {
            participants: [u1, u2],
            productId: productId,
            productTitle: productTitle,
            createdAt: serverTimestamp()
        });
    }
    return chatId;
}

if (latestProductsGrid) {
    latestProductsGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.product-card');
        if (card) showProductDetails(card.dataset.id);
    });
}
document.addEventListener('DOMContentLoaded', fetchLatestProducts);


/* === ADD-ONLY: Home search bar -> redirect to shop with ?q= === */
(() => {
  const searchWrap = document.querySelector('.search-bar');
  if (!searchWrap) return;

  const input = searchWrap.querySelector('input');
  const btn   = searchWrap.querySelector('button');
  if (!input || !btn) return;

  const go = () => {
    const q = (input.value || '').trim();
    if (q) {
      window.location.href = `shop.html?q=${encodeURIComponent(q)}`;
    } else {
      window.location.href = `shop.html`;
    }
  };

  btn.addEventListener('click', go);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') go();
  });
})();

/* ======================================== */
function renderLatestRibbon() {
  const track = document.getElementById('latestRibbonTrack');
  if (!track || !latestProducts || latestProducts.length === 0) return;

  const onePass = latestProducts.map(p => {
    const img = (p.images && p.images[0]) || 'https://via.placeholder.com/150';
    const title = p.title || 'Untitled';
    const price = (typeof p.price === 'number') ? `৳${p.price}` : (p.price || '—');
    const isNew = p.createdAt && typeof p.createdAt.toDate === 'function'
      ? (Date.now() - p.createdAt.toDate().getTime()) < 48*3600*1000
      : false;

    return `
      <a class="ribbon-card" data-id="${p.id}" href="javascript:void(0)">
        <img class="ribbon-thumb" src="${img}" alt="${title}">
        <div class="ribbon-meta">
          <div class="ribbon-title">${title}</div>
          <div class="ribbon-price">${price}</div>
          ${isNew ? `<span class="ribbon-badge">New</span>` : ``}
        </div>
      </a>
    `;
  }).join('');

  // seamless loop: duplicate content once (keyframes goes -50%)
  track.innerHTML = onePass + onePass;

  // dynamic speed based on count (optional)
  const secs = Math.max(24, Math.min(60, latestProducts.length * 4));
  track.style.setProperty('--scroll-duration', `${secs}s`);
}

/* Click handler for ribbon cards -> open product modal */
(() => {
  const track = document.getElementById('latestRibbonTrack');
  if (!track) return;
  track.addEventListener('click', (e) => {
    const card = e.target.closest('.ribbon-card');
    if (card) showProductDetails(card.dataset.id);
  });
})();
