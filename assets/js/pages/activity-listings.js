// FILE: assets/js/pages/activity-listings.js (Improved)
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, getDocs, deleteDoc, doc, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db } from '../firebase-config.js';

const listingsGrid = document.getElementById('listingsGrid');
const statusFilter = document.getElementById('status-filter');
const sortBy = document.getElementById('sort-by');
const deleteModal = document.getElementById('deleteConfirmModal');
const confirmDeleteBtn = document.getElementById('confirmDelete');
const cancelDeleteBtn = document.getElementById('cancelDelete');

let currentUser = null;
let listingToDeleteId = null;

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loadUserListings();
    } else {
        window.location.href = 'login.html';
    }
});

async function loadUserListings() {
    if (!currentUser || !listingsGrid) return;
    listingsGrid.innerHTML = `<div class="loading-state"><i class="fas fa-spinner fa-spin"></i><p>Loading your listings...</p></div>`;

    try {
        let constraints = [where("sellerId", "==", currentUser.uid)];
        
        const status = statusFilter.value;
        if (status !== 'all') {
            constraints.push(where("status", "==", status));
        }

        const sortValue = sortBy.value;
        if (sortValue === 'newest') {
            constraints.push(orderBy("createdAt", "desc"));
        } else if (sortValue === 'oldest') {
            constraints.push(orderBy("createdAt", "asc"));
        } else if (sortValue === 'price-high') {
            constraints.push(orderBy("price", "desc"));
        } else if (sortValue === 'price-low') {
            constraints.push(orderBy("price", "asc"));
        }
        
        const q = query(collection(db, "products"), ...constraints);
        const querySnapshot = await getDocs(q);
        renderListings(querySnapshot);

    } catch (error) {
        console.error("Error loading listings:", error);
        listingsGrid.innerHTML = `<div class="error-state"><p>Error loading listings. Please try again.</p></div>`;
    }
}

function renderListings(querySnapshot) {
    if (querySnapshot.empty) {
        listingsGrid.innerHTML = `<div class="empty-state"><p>You have not posted any products yet.</p></div>`;
        return;
    }
    listingsGrid.innerHTML = querySnapshot.docs.map(doc => {
        const product = doc.data();
        const date = product.createdAt?.toDate ? product.createdAt.toDate().toLocaleDateString() : 'N/A';
        return `
            <div class="listing-card" data-id="${doc.id}">
                <div class="listing-img-container">
                    <img src="${product.images?.[0] || 'https://via.placeholder.com/350x200'}" alt="${product.title}" class="listing-img">
                    ${product.status === 'sold' ? '<div class="sold-badge">Sold</div>' : ''}
                </div>
                <div class="listing-details">
                    <div class="listing-header">
                        <h3 class="listing-title">${product.title}</h3>
                        <span class="listing-price">৳${product.price}</span>
                    </div>
                    <p class="description">${product.description.substring(0, 100)}...</p>
                    <div class="listing-meta">
                        <span>${date}</span>
                    </div>
                    <div class="listing-actions">
                        <button class="btn-edit" data-id="${doc.id}"><i class="fas fa-edit"></i> Edit</button>
                        <button class="btn-delete" data-id="${doc.id}"><i class="fas fa-trash"></i> Delete</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Add event listeners for new buttons
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            listingToDeleteId = e.currentTarget.dataset.id;
            if(deleteModal) deleteModal.style.display = 'flex';
        });
    });
}

if(statusFilter) statusFilter.addEventListener('change', loadUserListings);
if(sortBy) sortBy.addEventListener('change', loadUserListings);

if(confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', async () => {
        if (!listingToDeleteId) return;
        try {
            await deleteDoc(doc(db, "products", listingToDeleteId));
            loadUserListings();
        } catch (error) {
            alert("Error deleting listing: " + error.message);
        } finally {
            if(deleteModal) deleteModal.style.display = 'none';
            listingToDeleteId = null;
        }
    });
}

if(cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener('click', () => {
        if(deleteModal) deleteModal.style.display = 'none';
    });
}
