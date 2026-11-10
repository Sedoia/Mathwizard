/**
 * Authentication Service - Firebase Implementation
 * Replaces local-only auth with Firebase Auth + Firestore user profiles.
 */

class AuthService {
    constructor() {
        this.CURRENT_USER_KEY = 'mathwizard_current_user';
        this.TOKEN_KEY = 'mathwizard_token';
        this.USERS_COLLECTION = 'users';

        this.currentUser = this.getStoredUser();
        this._firebaseReady = this.waitForFirebase();
    }

    async waitForFirebase() {
        if (window.firebaseAuth && window.firebaseDb) {
            return;
        }

        const maxAttempts = 80;
        let attempts = 0;

        while ((!window.firebaseAuth || !window.firebaseDb) && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts += 1;
        }

        if (!window.firebaseAuth || !window.firebaseDb) {
            throw new Error('Firebase failed to initialize. Check SDK script tags and firebaseConfig.js load order.');
        }
    }

    mapLoginIdentifier(emailOrUsername) {
        if (!emailOrUsername) {
            return '';
        }

        const normalized = emailOrUsername.trim();
        return normalized.toLowerCase();
    }

    generateToken() {
        return 'mw_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    }

    getDefaultPlayerPayload(uid, name, email, role = 'player') {
        return {
            id: uid,
            username: email.split('@')[0],
            email,
            name,
            role,
            level: role === 'admin' ? 99 : 1,
            xp: role === 'admin' ? 999999 : 0,
            xpToNextLevel: role === 'admin' ? 1000000 : 1000,
            gold: role === 'admin' ? 999999 : 500,
            crystals: role === 'admin' ? 99999 : 50,
            energy: 100,
            createdAt: new Date().toISOString(),
            avatar: null,
            stats: {
                problemsSolved: role === 'admin' ? 9999 : 0,
                accuracy: role === 'admin' ? 100 : 0,
                hoursPlayed: role === 'admin' ? 999 : 0,
                winStreak: role === 'admin' ? 999 : 0,
                totalWins: role === 'admin' ? 9999 : 0,
                totalLosses: 0
            },
            achievements: role === 'admin'
                ? ['first_victory', 'streak_king', 'genius', 'derivative_master', 'integral_expert']
                : [],
            unlockedSkins: role === 'admin'
                ? ['default_wizard', 'dragon_mage', 'space_scholar', 'phantom_wizard', 'forest_sage', 'fire_mage', 'ice_wizard', 'classic_scholar']
                : ['default_wizard'],
            equippedSkin: role === 'admin' ? 'dragon_mage' : 'default_wizard',
            purchaseHistory: [],
            settings: {
                soundEffects: true,
                backgroundMusic: true,
                showHints: true,
                difficulty: 'Normal'
            },
            updatedAt: new Date().toISOString()
        };
    }

    getDefaultProfilePlayerData(profile) {
        if (profile.role === 'admin') {
            return {
                id: profile.id,
                name: profile.name,
                title: 'Grandmaster Overseer',
                level: 99,
                memberSince: 'Jan 2024',
                avatar: 'fa-wizard',
                online: true,
                rank: {
                    name: 'Supreme',
                    percentile: '0.01%',
                    icon: 'fa-star'
                },
                streak: {
                    current: 365,
                    best: 365,
                    lastUpdated: new Date().toISOString()
                },
                stats: {
                    xp: 999999,
                    maxXp: 1000000,
                    calcPower: 999,
                    accuracy: 100,
                    challengesWon: 9999,
                    playTime: 999,
                    critRate: 50,
                    dodge: 50,
                    defense: 999
                },
                currency: {
                    gold: 999999,
                    crystals: 99999,
                    energy: {
                        current: 100,
                        max: 100
                    }
                },
                dailyChallenges: [
                    { id: 'dc_1', name: 'Derivative Duel', progress: 5, max: 5, reward: '250 Gold', icon: 'fa-flash' },
                    { id: 'dc_2', name: 'Integration Challenge', progress: 3, max: 3, reward: '300 Gold', icon: 'fa-cube' },
                    { id: 'dc_3', name: 'Perfect Score', progress: 1, max: 1, reward: '100 Crystals', icon: 'fa-crown' }
                ],
                activeQuests: [],
                inventory: [
                    { id: 'inv_1', name: 'Calculus Grimoire', rarity: 'Legendary', quantity: 1, icon: 'fa-book' }
                ],
                equipment: [
                    { slot: 'Wand', item: 'Arcane Staff of Derivatives', rarity: 'Legendary', stats: '+15 Calc Power' }
                ],
                battleHistory: [],
                leaderboard: {
                    global: { rank: 1, totalPlayers: 50000, points: 999999 },
                    regional: { rank: 1, region: 'Global', points: 999999 },
                    school: { rank: 1, school: 'NCST', points: 999999 },
                    nextRank: { name: 'Max Rank', pointsNeeded: 0, currentPoints: 999999 }
                },
                achievements: [
                    { id: 'ach_1', name: 'First Victory', description: 'Win your first battle', icon: 'fa-trophy', unlocked: true, date: 'Jan 15, 2024' }
                ],
                settings: {
                    soundEffects: true,
                    backgroundMusic: true,
                    showHints: true,
                    difficulty: 'Normal'
                },
                seedVersion: 2,
                updatedAt: new Date().toISOString()
            };
        }

        return {
            id: profile.id,
            name: profile.name,
            title: 'Novice Spellcaster',
            level: 1,
            memberSince: new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' }),
            avatar: 'fa-wizard',
            online: true,
            rank: {
                name: 'Apprentice',
                percentile: 'New',
                icon: 'fa-star'
            },
            streak: {
                current: 0,
                best: 0,
                lastUpdated: new Date().toISOString()
            },
            stats: {
                xp: 0,
                maxXp: 1000,
                calcPower: 10,
                accuracy: 0,
                challengesWon: 0,
                playTime: 0,
                critRate: 1,
                dodge: 1,
                defense: 5
            },
            currency: {
                gold: profile.gold || 500,
                crystals: profile.crystals || 50,
                energy: {
                    current: profile.energy || 100,
                    max: 100
                }
            },
            dailyChallenges: [
                { id: 'dc_1', name: 'Derivative Duel', progress: 0, max: 5, reward: '250 Gold', icon: 'fa-flash' },
                { id: 'dc_2', name: 'Integration Challenge', progress: 0, max: 3, reward: '300 Gold', icon: 'fa-cube' },
                { id: 'dc_3', name: 'Perfect Score', progress: 0, max: 1, reward: '100 Crystals', icon: 'fa-crown' }
            ],
            activeQuests: [
                { id: 'q_1', name: 'Calculus Prophecy', type: 'main', progress: 0, max: 20, description: 'Complete 20 calculus challenges' },
                { id: 'q_2', name: 'Dungeon Master', type: 'side', progress: 0, max: 10, description: 'Defeat 10 dungeon bosses' },
                { id: 'q_3', name: 'Collector\'s Paradise', type: 'bonus', progress: 0, max: 15, description: 'Collect 15 rare items' }
            ],
            inventory: [
                { id: 'inv_1', name: 'Apprentice Notes', rarity: 'Common', quantity: 1, icon: 'fa-book' },
                { id: 'inv_2', name: 'Minor Focus Potion', rarity: 'Common', quantity: 1, icon: 'fa-vial' }
            ],
            equipment: [
                { slot: 'Wand', item: 'Novice Wand', rarity: 'Common', stats: '+2 Calc Power' },
                { slot: 'Armor', item: 'Student Robe', rarity: 'Common', stats: '+2 Defense' }
            ],
            battleHistory: [],
            leaderboard: {
                global: { rank: 50000, totalPlayers: 50000, points: 0 },
                regional: { rank: 1000, region: 'Unranked', points: 0 },
                school: { rank: 100, school: 'NCST', points: 0 },
                nextRank: { name: 'Bronze', pointsNeeded: 100, currentPoints: 0 }
            },
            achievements: [
                { id: 'ach_1', name: 'First Victory', description: 'Win your first battle', icon: 'fa-trophy', unlocked: false, date: null },
                { id: 'ach_2', name: 'Streak Master', description: 'Achieve a 7-day streak', icon: 'fa-fire', unlocked: false, date: null },
                { id: 'ach_3', name: 'Calculation Wizard', description: 'Reach level 40', icon: 'fa-wand-magic-sparkles', unlocked: false, date: null },
                { id: 'ach_4', name: 'Perfect Precision', description: 'Achieve 99% accuracy', icon: 'fa-bullseye', unlocked: false, date: null },
                { id: 'ach_5', name: 'Legend Ascended', description: 'Reach Legendary rank', icon: 'fa-crown', unlocked: false, date: null }
            ],
            settings: {
                soundEffects: true,
                backgroundMusic: true,
                showHints: true,
                difficulty: 'Normal'
            },
            seedVersion: 2,
            updatedAt: new Date().toISOString()
        };
    }

    async getUserDocByUid(uid) {
        const ref = window.firebaseDb.collection(this.USERS_COLLECTION).doc(uid);
        const doc = await ref.get();
        return doc.exists ? doc.data() : null;
    }

    async setUserDoc(uid, payload, merge = true) {
        const ref = window.firebaseDb.collection(this.USERS_COLLECTION).doc(uid);
        await ref.set(payload, { merge });
    }

    storeUser(userData) {
        localStorage.setItem(this.TOKEN_KEY, userData.token || this.generateToken());
        localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(userData));
    }

    getStoredUser() {
        const userData = localStorage.getItem(this.CURRENT_USER_KEY);
        return userData ? JSON.parse(userData) : null;
    }

    getToken() {
        return localStorage.getItem(this.TOKEN_KEY);
    }

    getCurrentUser() {
        return this.currentUser || this.getStoredUser();
    }

    isAuthenticated() {
        return !!this.getStoredUser() && !!localStorage.getItem(this.TOKEN_KEY);
    }

    isAdmin() {
        const user = this.getCurrentUser();
        return !!user && user.role === 'admin';
    }

    async ensurePlayerProfileDoc(profile) {
        const playerRef = window.firebaseDb.collection('players').doc(profile.id);
        const playerDoc = await playerRef.get();
        if (!playerDoc.exists) {
            await playerRef.set(this.getDefaultProfilePlayerData(profile));
            return;
        }

        const data = playerDoc.data() || {};
        const isLegacySeed =
            profile.role !== 'admin' &&
            !data.seedVersion &&
            ((data.level || 1) > 1 || (Array.isArray(data.achievements) && data.achievements.some(a => a.unlocked)));

        if (isLegacySeed) {
            await playerRef.set(this.getDefaultProfilePlayerData(profile), { merge: false });
        }
    }

    async login(emailOrUsername, password) {
        await this._firebaseReady;

        const identifier = this.mapLoginIdentifier(emailOrUsername);
        let loginEmail = identifier;

        // If identifier doesn't look like an email, try to find user by username
        if (!identifier.includes('@')) {
            try {
                const usersRef = window.firebaseDb.collection(this.USERS_COLLECTION);
                const usernameQuery = await usersRef
                    .where('username', '==', identifier)
                    .limit(1)
                    .get();

                if (!usernameQuery.empty) {
                    loginEmail = usernameQuery.docs[0].data().email;
                } else {
                    throw new Error(`Username "${emailOrUsername}" not found. Please use email or correct username.`);
                }
            } catch (error) {
                if (error.message.includes('not found')) {
                    throw error;
                }
                throw new Error('Error looking up username. Please try with email instead.');
            }
        }

        try {
            const credential = await window.firebaseAuth.signInWithEmailAndPassword(loginEmail, password);
            const fbUser = credential.user;

            let userProfile = await this.getUserDocByUid(fbUser.uid);

            if (!userProfile) {
                const role = 'player';
                const name = fbUser.displayName || fbUser.email.split('@')[0];
                userProfile = this.getDefaultPlayerPayload(fbUser.uid, name, fbUser.email, role);
                await this.setUserDoc(fbUser.uid, userProfile, false);
            }

            await this.ensurePlayerProfileDoc(userProfile);

            const token = await fbUser.getIdToken();
            const sessionData = {
                ...userProfile,
                token,
                lastLogin: new Date().toISOString()
            };

            this.storeUser(sessionData);
            this.currentUser = sessionData;
            return sessionData;
        } catch (error) {
            throw new Error(this.mapFirebaseError(error));
        }
    }

    async register(name, email, password) {
        await this._firebaseReady;

        const normalizedEmail = (email || '').trim().toLowerCase();

        try {
            const credential = await window.firebaseAuth.createUserWithEmailAndPassword(normalizedEmail, password);
            const fbUser = credential.user;

            const role = 'player';
            const profile = this.getDefaultPlayerPayload(
                fbUser.uid,
                name,
                normalizedEmail,
                role
            );

            await this.setUserDoc(fbUser.uid, profile, false);
            await this.ensurePlayerProfileDoc(profile);

            const token = await fbUser.getIdToken();
            const sessionData = {
                ...profile,
                token
            };

            this.storeUser(sessionData);
            this.currentUser = sessionData;

            return sessionData;
        } catch (error) {
            throw new Error(this.mapFirebaseError(error));
        }
    }

    async loginWithGoogle() {
        await this._firebaseReady;

        try {
            const provider = new window.firebase.auth.GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });

            const result = await window.firebaseAuth.signInWithPopup(provider);
            const fbUser = result.user;

            let userProfile = await this.getUserDocByUid(fbUser.uid);
            if (!userProfile) {
                const role = 'player';
                const displayName = fbUser.displayName || (fbUser.email || 'player').split('@')[0];

                userProfile = this.getDefaultPlayerPayload(
                    fbUser.uid,
                    displayName,
                    (fbUser.email || '').toLowerCase(),
                    role
                );

                await this.setUserDoc(fbUser.uid, userProfile, false);
            }

