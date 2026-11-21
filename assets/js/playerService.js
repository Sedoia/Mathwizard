/**
 * Player Service - Firebase Firestore implementation
 * Persists profile data in players/{playerId} and keeps session cache for fast loads.
 */

class PlayerService {
    constructor() {
        this.currentPlayer = null;
        this.isInitialized = false;
        this._firebaseReady = this.waitForFirebase();
    }

    async waitForFirebase() {
        if (window.firebaseDb) {
            return;
        }

        const maxAttempts = 80;
        let attempts = 0;

        while (!window.firebaseDb && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts += 1;
        }

        if (!window.firebaseDb) {
            throw new Error('Firebase Firestore failed to initialize.');
        }
    }

    getDefaultPlayerData(playerId) {
        return {
            id: playerId,
            name: 'New Wizard',
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
                gold: 0,
                aether: 0,
                crystals: 0,
                numerals: 0
            },
            crystals: 0,
            numerals: 0,
            dailyChallenges: [],
            activeQuests: [],
            inventory: [],
            equipment: [],
            battleHistory: [],
            leaderboard: {
                global: { rank: 50000, totalPlayers: 50000, points: 0 },
                regional: { rank: 1000, region: 'Unranked', points: 0 },
                school: { rank: 100, school: 'NCST', points: 0 },
                nextRank: { name: 'Bronze', pointsNeeded: 100, currentPoints: 0 }
            },
            achievements: [
                { id: 'first_victory', name: 'First Victory', description: 'Win your first calculus challenge', icon: 'fa-trophy', unlocked: false, date: null },
                { id: 'streak_king', name: 'Streak King', description: 'Achieve a 7-day challenge streak', icon: 'fa-fire', unlocked: false, date: null },
                { id: 'calculation_wizard', name: 'Calculation Wizard', description: 'Reach level 40 in your journey', icon: 'fa-wand-magic-sparkles', unlocked: false, date: null },
                { id: 'perfect_precision', name: 'Perfect Precision', description: 'Achieve 99% accuracy in battle', icon: 'fa-bullseye', unlocked: false, date: null },
                { id: 'derivative_master', name: 'Derivative Master', description: 'Solve 20 derivative challenges', icon: 'fa-graduation-cap', unlocked: false, date: null },
                { id: 'legend_ascended', name: 'Legend Ascended', description: 'Reach Legendary status', icon: 'fa-crown', unlocked: false, date: null }
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

    async getPlayerDoc(playerId) {
        try {
            const doc = await window.firebaseDb.collection('players').doc(playerId).get();
            return doc.exists ? doc.data() : null;
        } catch (error) {
            console.warn('Could not fetch player doc:', error?.message || error);
            return null;
        }
    }

    async setPlayerDoc(playerId, payload, merge = true) {
        try {
            await window.firebaseDb.collection('players').doc(playerId).set(payload, { merge });
        } catch (error) {
            console.warn('Could not set player doc:', error?.message || error);
        }
    }

    cachePlayer(playerId, data) {
        try {
            sessionStorage.setItem(`player_${playerId}`, JSON.stringify(data));
        } catch (e) {
            // Storage quota or disabled
        }
    }

    normalizePlayerData(playerId, playerDoc, userDoc, gameUserDoc) {
        const defaults = this.getDefaultPlayerData(playerId);
        const p = playerDoc || {};
        const u = userDoc || {};
        const g = gameUserDoc || {};

        const level = Number(p.level ?? u.level ?? defaults.level);
        const xp = Number(p.stats?.xp ?? p.xp ?? u.xp ?? defaults.stats.xp);
        const maxXp = Number(p.stats?.maxXp ?? p.maxXp ?? u.xpToNextLevel ?? defaults.stats.maxXp);

        // Stats: calcPower, accuracy, challengesWon, playTime
        const calcPower = Number(p.stats?.calcPower ?? (10 + (level - 1) * 5));
        const accuracy = Number(p.stats?.accuracy ?? u.stats?.accuracy ?? defaults.stats.accuracy);
        const challengesWon = Number(
            p.stats?.challengesWon ??
            u.stats?.problemsSolved ??
            u.stats?.totalWins ??
            (Array.isArray(p.unlockedLevels) ? p.unlockedLevels.length : 0) ??
            defaults.stats.challengesWon
        );
        const playTime = Number(
            p.stats?.playTime ??
            p.playTime ??
            p.stats?.hoursPlayed ??
            p.hoursPlayed ??
            p.play_time ??
            u.stats?.playTime ??
            u.stats?.hoursPlayed ??
            u.playTime ??
            u.hoursPlayed ??
            defaults.stats.playTime
        );

        // Currencies: Gold/Aether, Arcane Crystals / Numerals, Mana Energy
        const gold = Number(
            g.gold ??
            g.currency?.gold ??
            u.gold ??
            p.currency?.gold ??
            p.gold ??
            u.currency?.gold ??
            g.aether ??
            p.currency?.aether ??
            u.aether ??
            defaults.currency.gold ??
            0
        );
        const aether = gold;
        let gameWallet = g.progress?.MathWizard_Wallet;
        if (typeof gameWallet === 'string') {
            try {
                gameWallet = JSON.parse(gameWallet);
            } catch (error) {
                console.warn('Could not parse game wallet:', error?.message || error);
                gameWallet = null;
            }
        }
        const gameNumerals = gameWallet?.standard == null ? NaN : Number(gameWallet.standard);
        const hasGameNumerals = Number.isFinite(gameNumerals);
        let crystals = Number(
            (hasGameNumerals ? gameNumerals : undefined) ??
            p.currency?.numerals ??
            p.currency?.crystals ??
            p.numerals ??
            p.crystals ??
            u.currency?.numerals ??
            u.currency?.crystals ??
            u.numerals ??
            u.crystals ??
            defaults.currency.crystals ??
            0
        );

        // Auto-fix: if an account had the legacy default of 50 seeded and hasn't unlocked levels or won challenges yet, reset to 0
        const isFreshPlayer = (challengesWon === 0) && (level === 1) && (p.role !== 'admin') && (u.role !== 'admin');
        if (!hasGameNumerals && isFreshPlayer && (crystals === 50 || p.currency?.crystals === 50 || u.crystals === 50)) {
            crystals = 0;
            // Also sync the correction to Firestore so it persists permanently in the database
            if (window.firebaseDb && playerId && playerId !== 'player_12345') {
                window.firebaseDb.collection('players').doc(playerId).set({
                    currency: { crystals: 0, numerals: 0 }
                }, { merge: true }).catch(() => {});
                window.firebaseDb.collection('users').doc(playerId).set({
                    crystals: 0,
                    numerals: 0
                }, { merge: true }).catch(() => {});
            }
            // Update current user in localStorage and sessionStorage if needed
            const storedUser = authService?.getCurrentUser?.();
            if (storedUser && (storedUser.id === playerId || storedUser.uid === playerId)) {
                storedUser.crystals = 0;
                storedUser.numerals = 0;
                if (storedUser.currency) {
                    storedUser.currency.crystals = 0;
                    storedUser.currency.numerals = 0;
                }
                authService.storeUser(storedUser);
            }
            try {
                sessionStorage.removeItem(`player_${playerId}`);
            } catch (e) {}
        }
        const numerals = crystals;

        // Streak: current and best
        let currentStreak = 0;
        let bestStreak = 0;
        if (typeof p.streak === 'object' && p.streak !== null) {
            currentStreak = Number(p.streak.current ?? p.streak.count ?? p.streak.days ?? 0);
            bestStreak = Number(p.streak.best ?? currentStreak);
        } else if (typeof p.streak === 'number') {
            currentStreak = p.streak;
            bestStreak = p.streak;
        } else if (p.currentStreak !== undefined) {
            currentStreak = Number(p.currentStreak || 0);
            bestStreak = Number(p.bestStreak || currentStreak);
        } else if (typeof u.streak === 'object' && u.streak !== null) {
            currentStreak = Number(u.streak.current ?? u.streak.count ?? u.streak.days ?? 0);
            bestStreak = Number(u.streak.best ?? currentStreak);
        } else if (typeof u.streak === 'number') {
            currentStreak = u.streak;
            bestStreak = u.streak;
        } else if (u.currentStreak !== undefined) {
            currentStreak = Number(u.currentStreak || 0);
            bestStreak = Number(u.bestStreak || currentStreak);
        } else if (u.stats?.winStreak !== undefined || u.stats?.currentStreak !== undefined) {
            currentStreak = Number(u.stats.currentStreak ?? u.stats.winStreak ?? 0);
            bestStreak = Number(u.stats.bestStreak ?? currentStreak);
        }

        // Achievements: merge catalog with database unlocks & real stats milestones
        const rawAchievements = p.achievements || u.achievements || [];
        const unlockedIds = new Set();

        if (Array.isArray(rawAchievements)) {
            rawAchievements.forEach(item => {
                if (typeof item === 'string') {
                    unlockedIds.add(item.toLowerCase());
                } else if (typeof item === 'object' && item !== null) {
                    if (item.unlocked) {
                        unlockedIds.add(String(item.id || item.name || '').toLowerCase());
                    }
                }
            });
        }

        const achievements = defaults.achievements.map(base => {
            const isExplicitlyUnlocked = unlockedIds.has(base.id.toLowerCase()) || unlockedIds.has(base.name.toLowerCase());
            
            // Automatic milestone checks based on real player metrics
            let meetsRequirement = false;
            if (base.id === 'first_victory' && challengesWon >= 1) meetsRequirement = true;
            if (base.id === 'streak_king' && (currentStreak >= 7 || bestStreak >= 7)) meetsRequirement = true;
            if (base.id === 'calculation_wizard' && level >= 40) meetsRequirement = true;
            if (base.id === 'perfect_precision' && accuracy >= 99 && challengesWon >= 3) meetsRequirement = true;
            if (base.id === 'derivative_master' && challengesWon >= 20) meetsRequirement = true;
            if (base.id === 'legend_ascended' && level >= 50) meetsRequirement = true;

            const unlocked = isExplicitlyUnlocked || meetsRequirement;
            return {
                ...base,
                unlocked,
                date: unlocked ? (base.date || 'Achieved') : null
            };
        });

        return {
            id: playerId,
            name: u.name || p.name || defaults.name,
            username: u.username || p.username || '',
            avatarUrl: u.avatarUrl || p.avatarUrl || '',
            bio: p.bio || u.bio || '',
            socialLinks: p.socialLinks || u.socialLinks || {},
            level,
            memberSince: p.memberSince || (u.createdAt ? new Date(u.createdAt).toLocaleString('en-US', { month: 'short', year: 'numeric' }) : defaults.memberSince),
            avatar: p.avatar || defaults.avatar,
            online: true,
            streak: {
                current: currentStreak,
                best: bestStreak,
                lastUpdated: p.streak?.lastUpdated || new Date().toISOString()
            },
            stats: {
                xp,
                maxXp,
                calcPower,
                accuracy,
                challengesWon,
                playTime,
                critRate: Number(p.stats?.critRate ?? defaults.stats.critRate),
                dodge: Number(p.stats?.dodge ?? defaults.stats.dodge),
                defense: Number(p.stats?.defense ?? defaults.stats.defense)
            },
            currency: {
                gold,
                aether,
                crystals,
                numerals
            },
            crystals,
            numerals,
            achievements,
            settings: {
                ...defaults.settings,
                ...(p.settings || {}),
                ...(u.settings || {})
            },
            updatedAt: p.updatedAt || new Date().toISOString()
        };
    }

    async initializePlayer(playerId) {
        try {
            await this._firebaseReady;

            const currentUser = authService?.getCurrentUser?.() || null;

            // Fetch real database records from Firestore
            let playerDoc = null;
            let userDoc = null;
            let gameUserDoc = null;

            try {
                const [playerDocSnap, userDocSnap, gameUserDocSnap] = await Promise.all([
                    window.firebaseDb.collection('players').doc(playerId).get(),
                    window.firebaseDb.collection('users').doc(playerId).get(),
                    window.firebaseDb.collection('game_users').doc(playerId).get()
                ]);
                if (playerDocSnap.exists) playerDoc = playerDocSnap.data();
                if (userDocSnap.exists) userDoc = userDocSnap.data();
                if (gameUserDocSnap.exists) gameUserDoc = gameUserDocSnap.data();
            } catch (fetchErr) {
                console.warn('Firestore fetch notice:', fetchErr?.message || fetchErr);
            }

            const playerData = this.normalizePlayerData(playerId, playerDoc, userDoc || currentUser, gameUserDoc);

            // If player document does not exist yet in Firestore, initialize it
            if (!playerDoc && window.firebaseDb) {
                await this.setPlayerDoc(playerId, playerData, true);
            }

            this.currentPlayer = playerData;
            this.cachePlayer(playerId, playerData);
            this.isInitialized = true;

            return playerData;
        } catch (error) {
            console.error('Error initializing player:', error);
            const fallback = this.getDefaultPlayerData(playerId);
            this.currentPlayer = fallback;
            return fallback;
        }
    }

    /**
     * Subscribe to real-time database changes from Firestore for this player.
     * @param {string} playerId
     * @param {Function} callback
     * @returns {Function} Unsubscribe function
     */
    subscribeToPlayer(playerId, callback) {
        if (!window.firebaseDb || !playerId) {
            return () => {};
        }

        let unsubscribePlayer = null;
        let unsubscribeUser = null;
        let unsubscribeGameUser = null;
        let latestPlayerDoc = null;
        let latestUserDoc = null;
        let latestGameUserDoc = null;

        const notify = () => {
            const merged = this.normalizePlayerData(
                playerId,
                latestPlayerDoc,
                latestUserDoc || authService?.getCurrentUser?.(),
                latestGameUserDoc
            );
            this.currentPlayer = merged;
            this.cachePlayer(playerId, merged);
            if (typeof callback === 'function') {
                callback(merged);
            }
        };

        try {
            unsubscribePlayer = window.firebaseDb.collection('players').doc(playerId).onSnapshot(doc => {
                if (doc.exists) {
                    latestPlayerDoc = doc.data();
                    notify();
                }
            }, err => console.warn('Player snapshot notice:', err?.message || err));

            unsubscribeUser = window.firebaseDb.collection('users').doc(playerId).onSnapshot(doc => {
                if (doc.exists) {
                    latestUserDoc = doc.data();
                    notify();
                }
            }, err => console.warn('User snapshot notice:', err?.message || err));

            unsubscribeGameUser = window.firebaseDb.collection('game_users').doc(playerId).onSnapshot(doc => {
                latestGameUserDoc = doc.exists ? doc.data() : null;
                notify();
            }, err => console.warn('Game user snapshot notice:', err?.message || err));
        } catch (e) {
            console.warn('Real-time listener setup notice:', e);
        }

        return () => {
            if (unsubscribePlayer) unsubscribePlayer();
            if (unsubscribeUser) unsubscribeUser();
            if (unsubscribeGameUser) unsubscribeGameUser();
        };
    }

    getCurrentPlayer() {
        if (this.currentPlayer) {
            return this.currentPlayer;
        }

        const userId = authService?.getCurrentUser()?.id;
        return this.getDefaultPlayerData(userId || 'player_12345');
    }

    async updatePlayerStats(playerId, statsUpdate) {
        try {
            await this._firebaseReady;

            const existing = (await this.getPlayerDoc(playerId)) || this.getDefaultPlayerData(playerId);
            const updated = {
                ...existing,
                stats: {
                    ...existing.stats,
                    ...statsUpdate
                },
                updatedAt: new Date().toISOString()
            };

            await this.setPlayerDoc(playerId, updated, false);
            this.currentPlayer = updated;
            this.cachePlayer(playerId, updated);
            return updated;
        } catch (error) {
            console.error('Error updating player stats:', error);
            return this.currentPlayer;
        }
    }

    async getInventory(playerId) {
        const player = await this.initializePlayer(playerId);
        return player.inventory || [];
    }

    async getEquipment(playerId) {
        const player = await this.initializePlayer(playerId);
        return player.equipment || [];
    }

    async getDailyChallenges(playerId) {
        const player = await this.initializePlayer(playerId);
        return player.dailyChallenges || [];
    }

    async getActiveQuests(playerId) {
        const player = await this.initializePlayer(playerId);
        return player.activeQuests || [];
    }

    async getBattleHistory(playerId, limit = 10) {
        const player = await this.initializePlayer(playerId);
        return (player.battleHistory || []).slice(0, limit);
    }

    async getLeaderboardRanking(playerId) {
        const player = await this.initializePlayer(playerId);
        return player.leaderboard || null;
    }

    async getAchievements(playerId) {
        const player = await this.initializePlayer(playerId);
        return player.achievements || [];
    }

    async updateSettings(playerId, settings) {
        try {
            await this._firebaseReady;

            const existing = (await this.getPlayerDoc(playerId)) || this.getDefaultPlayerData(playerId);
            const updated = {
                ...existing,
                settings: {
                    ...(existing.settings || {}),
                    ...settings
                },
                updatedAt: new Date().toISOString()
            };

            await this.setPlayerDoc(playerId, updated, false);
            this.currentPlayer = updated;
            this.cachePlayer(playerId, updated);

            return updated.settings;
        } catch (error) {
            console.error('Error updating settings:', error);
            return null;
        }
    }

    async updatePlayerProfile(playerId, updates) {
        try {
            await this._firebaseReady;

            const existing = (await this.getPlayerDoc(playerId)) || this.getDefaultPlayerData(playerId);
            const updated = {
                ...existing,
                ...updates,
                updatedAt: new Date().toISOString()
            };

            await this.setPlayerDoc(playerId, updated, false);
            this.currentPlayer = updated;
            this.cachePlayer(playerId, updated);
            return updated;
        } catch (error) {
            console.error('Error updating player profile:', error);
            throw error;
        }
    }
}

const playerService = new PlayerService();
window.playerService = playerService;
