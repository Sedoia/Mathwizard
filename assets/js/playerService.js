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
                gold: 500,
                crystals: 50,
                energy: {
                    current: 100,
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

    async getPlayerDoc(playerId) {
        const doc = await window.firebaseDb.collection('players').doc(playerId).get();
        return doc.exists ? doc.data() : null;
    }

    async setPlayerDoc(playerId, payload, merge = true) {
        await window.firebaseDb.collection('players').doc(playerId).set(payload, { merge });
    }

    cachePlayer(playerId, data) {
        sessionStorage.setItem(`player_${playerId}`, JSON.stringify(data));
    }

    shouldResetNewAccountProgress(currentUser, playerData) {
        if (!currentUser || currentUser.role === 'admin') {
            return false;
        }

        const isNewAccount = Number(currentUser.level || 1) <= 1;
        if (!isNewAccount) {
            return false;
        }

        const suspiciousLevel = Number(playerData.level || 1) > 1;
        const suspiciousStreak = Number(playerData?.streak?.current || 0) > 30;
        const suspiciousWins = Number(playerData?.stats?.challengesWon || 0) > 0;
        const suspiciousAchievements = Array.isArray(playerData?.achievements)
            && playerData.achievements.some(a => a.unlocked);

        return suspiciousLevel || suspiciousStreak || suspiciousWins || suspiciousAchievements;
    }

    buildCleanStarterData(playerId, currentUser) {
        const starter = this.getDefaultPlayerData(playerId);
        return {
            ...starter,
            name: currentUser?.name || starter.name,
            level: Number(currentUser?.level || 1),
            currency: {
                ...starter.currency,
                gold: Number(currentUser?.gold || starter.currency.gold),
                crystals: Number(currentUser?.crystals || starter.currency.crystals),
                energy: {
                    ...starter.currency.energy,
                    current: Number(currentUser?.energy || starter.currency.energy.current)
                }
            },
            updatedAt: new Date().toISOString()
        };
    }

    async initializePlayer(playerId) {
        try {
            await this._firebaseReady;

            const currentUser = authService?.getCurrentUser?.() || null;

            const cachedPlayer = sessionStorage.getItem(`player_${playerId}`);
            if (cachedPlayer) {
                const cachedData = JSON.parse(cachedPlayer);
                if (this.shouldResetNewAccountProgress(currentUser, cachedData)) {
                    sessionStorage.removeItem(`player_${playerId}`);
                } else {
                    this.currentPlayer = cachedData;
                    this.isInitialized = true;
                    return this.currentPlayer;
                }
            }

            let playerData = await this.getPlayerDoc(playerId);

            if (!playerData) {
                playerData = this.buildCleanStarterData(playerId, currentUser);
                await this.setPlayerDoc(playerId, playerData, false);
            } else if (this.shouldResetNewAccountProgress(currentUser, playerData)) {
                playerData = this.buildCleanStarterData(playerId, currentUser);
                await this.setPlayerDoc(playerId, playerData, false);
            }

            this.currentPlayer = playerData;
            this.cachePlayer(playerId, playerData);
            this.isInitialized = true;

            return playerData;
        } catch (error) {
            console.error('Error initializing player:', error);
            return this.getDefaultPlayerData(playerId);
        }
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
