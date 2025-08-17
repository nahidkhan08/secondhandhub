import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBitUFMuJWl_DiuCSOKrxmYbL2eVecGAWk",
  authDomain: "secondhandhub-661e8.firebaseapp.com",
  projectId: "secondhandhub-661e8",
  storageBucket: "secondhandhub-661e8.appspot.com",
  messagingSenderId: "723810459684",
  appId: "1:723810459684:web:110377bc256474331b38b1"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };