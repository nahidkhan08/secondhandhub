import { collection, query, where, getDocs, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db } from '../firebase-config.js';

const productsGrid = document.getElementById('productsGrid');
const productCount = document.getElementById('product-count');
const sortBy = document.getElementById('sort-by');
const applyFiltersBtn = document.getElementById('apply-filters');
const modal = document.getElementById('product-modal');

/* === ADD-ONLY: read ?q= and ?category= from URL === */
const urlParams = new URLSearchParams(window.location.search);
const searchTerm = (urlParams.get('q') || '').toLowerCase();
const categoryFromUrl = (urlParams.get('category') || '').toLowerCase();
/* pre-select category checkbox from URL if present */
(() => {
  if (!categoryFromUrl) return;
  const allCb = document.querySelector('#cat-all');
  if (allCb) allCb.checked = false;
  const target = document.querySelector(`input[name="category"][value="${categoryFromUrl}"]`);
  if (target) target.checked = true;
})();

let allProducts = [];

async function fetchAllProducts() {
    if (!productsGrid) return;
    productsGrid.innerHTML = `<p>Loading products...</p>`;

    try {
        const q = query(collection(db, "products"), where("status", "==", "active"));
        const querySnapshot = await getDocs(q);
        
        allProducts = await Promise.all(querySnapshot.docs.map(async (productDoc) => {
            const productData = productDoc.data();
            const sellerDoc = await getDoc(doc(db, "users", productData.sellerId));
            const sellerName = sellerDoc.exists() ? `${sellerDoc.data().firstName} ${sellerDoc.data().lastName}` : 'Unknown Seller';
            
            return {
                id: productDoc.id,
                ...productData,
                sellerName: sellerName
            };
        }));
        
        filterAndRenderProducts();

    } catch (error) {
        console.error("Error fetching products:", error);
        productsGrid.innerHTML = `<p>Error loading products. Please try again later.</p>`;
    }
}

function filterAndRenderProducts() {
    let filteredProducts = [...allProducts];

    // Category filter
    const checkedCategories = Array.from(document.querySelectorAll('input[name="category"]:checked')).map(cb => cb.value);
    if (!checkedCategories.includes('all') && checkedCategories.length > 0) {
        filteredProducts = filteredProducts.filter(product => checkedCategories.includes(product.category));
    }

    // Price filter
    const minPrice = parseFloat(document.getElementById('price-min').value);
    const maxPrice = parseFloat(document.getElementById('price-max').value);
    if (!isNaN(minPrice)) {
        filteredProducts = filteredProducts.filter(product => product.price >= minPrice);
    }
    if (!isNaN(maxPrice)) {
        filteredProducts = filteredProducts.filter(product => product.price <= maxPrice);
    }

    /* === ADD-ONLY: text search (title/description/category/hall) === */
    if (searchTerm) {
        filteredProducts = filteredProducts.filter(p => {
            const t = (p.title || '').toLowerCase();
            const d = (p.description || '').toLowerCase();
            const c = (p.category || '').toLowerCase();
            const h = (p.hall || '').toLowerCase();
            return t.includes(searchTerm) || d.includes(searchTerm) || c.includes(searchTerm) || h.includes(searchTerm);
        });
    }
    
    // Sorting
    const sortValue = sortBy.value;
    filteredProducts.sort((a, b) => {
        switch (sortValue) {
            case 'price-high': return b.price - a.price;
            case 'price-low': return a.price - b.price;
            case 'newest':
            default:
                return (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0);
        }
    });

    renderProducts(filteredProducts);
}

function renderProducts(products) {
    if (productCount) {
        // ADD-ONLY: nice suffix if searched
        const qRaw = urlParams.get('q');
        const suffix = (qRaw && qRaw.trim()) ? ` (filtered by "${qRaw}")` : '';
        productCount.textContent = `${products.length} Products Found${suffix}`;
    }

    if (products.length === 0) {
        productsGrid.innerHTML = `<p>No products match your criteria.</p>`;
        return;
    }

    productsGrid.innerHTML = products.map(product => `
        <div class="product-card" data-id="${product.id}">
            <div class="product-img-container">
                <img src="${product.images?.[0] || 'https://via.placeholder.com/300x200'}" alt="${product.title}" class="product-img">
            </div>
            <div class="product-details">
                <h3 class="product-title">${product.title}</h3>
                <p class="product-price">৳${product.price}</p>
                <p class="product-seller">Sold by: ${product.sellerName}</p>
            </div>
        </div>
    `).join('');
}

async function showProductDetails(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product || !modal) return;
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
                    <p><strong>Seller:</strong> ${product.sellerName}</p>
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

if (productsGrid) {
    productsGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.product-card');
        if (card) showProductDetails(card.dataset.id);
    });
}
document.addEventListener('DOMContentLoaded', fetchAllProducts);
if (applyFiltersBtn) applyFiltersBtn.addEventListener('click', filterAndRenderProducts);
if (sortBy) sortBy.addEventListener('change', filterAndRenderProducts);
