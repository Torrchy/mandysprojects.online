// firebase-config.js
// ─────────────────────────────────────────────────────────────
// ONE-TIME SETUP — fill this in after creating your Firebase project:
//
// 1. Go to https://console.firebase.google.com
// 2. Create a project → Add a web app → copy the config below
// 3. Enable Firestore Database (start in production mode)
// 4. Enable Authentication → Sign-in method → Google → Enable
// 5. Authentication → Settings → Authorized domains → add mandysprojects.online
// 6. Firestore → Rules → paste:
//
//    rules_version = '2';
//    service cloud.firestore {
//      match /databases/{database}/documents {
//        match /users/{userId}/{document=**} {
//          allow read, write: if request.auth != null && request.auth.uid == userId;
//        }
//      }
//    }
// ─────────────────────────────────────────────────────────────

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyA4Rc2i7NcaTsnBsON3q5Lj2egU-ZyNQPg",
  authDomain:        "mandysproject-4d903.firebaseapp.com",
  projectId:         "mandysproject-4d903",
  storageBucket:     "mandysproject-4d903.firebasestorage.app",
  messagingSenderId: "746543705288",
  appId:             "1:746543705288:web:160e8231c3fdd051bac9fd"
};
