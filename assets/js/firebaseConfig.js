/**
 * Firebase bootstrap shared by all pages.
 * Uses global compat SDK objects loaded via script tags.
 */
(function initializeFirebase() {
    if (typeof firebase === 'undefined') {
        console.error('Firebase SDK not loaded.');
        return;
    }

    const firebaseConfig = {
        apiKey: "AIzaSyAL-DlXXksCEyclom4mNYSASFcNTV7ld3U",
        authDomain: "math-wizard-1afd3.firebaseapp.com",
        projectId: "math-wizard-1afd3",
        storageBucket: "math-wizard-1afd3.firebasestorage.app",
        messagingSenderId: "299618769417",
        appId: "1:299618769417:web:6dd56766d2a4fb3ff476d8"
    };

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }

    window.firebaseApp = firebase.app();
    window.firebaseAuth = firebase.auth();
    window.firebaseDb = firebase.firestore();
})();
