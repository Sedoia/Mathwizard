/**
 * Math Wizard - Firebase Crashlytics & Error Logger
 * Automatically records uncaught runtime exceptions to Firebase Firestore `crashes` collection.
 */
(function() {
    window.logMathWizardCrash = async function(errorData) {
        if (!window.firebaseDb) return;
        try {
            const user = window.authService?.getCurrentUser?.();
            const payload = {
                app: errorData.app || 'Math Wizard',
                platform: errorData.platform || 'web',
                error: String(errorData.error || errorData.message || 'Unknown runtime error'),
                stack: String(errorData.stack || errorData.stackTrace || ''),
                url: window.location.href,
                userId: user?.id || user?.uid || 'anonymous',
                userEmail: user?.email || '',
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                date: new Date().toISOString(),
                resolved: false,
                userAgent: navigator.userAgent
            };
            await window.firebaseDb.collection('crashes').add(payload);
            console.log('🛡️ Crash report saved to Firestore:', payload);
        } catch (e) {
            console.warn('Could not log crash to Firebase:', e);
        }
    };

    // Uncaught exception listener
    window.addEventListener('error', function(event) {
        if (!event || !event.message) return;
        if (event.filename && !event.filename.includes(window.location.origin) && !event.filename.includes('assets')) return;
        window.logMathWizardCrash({
            app: 'Math Wizard',
            platform: 'web',
            error: event.message,
            stack: event.error ? event.error.stack : `${event.filename}:${event.lineno}:${event.colno}`
        });
    });

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', function(event) {
        if (!event || !event.reason) return;
        const msg = event.reason.message || String(event.reason);
        window.logMathWizardCrash({
            app: 'Math Wizard',
            platform: 'web',
            error: `Unhandled Promise Rejection: ${msg}`,
            stack: event.reason.stack || ''
        });
    });
})();
