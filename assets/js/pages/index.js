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
            alert("Please login to chat with the seller.");
            window.location.href = 'login.html';
            return;
        }
        const buyerId = auth.currentUser.uid;

        // self-chat block
        if (buyerId === sellerId) {
            alert("You can't chat with yourself.");
            return;
        }
        // dataset guard
        if (!sellerId || !productId) {
            alert('Invalid product or seller info.');
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
