// ═══════════════════════════════════════════════════════════════════
//  Just Rodyy Forever — Firebase Config
//  Replace the firebaseConfig object below with your own Firebase project config
// ═══════════════════════════════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, addDoc,
  updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp,
  where, getDocs, arrayUnion, arrayRemove }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

// ──────────────────────────────────────────────────────────────────
//  🔥 REPLACE THIS WITH YOUR OWN FIREBASE CONFIG
//  Go to: https://console.firebase.google.com → Project Settings → Your apps
// ──────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyB2rOAY0hcnwSxZE8KM3BTLIzv_klYAynY",
  authDomain:        "just-rodyy-forever.firebaseapp.com",
  projectId:         "just-rodyy-forever",
  storageBucket:     "just-rodyy-forever.firebasestorage.app",
  messagingSenderId: "556666612562",
  appId:             "1:556666612562:web:57d3098d614adaf957288b",
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);
const storage = getStorage(app);

export {
  app, auth, db, storage,
  // Auth
  signInAnonymously, onAuthStateChanged, signOut,
  // Firestore
  collection, doc, setDoc, getDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp,
  where, getDocs, arrayUnion, arrayRemove,
  // Storage
  ref, uploadBytes, getDownloadURL, deleteObject,
};
