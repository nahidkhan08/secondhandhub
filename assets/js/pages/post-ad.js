// FILE: assets/js/pages/post-ad.js (Corrected)
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
// serverTimestamp import kora hoyeche
import { collection, addDoc, doc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db } from '../firebase-config.js';

const adForm = document.getElementById('adForm');
const titleInput = document.getElementById('title');
const priceInput = document.getElementById('price');
const descriptionInput = document.getElementById('description');
const fileInput = document.getElementById('fileInput');
const imageUpload = document.getElementById('imageUpload');
const previewImage = document.getElementById('previewImage');
const imagePlaceholder = document.querySelector('.image-placeholder');
const previewTitle = document.querySelector('.preview-title');
const previewPrice = document.querySelector('.preview-price');
const previewDescription = document.querySelector('.preview-description');

let currentUser = null;
let selectedFiles = [];
let userHall = 'Not Specified';

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            userHall = userDoc.data().residence || 'Not Specified';
        }
    } else {
        window.location.href = 'login.html';
    }
});

if(titleInput) titleInput.addEventListener('input', () => previewTitle.textContent = titleInput.value || 'Your Item Title');
if(priceInput) priceInput.addEventListener('input', () => previewPrice.textContent = priceInput.value ? `৳${priceInput.value}` : '৳0');
if(descriptionInput) descriptionInput.addEventListener('input', () => previewDescription.textContent = descriptionInput.value || 'Item description will appear here...');

if(imageUpload) imageUpload.addEventListener('click', () => fileInput.click());
if(fileInput) fileInput.addEventListener('change', (e) => {
    selectedFiles = Array.from(e.target.files).slice(0, 5);
    if (selectedFiles.length > 0) {
        const reader = new FileReader();
        reader.onload = (event) => {
            if(previewImage) {
                previewImage.src = event.target.result;
                previewImage.style.display = 'block';
            }
            if(imagePlaceholder) imagePlaceholder.style.display = 'none';
        };
        reader.readAsDataURL(selectedFiles[0]);
    }
});

if(adForm) {
    adForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser) {
            alert("You must be logged in to post an ad.");
            return;
        }
        const submitBtn = adForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting...';

        try {
            const imageBase64s = await Promise.all(selectedFiles.map(file => fileToBase64(file)));
            
            await addDoc(collection(db, "products"), {
                title: titleInput.value.trim(),
                category: document.getElementById('category').value,
                price: Number(priceInput.value),
                description: descriptionInput.value.trim(),
                images: imageBase64s,
                sellerId: currentUser.uid,
                // Corrected: Using serverTimestamp() to let Firebase handle the time
                createdAt: serverTimestamp(), 
                status: 'active',
                hall: userHall,
            });

            alert('Ad posted successfully!');
            window.location.href = 'activity-listings.html';
        } catch (error) {
            console.error("Error posting ad:", error);
            alert('Error posting ad: ' + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Post Ad Now';
        }
    });
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}