            await this.ensurePlayerProfileDoc(userProfile);

            const token = await fbUser.getIdToken();
            const sessionData = {
                ...userProfile,
                token,
                lastLogin: new Date().toISOString()
            };

            this.storeUser(sessionData);
            this.currentUser = sessionData;
            return sessionData;
        } catch (error) {
            throw new Error(this.mapFirebaseError(error));
        }
    }

    async updateProfile(updates) {
        await this._firebaseReady;

        const currentUser = this.getCurrentUser();
        if (!currentUser) {
            throw new Error('Not authenticated');
        }

        const updatedData = {
            ...updates,
            updatedAt: new Date().toISOString()
        };

        await this.setUserDoc(currentUser.id, updatedData, true);

        const refreshed = {
            ...currentUser,
            ...updatedData,
            token: this.getToken()
        };

        this.storeUser(refreshed);
        this.currentUser = refreshed;

        return refreshed;
    }

    async requestPasswordReset(email) {
        await this._firebaseReady;
        try {
            const resetUrl = 'https://mathwizard-test.netlify.app/reset';
            await window.firebaseAuth.sendPasswordResetEmail(
                (email || '').trim().toLowerCase(),
                {
                    url: resetUrl,
                    handleCodeInApp: false
                }
            );
            return true;
        } catch (error) {
            throw new Error(this.mapFirebaseError(error));
        }
    }

    async changePassword(currentPassword, newPassword) {
        await this._firebaseReady;

        const user = window.firebaseAuth.currentUser;
        if (!user || !user.email) {
            throw new Error('Not authenticated');
        }

        const providerIds = (user.providerData || []).map(p => p.providerId);
        if (providerIds.includes('google.com') && !providerIds.includes('password')) {
            throw new Error('This account uses Google sign-in. Password change is not available here.');
        }

        try {
            const credential = window.firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
            await user.reauthenticateWithCredential(credential);
            await user.updatePassword(newPassword);
            return true;
        } catch (error) {
            throw new Error(this.mapFirebaseError(error));
        }
    }

    async updateEmail(currentPassword, newEmail) {
        await this._firebaseReady;

        const user = window.firebaseAuth.currentUser;
        if (!user || !user.email) {
            throw new Error('Not authenticated');
        }

        const normalizedEmail = (newEmail || '').trim().toLowerCase();
        if (!normalizedEmail) {
            throw new Error('Email is required');
        }

        try {
            const providerIds = (user.providerData || []).map(p => p.providerId);
            if (providerIds.includes('password')) {
                const credential = window.firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
                await user.reauthenticateWithCredential(credential);
            } else if (providerIds.includes('google.com')) {
                const provider = new window.firebase.auth.GoogleAuthProvider();
                await user.reauthenticateWithPopup(provider);
            } else {
                throw new Error('Unsupported authentication provider for email update.');
            }

            await user.updateEmail(normalizedEmail);
            await this.updateProfile({ email: normalizedEmail, username: normalizedEmail.split('@')[0] });
            return true;
        } catch (error) {
            throw new Error(this.mapFirebaseError(error));
        }
    }

    async deleteCurrentAccount(currentPassword) {
        await this._firebaseReady;

        const user = window.firebaseAuth.currentUser;
        if (!user || !user.email) {
            throw new Error('Not authenticated');
        }

        try {
            const providerIds = (user.providerData || []).map(p => p.providerId);
            if (providerIds.includes('password')) {
                const credential = window.firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
                await user.reauthenticateWithCredential(credential);
            } else if (providerIds.includes('google.com')) {
                const provider = new window.firebase.auth.GoogleAuthProvider();
                await user.reauthenticateWithPopup(provider);
            } else {
                throw new Error('Unsupported authentication provider for account deletion.');
            }

            const uid = user.uid;
            await window.firebaseDb.collection(this.USERS_COLLECTION).doc(uid).delete();
            await window.firebaseDb.collection('players').doc(uid).delete();

            await user.delete();

            localStorage.removeItem(this.CURRENT_USER_KEY);
            localStorage.removeItem(this.TOKEN_KEY);
            sessionStorage.clear();
            this.currentUser = null;

            return true;
        } catch (error) {
            throw new Error(this.mapFirebaseError(error));
        }
    }

    async addPurchase(purchase) {
        await this._firebaseReady;

        const currentUser = this.getCurrentUser();
        if (!currentUser) {
            throw new Error('Not authenticated');
        }

        const purchaseRecord = {
            id: 'txn_' + Date.now(),
            ...purchase,
            date: new Date().toISOString(),
            status: 'completed'
        };

        const userDoc = (await this.getUserDocByUid(currentUser.id)) || currentUser;
        const purchaseHistory = [purchaseRecord, ...(userDoc.purchaseHistory || [])];

        return this.updateProfile({ purchaseHistory });
    }

    async getAllUsersAdmin() {
        await this._firebaseReady;

        if (!this.isAdmin()) {
            console.error('Unauthorized: Admin access required');
            return [];
        }

        const snapshot = await window.firebaseDb.collection(this.USERS_COLLECTION).get();
        return snapshot.docs.map(doc => {
            const data = doc.data();
            const { password, ...safeUser } = data;
            return safeUser;
        });
    }

    async deleteUser(userId) {
        await this._firebaseReady;

        if (!this.isAdmin()) {
            console.error('Unauthorized: Admin access required');
            return false;
        }

        const target = await this.getUserDocByUid(userId);
        if (!target || target.role === 'admin') {
            return false;
        }

        await window.firebaseDb.collection(this.USERS_COLLECTION).doc(userId).delete();
        await window.firebaseDb.collection('players').doc(userId).delete();
        return true;
    }

    logout() {
        if (window.firebaseAuth) {
            window.firebaseAuth.signOut().catch(err => {
                console.warn('Firebase signOut warning:', err?.message || err);
            });
        }

        localStorage.removeItem(this.CURRENT_USER_KEY);
        localStorage.removeItem(this.TOKEN_KEY);
        sessionStorage.clear();
        this.currentUser = null;
    }

    mapFirebaseError(error) {
        const code = error?.code || '';
        const messages = {
            'auth/invalid-email': 'Invalid email format.',
            'auth/user-disabled': 'This account has been disabled.',
            'auth/user-not-found': 'No account found for this email.',
            'auth/wrong-password': 'Incorrect password.',
            'auth/invalid-credential': 'Invalid email/username or password.',
            'auth/email-already-in-use': 'Email already registered.',
            'auth/weak-password': 'Password must be at least 6 characters.',
            'auth/too-many-requests': 'Too many attempts. Please try again later.',
            'auth/network-request-failed': 'Network error. Check your internet connection.',
            'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
            'auth/popup-blocked': 'Popup blocked by browser. Please allow popups and try again.',
            'auth/operation-not-allowed': 'Google sign-in is not enabled in Firebase Authentication.'
            ,
            'auth/requires-recent-login': 'Please log in again to complete this action.'
        };

        return messages[code] || error?.message || 'Authentication failed.';
    }
}

const authService = new AuthService();
window.authService = authService;
