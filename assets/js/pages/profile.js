import { onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
// Corrected import path to resolve the error
import { auth, db } from '../firebase-config.js'; 

// DOM Elements
const profilePic = document.getElementById('profilePic');
const displayName = document.getElementById('displayName');
const displayHall = document.getElementById('displayHall');
const firstNameInput = document.getElementById('firstName');
const lastNameInput = document.getElementById('lastName');
const emailInput = document.getElementById('email');
const phoneInput = document.getElementById('phone');
const hallSelect = document.getElementById('hall');
const bioInput = document.getElementById('bio');
const editBtn = document.getElementById('editProfileBtn');
const saveBtn = document.getElementById('saveBtn');
const fileInput = document.getElementById('fileInput');
const uploadModal = document.getElementById('uploadConfirmModal');
const confirmUploadBtn = document.getElementById('confirmUpload');
const cancelUploadBtn = document.getElementById('cancelUpload');
const imagePreviewContainer = document.getElementById('imagePreview');

// State variables
let isEditing = false;
let currentUser = null;
let newProfilePicBase64 = null;

const residenceMapping = {
    'shahidul': 'Shahidul Islam Hall',
    'bangabandhu': 'Bangabandhu Hall',
    'fazlul': 'Fazlul Haque Hall',
    'sufia': 'Begum Sufia Hall',
    'other': 'Other Residence',
    'none': 'Off Campus'
};

// Check authentication state
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loadUserData(user.uid);
    } else {
        window.location.href = 'login.html';
    }
});

// Load user data from Firestore
async function loadUserData(uid) {
    try {
        const userDoc = await getDoc(doc(db, "users", uid));
        if (userDoc.exists()) {
            const data = userDoc.data();
            
            // Populate all fields
            displayName.textContent = `${data.firstName || ''} ${data.lastName || ''}`;
            displayHall.textContent = data.residence || 'Not Specified';
            firstNameInput.value = data.firstName || '';
            lastNameInput.value = data.lastName || '';
            emailInput.value = data.email || '';
            phoneInput.value = data.phone || '';
            hallSelect.value = Object.keys(residenceMapping).find(key => residenceMapping[key] === data.residence) || 'other';
            bioInput.value = data.bio || '';
            
            // This line fixes the profile picture issue
            profilePic.src = data.photoBase64 || data.photoURL || 'https://via.placeholder.com/150';
        }
    } catch (error) {
        console.error("Error loading user data:", error);
    }
}

// Toggle edit mode
if(editBtn) {
    editBtn.addEventListener('click', () => {
        isEditing = !isEditing;
        toggleEditState();
    });
}

function toggleEditState() {
    const inputs = [firstNameInput, lastNameInput, phoneInput, hallSelect, bioInput];
    if (isEditing) {
        inputs.forEach(input => { input.readOnly = false; input.disabled = false; });
        saveBtn.style.display = 'block';
        editBtn.innerHTML = '<i class="fas fa-times"></i> Cancel';
    } else {
        inputs.forEach(input => { input.readOnly = true; input.disabled = true; });
        saveBtn.style.display = 'none';
        editBtn.innerHTML = '<i class="fas fa-edit"></i> Edit';
        if(currentUser) loadUserData(currentUser.uid); // Revert changes if cancelled
    }
}

// Save changes
if(saveBtn) {
    saveBtn.addEventListener('click', async () => {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="spinner"></span> Saving...';
        try {
            const residenceToStore = residenceMapping[hallSelect.value] || hallSelect.value;
            const updatedData = {
                firstName: firstNameInput.value,
                lastName: lastNameInput.value,
                phone: phoneInput.value,
                residence: residenceToStore,
                bio: bioInput.value,
            };
            if (newProfilePicBase64) {
                updatedData.photoBase64 = newProfilePicBase64;
            }
            await updateDoc(doc(db, "users", currentUser.uid), updatedData);
            await updateProfile(currentUser, { displayName: `${firstNameInput.value} ${lastNameInput.value}` });
            
            isEditing = false;
            toggleEditState();
            await loadUserData(currentUser.uid); // Reload data to show changes
        } catch (error) {
            alert("Failed to save profile: " + error.message);
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = 'Save Changes';
        }
    });
}

// Image upload logic
const uploadBtn = document.querySelector('.upload-btn');
if(uploadBtn) {
    uploadBtn.addEventListener('click', () => fileInput.click());
}

if(fileInput) {
    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                newProfilePicBase64 = e.target.result;
                imagePreviewContainer.innerHTML = `<img src="${newProfilePicBase64}" alt="Preview">`;
                uploadModal.style.display = 'flex';
            };
            reader.readAsDataURL(file);
        }
    });
}

if(confirmUploadBtn) {
    confirmUploadBtn.addEventListener('click', async () => {
        if (newProfilePicBase64) {
            profilePic.src = newProfilePicBase64; // Update UI immediately
            await updateDoc(doc(db, "users", currentUser.uid), { photoBase64: newProfilePicBase64 });
        }
        uploadModal.style.display = 'none';
    });
}

if(cancelUploadBtn) {
    cancelUploadBtn.addEventListener('click', () => {
        newProfilePicBase64 = null;
        uploadModal.style.display = 'none';
    });
}
