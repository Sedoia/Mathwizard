/**
 * Profile Renderer - Renders dynamic player data to the profile page
 * Updates all DOM elements based on playerService data
 */

class ProfileRenderer {
    constructor() {
        this.playerData = null;
        this.renderedTabs = new Set();
    }

    escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    sanitizeIcon(iconName, fallback = 'fa-wizard') {
        const icon = String(iconName || '').trim();
        return /^fa-[a-z0-9-]+$/i.test(icon) ? icon : fallback;
    }

    sanitizeImageUrl(url) {
        const candidate = String(url || '').trim();
        if (!candidate) {
            return '';
        }

        if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,[a-z0-9+/=]+$/i.test(candidate)) {
            return candidate;
        }

        try {
            const parsed = new URL(candidate, window.location.origin);
            if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
                return parsed.href;
            }
        } catch (error) {
            return '';
        }

        return '';
    }

    /**
     * Initialize and render profile with player data
     * @param {Object} playerData - Player data from playerService
     */
    async render(playerData) {
        this.playerData = playerData;
        
        // Render sections in order
        this.renderCharacterCard();
        this.renderDailyStreak();
        this.renderStats();
        this.renderCurrency();
        this.renderDailyChallenges();
        this.renderActiveQuests();
        this.renderInventory();
        this.renderEquipment();
        this.renderBattleHistory();
        this.renderLeaderboard();
        this.renderAchievements();
        this.renderedTabs.clear();
        
        console.log('✨ Profile rendered with dynamic data');
    }

    /**
     * Render expensive tab content only when a tab is opened.
     * @param {string} tabName - Tab key (statistics, purchases, achievements)
     * @param {boolean} [force=false] - Force re-render even if previously rendered
     */
    renderTabContent(tabName, force = false) {
        if (!tabName) {
            return;
        }

        if (force) {
            this.renderedTabs.delete(tabName);
        }

        if (this.renderedTabs.has(tabName)) {
            return;
        }

        if (tabName === 'statistics') {
            this.renderStatisticsTab();
            this.renderedTabs.add(tabName);
            return;
        }

        if (tabName === 'purchases') {
            this.renderPurchasesTab();
            this.renderedTabs.add(tabName);
            return;
        }

        if (tabName === 'achievements') {
            this.renderAllAchievementsTab();
            this.renderedTabs.add(tabName);
        }
    }

    /**
     * Render character card information
     */
    renderCharacterCard() {
        const data = this.playerData;
        const safeTitle = this.escapeHtml(data.title);
        const safeRankName = this.escapeHtml(data.rank?.name);
        const safeRankPercentile = this.escapeHtml(data.rank?.percentile);
        
        // Update name and title
        const nameEl = document.getElementById('player-name') || document.querySelector('.font-magic.text-2xl');
        if (nameEl) nameEl.textContent = data.name;

        const usernameEl = document.getElementById('player-username');
        if (usernameEl) {
            const username = data.username || window.authService?.getCurrentUser?.()?.username || '';
            usernameEl.textContent = username ? `@${String(username).replace(/^@+/, '')}` : '';
        }
        
        const titleEl = document.getElementById('player-role') || document.querySelector('.text-ncst-neon.text-sm.font-bold');
        if (titleEl) {
            titleEl.textContent = data.title || '';
            const crown = document.createElement('i');
            crown.className = 'fa-solid fa-crown text-ncst-gold ml-1';
            titleEl.appendChild(document.createTextNode(' '));
            titleEl.appendChild(crown);
        }

        // Update rank badge
        const rankBadge = document.querySelector('[class*="border-ncst-gold/50"]');
        if (rankBadge) {
            rankBadge.innerHTML = `
                <div class="flex items-center justify-center gap-2 mb-2">
                    <i class="fa-solid fa-star text-ncst-gold"></i>
                    <span class="text-xs uppercase tracking-wider text-ncst-gold font-bold">${safeRankName} Rank</span>
                    <i class="fa-solid fa-star text-ncst-gold"></i>
                </div>
                <div class="text-xs text-gray-400">Top ${safeRankPercentile} Players</div>
            `;
        }

        // Update level
        const levelEl = document.getElementById('player-level') || document.querySelector('.text-2xl.font-bold.text-ncst-gold');
        if (levelEl) levelEl.textContent = data.level;

        // Update member since date
        const memberEl = document.getElementById('player-member-since') || document.querySelector('.text-ncst-neon.font-bold.text-xs');
        if (memberEl) memberEl.textContent = data.memberSince;

        // Update avatar (image if present, icon fallback)
        const avatarContainer = document.getElementById('player-avatar-container');
        if (avatarContainer) {
            const safeAvatarUrl = this.sanitizeImageUrl(data.avatarUrl);
            if (safeAvatarUrl) {
                avatarContainer.innerHTML = `<img src="${safeAvatarUrl}" alt="Avatar" class="w-full h-full object-cover rounded-full">`;
            } else {
                const safeIcon = this.sanitizeIcon(data.avatar, 'fa-wizard');
                avatarContainer.innerHTML = `<i class="fa-solid ${safeIcon} text-4xl sm:text-5xl text-ncst-gold"></i>`;
            }
        }

        // Update online status
        const onlineStatus = document.querySelector('.text-xs.font-bold.text-white');
        if (onlineStatus) {
            onlineStatus.textContent = data.online ? 'ONLINE' : 'OFFLINE';
        }
    }

    /**
     * Render daily streak information
     */
    renderDailyStreak() {
        const streak = this.playerData.streak || {};
        const current = Number(streak.current || 0);
        const best = Number(streak.best || current || 0);

        const panel = document.getElementById('daily-streak-panel');
        if (panel) {
            panel.innerHTML = `
                <p class="font-heading text-xs uppercase tracking-wider mb-2" style="color:#d4a843;"><i class="fa-solid fa-fire text-ncst-gold mr-1"></i>Current Streak</p>
                <p class="text-3xl font-bold text-ncst-gold runic-glow">${current} Day${current === 1 ? '' : 's'}</p>
                <p class="font-flavor italic text-xs mt-1" style="color:#a08060;">${best > 0 ? `Best: ${best} day${best === 1 ? '' : 's'}` : 'Play today to start your streak!'}</p>
            `;
        }
    }

    /**
     * Render player stats section
     */
    renderStats() {
        const stats = this.playerData.stats || {};
        const level = Number(this.playerData.level || 1);

        const xpLevelLabel = document.getElementById('xp-level-label');
        if (xpLevelLabel) {
            xpLevelLabel.textContent = `Experience to Level ${level + 1}`;
        }
        
        // Update XP bar
        const xp = Number(stats.xp || 0);
        const maxXp = Number(stats.maxXp || 1000);
        const xpWidth = Math.min(100, Math.max(0, (xp / maxXp) * 100));
        const xpBar = document.getElementById('xp-bar');
        if (xpBar) {
            xpBar.style.width = `${xpWidth}%`;
        }

        // Update XP text
        const xpText = document.getElementById('xp-text');
        if (xpText) {
            xpText.textContent = `${xp.toLocaleString()} / ${maxXp.toLocaleString()} XP`;
        }

        const setText = (id, value) => {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = value;
            }
        };

        setText('stat-calc-power', String(stats.calcPower ?? (10 + (level - 1) * 5)));
        setText('stat-accuracy', `${Number(stats.accuracy || 0).toFixed(1)}%`);
        setText('stat-challenges', Number(stats.challengesWon || 0).toLocaleString());
        setText('stat-play-time', `${Number(stats.playTime || 0).toFixed(1)}h`);
    }

    /**
     * Render currency section
     */
    renderCurrency() {
        const currency = this.playerData.currency || {};

        const goldEl = document.getElementById('player-gold');
        if (goldEl) {
            goldEl.textContent = Number(currency.aether ?? currency.gold ?? this.playerData.gold ?? 0).toLocaleString();
        }

        const crystalsEl = document.getElementById('player-crystals');
        if (crystalsEl) {
            const numeralsVal = Number(currency.numerals ?? currency.crystals ?? this.playerData.numerals ?? this.playerData.crystals ?? 0);
            crystalsEl.textContent = numeralsVal.toLocaleString();
        }

        const energyEl = document.getElementById('player-energy');
        if (energyEl) {
            const current = Number(currency.energy?.current ?? currency.energy ?? this.playerData.energy ?? 100);
            const max = Number(currency.energy?.max ?? 100);
            energyEl.textContent = `${current} / ${max}`;
        }
    }

    /**
     * Render daily challenges section
     */
    renderDailyChallenges() {
        const challenges = this.playerData.dailyChallenges;
        const container = document.getElementById('daily-challenges-list');
        
        if (container) {
            let html = '';
            challenges.forEach(challenge => {
                const percent = (challenge.progress / challenge.max) * 100;
                const safeName = this.escapeHtml(challenge.name);
                const safeReward = this.escapeHtml(challenge.reward);
                const safeIcon = this.sanitizeIcon(challenge.icon, 'fa-star');
                const progress = Number(challenge.progress || 0);
                const max = Number(challenge.max || 0);
                html += `
                    <div class="glass-panel p-4 rounded-lg border-l-4 border-ncst-neon">
                        <div class="flex justify-between items-start mb-2">
                            <div>
                                <h4 class="font-bold text-white">${safeName}</h4>
                                <p class="text-sm text-gray-400">Reward: ${safeReward}</p>
                            </div>
                            <i class="fa-solid ${safeIcon} text-ncst-neon"></i>
                        </div>
                        <div class="w-full bg-ncst-dark/50 rounded-full h-2">
                            <div class="bg-ncst-neon rounded-full h-2" style="width: ${percent}%"></div>
                        </div>
                        <div class="text-xs text-gray-400 mt-2">${progress}/${max}</div>
                    </div>
                `;
            });
            container.innerHTML = html;
        }
    }

    /**
     * Render active quests section
     */
    renderActiveQuests() {
        const quests = this.playerData.activeQuests;
        const container = document.getElementById('active-quests-list');
        
        if (container) {
            let html = '';
            const questTypes = { main: 'Main Quest', side: 'Side Quest', bonus: 'Bonus Quest' };
            
            quests.forEach(quest => {
                const percent = (quest.progress / quest.max) * 100;
                const borderColor = quest.type === 'main' ? 'ncst-gold' : quest.type === 'side' ? 'ncst-neon' : 'ncst-accent';
                const safeName = this.escapeHtml(quest.name);
                const safeDesc = this.escapeHtml(quest.description);
                const progress = Number(quest.progress || 0);
                const max = Number(quest.max || 0);
                html += `
                    <div class="glass-panel p-4 rounded-lg border-l-4 border-${borderColor}">
                        <div class="flex justify-between items-start mb-2">
                            <div>
                                <span class="text-xs uppercase text-${borderColor} font-bold">${questTypes[quest.type]}</span>
                                <h4 class="font-bold text-white">${safeName}</h4>
                                <p class="text-xs text-gray-400">${safeDesc}</p>
                            </div>
                        </div>
                        <div class="w-full bg-ncst-dark/50 rounded-full h-2">
                            <div class="bg-${borderColor} rounded-full h-2" style="width: ${percent}%"></div>
                        </div>
                        <div class="text-xs text-gray-400 mt-2">${progress}/${max}</div>
                    </div>
                `;
            });
            container.innerHTML = html;
        }
    }

    /**
     * Render inventory section
     */
    renderInventory() {
        const inventory = this.playerData.inventory;
        const container = document.getElementById('inventory-list');
        
        if (container) {
            let html = '';
            inventory.forEach(item => {
                const safeName = this.escapeHtml(item.name);
                const safeRarity = this.escapeHtml(item.rarity);
                const safeIcon = this.sanitizeIcon(item.icon, 'fa-box');
                const qty = Number(item.quantity || 0);
                html += `
                    <div class="flex items-center justify-between p-4 glass-panel rounded-lg hover:border-ncst-neon transition-all cursor-pointer">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 bg-ncst-neon/20 rounded flex items-center justify-center">
                            <i class="fa-solid ${safeIcon} text-ncst-neon text-xl"></i>
                            </div>
                            <div>
                                <p class="font-bold text-white">${safeName}</p>
                                <p class="text-xs text-gray-400">${safeRarity}</p>
                            </div>
                        </div>
                        <span class="text-ncst-neon font-bold">x${qty}</span>
                    </div>
                `;
            });
            container.innerHTML = html;
        }
    }

    /**
     * Render equipment section
     */
    renderEquipment() {
        const equipment = this.playerData.equipment;
        const container = document.getElementById('equipment-list');
        
        if (container) {
            let html = '';
            equipment.forEach(item => {
                const safeSlot = this.escapeHtml(item.slot);
                const safeItemName = this.escapeHtml(item.item);
                const safeStats = this.escapeHtml(item.stats);
                const safeRarity = this.escapeHtml(item.rarity);
                html += `
                    <div class="p-4 glass-panel rounded-lg border-l-4 border-ncst-gold">
                        <p class="text-xs uppercase text-gray-400 mb-2">${safeSlot}</p>
                        <p class="font-bold text-white">${safeItemName}</p>
                        <p class="text-xs text-ncst-gold mt-1">${safeStats}</p>
                        <p class="text-xs text-gray-400 mt-1">${safeRarity}</p>
                    </div>
                `;
            });
            container.innerHTML = html;
        }
    }

    /**
     * Render battle history section
     */
    renderBattleHistory() {
        const battles = this.playerData.battleHistory;
        const container = document.getElementById('battle-history-list');
        
        if (container) {
            let html = '';
            battles.forEach(battle => {
                const borderColor = battle.result === 'WIN' ? 'border-green-500' : 'border-red-500';
                const resultColor = battle.result === 'WIN' ? 'text-green-500' : 'text-red-500';
                const safeOpponent = this.escapeHtml(battle.opponent);
                const safeDate = this.escapeHtml(battle.date);
                const safeDifficulty = this.escapeHtml(battle.difficulty);
                const safeResult = this.escapeHtml(battle.result);
                html += `
                    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 glass-panel rounded-lg ${borderColor} border-l-4 gap-3">
                        <div class="min-w-0">
                                <h4 class="font-bold text-white text-xs sm:text-sm truncate">${safeOpponent}</h4>
                                <p class="text-xs text-gray-400">${safeDate} • Difficulty: ${safeDifficulty}</p>
                            </div>
                            <span class="${resultColor} font-bold text-sm flex-shrink-0">${safeResult}</span>
                    </div>
                `;
            });

            if (!html) {
                html = '<p class="text-sm text-gray-400">No battles yet. Start your first challenge.</p>';
            }

            container.innerHTML = html;
        }
    }

    /**
     * Render leaderboard ranking section
     */
    renderLeaderboard() {
        const lb = this.playerData.leaderboard;
        const container = document.getElementById('leaderboard-panel');
        
        if (container) {
            const safeRegion = this.escapeHtml(lb?.regional?.region);
            const safeSchool = this.escapeHtml(lb?.school?.school);
            const safeNextRank = this.escapeHtml(lb?.nextRank?.name);
            const progress = lb.nextRank.pointsNeeded <= 0
                ? 100
                : Math.max(0, Math.min(100, (lb.nextRank.currentPoints / (lb.nextRank.currentPoints + lb.nextRank.pointsNeeded)) * 100));

            container.innerHTML = `
                <h3 class="font-magic text-xl sm:text-2xl text-ncst-gold text-gold-glow mb-4">
                    <i class="fa-solid fa-chart-line text-ncst-gold mr-2"></i>Leaderboard
                </h3>
                <div class="text-center mb-6">
                    <p class="text-xs sm:text-sm text-gray-400 mb-2">Global Rank</p>
                    <p class="text-4xl sm:text-5xl font-bold text-ncst-gold">#${lb.global.rank}</p>
                    <p class="text-xs text-gray-500 mt-2">Out of ${lb.global.totalPlayers.toLocaleString()} Players</p>
                </div>
                <div class="space-y-2 text-xs">
                    <div class="flex justify-between items-center">
                        <span class="text-gray-400">Regional Rank</span>
                        <span class="text-ncst-neon font-bold">#${lb.regional.rank} (${safeRegion})</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-400">School Rank</span>
                        <span class="text-ncst-neon font-bold">#${lb.school.rank} (${safeSchool})</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-400">Total Points</span>
                        <span class="text-ncst-gold font-bold">${lb.global.points.toLocaleString()} pts</span>
                    </div>
                </div>
                <div class="parchment-panel p-4 border-2 border-ncst-neon/30 mt-6">
                    <h4 class="font-heading text-ncst-neon mb-3 text-xs uppercase tracking-wider">
                        <i class="fa-solid fa-arrow-up mr-2"></i>Next Rank: ${safeNextRank}
                    </h4>
                    <p class="text-xs text-gray-400 mb-3">${lb.nextRank.pointsNeeded.toLocaleString()} points away</p>
                    <div class="h-2 bg-ncst-dark/50 rounded-full overflow-hidden">
                        <div class="h-full bg-gradient-to-r from-ncst-neon to-ncst-gold" style="width: ${progress}%"></div>
                    </div>
                </div>
            `;
        }
    }

    /**
     * Render achievements section
     */
    renderAchievements() {
        const achievements = this.playerData.achievements || [];
        const container = document.getElementById('recent-achievements-grid');
        
        if (container) {
            if (!achievements.length) {
                container.innerHTML = '<div class="col-span-full text-center text-gray-400 py-4">No achievements available. Complete challenges in the game to unlock achievements!</div>';
                return;
            }

            let html = '';
            // Display top 4 achievements (prioritizing unlocked ones)
            const sorted = [...achievements].sort((a, b) => (b.unlocked ? 1 : 0) - (a.unlocked ? 1 : 0)).slice(0, 4);

            sorted.forEach(achievement => {
                const unlocked = !!achievement.unlocked;
                const safeName = this.escapeHtml(achievement.name);
                const safeDescription = this.escapeHtml(achievement.description);
                const safeDate = achievement.date ? this.escapeHtml(achievement.date) : '';
                const safeIcon = this.sanitizeIcon(achievement.icon, 'fa-medal');
                html += `
                    <div class="p-4 glass-panel rounded-lg text-center border transition-all cursor-pointer ${unlocked ? 'border-ncst-gold/40 hover:border-ncst-gold shadow-[0_0_12px_rgba(201,168,76,0.15)]' : 'border-white/10 opacity-60'}"
                         title="${unlocked ? (safeDate ? 'Unlocked: ' + safeDate : 'Unlocked') : 'In progress: complete in-game challenge'}">
                        <div class="text-3xl mb-2"><i class="fa-solid ${safeIcon} ${unlocked ? 'text-ncst-gold' : 'text-gray-500'}"></i></div>
                        <p class="font-bold text-white text-sm mb-1 truncate">${safeName}</p>
                        <p class="text-xs text-gray-400 line-clamp-2">${safeDescription}</p>
                        <span class="inline-block mt-2 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${unlocked ? 'bg-ncst-gold/20 text-ncst-gold' : 'bg-gray-700/50 text-gray-400'}">
                            ${unlocked ? 'Unlocked' : 'Locked'}
                        </span>
                    </div>
                `;
            });
            container.innerHTML = html;
        }
    }

    renderStatisticsTab() {
        const tab = document.getElementById('profile-tab-statistics');
        if (!tab) {
            return;
        }

        const stats = this.playerData.stats || {};
        const currency = this.playerData.currency || {};
        const streak = this.playerData.streak || {};

        const solved = Number(stats.challengesWon || 0);
        const accuracy = Number(stats.accuracy || 0);
        const hours = Number(stats.playTime || 0);
        const currentStreak = Number(streak.current || 0);
        const bestStreak = Number(streak.best || currentStreak || 0);
        const crystals = Number(currency.numerals ?? currency.crystals ?? this.playerData.numerals ?? this.playerData.crystals ?? 0);
        const energyCurrent = Number(currency.energy?.current ?? currency.energy ?? this.playerData.energy ?? 100);
        const energyMax = Number(currency.energy?.max ?? 100);

        const baseMastery = solved > 0 ? accuracy : 0;
        const derivativeScore = Math.min(100, Math.max(0, Math.round(baseMastery)));
        const integralScore = Math.min(100, Math.max(0, Math.round(baseMastery * 0.92)));
        const limitsScore = Math.min(100, Math.max(0, Math.round(baseMastery * 0.88)));
        const applicationsScore = Math.min(100, Math.max(0, Math.round(baseMastery * 0.85)));
        const seriesScore = Math.min(100, Math.max(0, Math.round(baseMastery * 0.78)));

        tab.innerHTML = `
            <div class="parchment-panel p-6 sm:p-8 mb-8">
                <h3 class="font-magic text-2xl text-ncst-gold text-gold-glow mb-6">
                    <i class="fa-solid fa-chart-line text-ncst-gold mr-2"></i>Detailed Statistics
                </h3>

                <!-- Primary Metrics -->
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div class="parchment-panel p-4 text-center border-t-4 border-ncst-neon">
                        <p class="text-3xl font-bold text-ncst-neon runic-glow">${solved.toLocaleString()}</p>
                        <p class="text-xs text-gray-400 uppercase tracking-wider mt-1">Problems Solved</p>
                    </div>
                    <div class="parchment-panel p-4 text-center border-t-4 border-ncst-gold">
                        <p class="text-3xl font-bold text-ncst-gold runic-glow">${accuracy.toFixed(1)}%</p>
                        <p class="text-xs text-gray-400 uppercase tracking-wider mt-1">Accuracy Rate</p>
                    </div>
                    <div class="parchment-panel p-4 text-center border-t-4 border-ncst-accent">
                        <p class="text-3xl font-bold text-ncst-accent runic-glow">${hours.toFixed(1)}h</p>
                        <p class="text-xs text-gray-400 uppercase tracking-wider mt-1">Time Spent</p>
                    </div>
                    <div class="parchment-panel p-4 text-center border-t-4 border-green-400">
                        <p class="text-3xl font-bold text-green-400 runic-glow">${bestStreak}</p>
                        <p class="text-xs text-gray-400 uppercase tracking-wider mt-1">Best Win Streak</p>
                    </div>
                </div>

                <!-- Secondary Resources Status -->
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                    <div class="p-4 glass-panel rounded-lg flex items-center justify-between border border-ncst-neon/30">
                        <div>
                            <p class="text-xs text-gray-400 uppercase tracking-wider">Numerals</p>
                            <p class="text-xl font-bold text-ncst-neon">${crystals.toLocaleString()}</p>
                        </div>
                        <i class="fa-solid fa-gem text-2xl text-ncst-neon/60"></i>
                    </div>
                    <div class="p-4 glass-panel rounded-lg flex items-center justify-between border border-ncst-accent/30">
                        <div>
                            <p class="text-xs text-gray-400 uppercase tracking-wider">Mana Energy</p>
                            <p class="text-xl font-bold text-ncst-accent">${energyCurrent} / ${energyMax}</p>
                        </div>
                        <i class="fa-solid fa-zap text-2xl text-ncst-accent/60"></i>
                    </div>
                    <div class="p-4 glass-panel rounded-lg flex items-center justify-between border border-ncst-gold/30">
                        <div>
                            <p class="text-xs text-gray-400 uppercase tracking-wider">Active Streak</p>
                            <p class="text-xl font-bold text-ncst-gold">${currentStreak} Day${currentStreak === 1 ? '' : 's'}</p>
                        </div>
                        <i class="fa-solid fa-fire text-2xl text-ncst-gold/60"></i>
                    </div>
                </div>

                <h4 class="font-bold text-white mb-4 text-sm uppercase tracking-wider">Performance by Topic</h4>
                <div class="space-y-4">
                    ${this.renderTopicBar('Derivatives & Rates of Change', derivativeScore, 'from-ncst-neon to-green-400', 'text-ncst-neon')}
                    ${this.renderTopicBar('Integrals & Area Calculations', integralScore, 'from-ncst-gold to-yellow-400', 'text-ncst-gold')}
                    ${this.renderTopicBar('Limits & Continuity', limitsScore, 'from-blue-400 to-blue-500', 'text-blue-400')}
                    ${this.renderTopicBar('Applications of Derivatives', applicationsScore, 'from-purple-400 to-purple-500', 'text-purple-400')}
                    ${this.renderTopicBar('Series & Sequences', seriesScore, 'from-ncst-accent to-pink-400', 'text-ncst-accent')}
                </div>
            </div>
        `;
    }

    renderTopicBar(label, value, gradientClass, textClass) {
        return `
            <div>
                <div class="flex justify-between text-sm mb-1">
                    <span class="text-gray-400">${label}</span>
                    <span class="${textClass} font-bold">${value}%</span>
                </div>
                <div class="h-3 bg-ncst-dark/50 rounded-full overflow-hidden">
                    <div class="h-full bg-gradient-to-r ${gradientClass} rounded-full" style="width: ${value}%"></div>
                </div>
            </div>
        `;
    }

    renderPurchasesTab() {
        const tab = document.getElementById('profile-tab-purchases');
        if (!tab) {
            return;
        }

        const purchases = this.playerData.purchaseHistory || (window.authService?.getCurrentUser?.()?.purchaseHistory || []);
        const totalSpent = purchases.reduce((sum, p) => sum + Number(p.amount || p.price || 0), 0);
        const totalAether = purchases.reduce((sum, p) => sum + Number(p.aether || p.credits || 0), 0);

        const purchasesHtml = purchases.length
            ? purchases.map((purchase) => `
                <div class="glass-panel p-4 rounded-lg border-l-4 border-ncst-gold hover:border-ncst-neon transition-all">
                    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div>
                            <p class="font-bold text-white">${this.escapeHtml(purchase.itemName || purchase.name || 'Purchase')}</p>
                            <p class="text-xs text-ncst-neon">${Number(purchase.aether || purchase.credits || 0).toLocaleString()} Aether</p>
                            <p class="text-xs text-gray-400">${this.escapeHtml(purchase.date ? new Date(purchase.date).toLocaleString() : 'Recent purchase')}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-ncst-neon font-bold">${purchase.amount ? `PHP ${Number(purchase.amount).toFixed(2)}` : 'N/A'}</p>
                            <span class="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded">${this.escapeHtml(purchase.status || 'Completed')}</span>
                        </div>
                    </div>
                </div>
            `).join('')
            : '<div class="glass-panel p-6 rounded-lg text-center text-gray-400">No purchases yet. Your transaction history will appear here.</div>';

        tab.innerHTML = `
            <div class="parchment-panel p-6 sm:p-8 mb-8">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <h3 class="font-magic text-2xl text-ncst-gold text-gold-glow">
                        <i class="fa-solid fa-receipt text-ncst-gold mr-2"></i>Purchase History
                    </h3>
                    <div class="text-sm text-gray-400">
                        <span>Total Aether: <span class="text-ncst-gold font-bold">${totalAether.toLocaleString()}</span></span>
                        <span>Total Spent: <span class="text-ncst-gold font-bold">PHP ${totalSpent.toFixed(2)}</span></span>
                    </div>
                </div>
                <div class="space-y-4">${purchasesHtml}</div>
            </div>
        `;
    }

    renderSkinsTab() {
        const tab = document.getElementById('profile-tab-skins');
        if (!tab) {
            return;
        }

        const currentUser = window.authService?.getCurrentUser?.() || {};
        const unlockedSkins = currentUser.unlockedSkins || ['default_wizard'];
        const equippedSkin = currentUser.equippedSkin || 'default_wizard';

        const skinCatalog = {
            default_wizard: { label: 'Default Wizard', rarity: 'Common', icon: 'fa-wand-magic-sparkles', color: 'text-ncst-gold' },
            dragon_mage: { label: 'Dragon Mage', rarity: 'Legendary', icon: 'fa-hat-wizard', color: 'text-ncst-accent' },
            space_scholar: { label: 'Space Scholar', rarity: 'Epic', icon: 'fa-user-astronaut', color: 'text-blue-400' },
            phantom_wizard: { label: 'Phantom Wizard', rarity: 'Epic', icon: 'fa-ghost', color: 'text-purple-400' },
            forest_sage: { label: 'Forest Sage', rarity: 'Rare', icon: 'fa-leaf', color: 'text-green-400' },
            fire_mage: { label: 'Fire Mage', rarity: 'Rare', icon: 'fa-fire-flame-curved', color: 'text-orange-400' },
            ice_wizard: { label: 'Ice Wizard', rarity: 'Rare', icon: 'fa-snowflake', color: 'text-blue-400' },
            classic_scholar: { label: 'Classic Scholar', rarity: 'Common', icon: 'fa-user-graduate', color: 'text-gray-300' }
        };

        const unlockedHtml = unlockedSkins.map((skinId) => {
            const skin = skinCatalog[skinId] || { label: skinId, rarity: 'Unknown', icon: 'fa-user', color: 'text-gray-300' };
            const safeLabel = this.escapeHtml(skin.label);
            const safeRarity = this.escapeHtml(skin.rarity);
            const safeIcon = this.sanitizeIcon(skin.icon, 'fa-user');
            const equippedBadge = equippedSkin === skinId
                ? '<div class="absolute top-2 right-2 bg-ncst-gold px-2 py-1 rounded text-xs text-ncst-dark font-bold">EQUIPPED</div>'
                : '';
            return `
                <div class="glass-panel p-4 rounded-lg border border-ncst-neon/30 text-center relative">
                    ${equippedBadge}
                    <div class="w-16 h-16 mx-auto mb-3 bg-white/5 rounded-full flex items-center justify-center">
                        <i class="fa-solid ${safeIcon} ${skin.color} text-2xl"></i>
                    </div>
                    <p class="font-bold text-white text-sm">${safeLabel}</p>
                    <p class="text-xs text-gray-400">${safeRarity}</p>
                </div>
            `;
        }).join('');

        tab.innerHTML = `
            <div class="parchment-panel p-6 sm:p-8 mb-8">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <h3 class="font-magic text-2xl text-ncst-gold text-gold-glow">
                        <i class="fa-solid fa-shirt text-ncst-accent mr-2"></i>Skins Collection
                    </h3>
                    <div class="text-sm text-gray-400">
                        Unlocked: <span class="text-ncst-accent font-bold">${unlockedSkins.length}/24</span>
                    </div>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">${unlockedHtml}</div>
            </div>
        `;
    }

    renderAllAchievementsTab() {
        const tab = document.getElementById('profile-tab-achievements');
        if (!tab) {
            return;
        }

        const achievements = this.playerData.achievements || [];
        const unlockedCount = achievements.filter(a => a.unlocked).length;
        const points = unlockedCount * 50;

        const achievementsHtml = achievements.map((achievement) => {
            const unlocked = !!achievement.unlocked;
            const safeName = this.escapeHtml(achievement.name);
            const safeDescription = this.escapeHtml(achievement.description);
            const safeIcon = this.sanitizeIcon(achievement.icon, 'fa-medal');
            return `
                <div class="glass-panel p-4 rounded-lg text-center border ${unlocked ? 'border-ncst-gold/50' : 'border-gray-600/30 opacity-50'}">
                    <div class="text-4xl mb-2"><i class="fa-solid ${safeIcon} ${unlocked ? 'text-ncst-gold' : 'text-gray-500'}"></i></div>
                    <p class="font-bold ${unlocked ? 'text-white' : 'text-gray-500'} text-sm mb-1">${safeName}</p>
                    <p class="text-xs ${unlocked ? 'text-gray-400' : 'text-gray-600'}">${safeDescription}</p>
                    <p class="text-xs mt-2 ${unlocked ? 'text-ncst-neon' : 'text-gray-600'}">${unlocked ? '+50 pts' : 'Locked'}</p>
                </div>
            `;
        }).join('');

        tab.innerHTML = `
            <div class="parchment-panel p-6 sm:p-8 mb-8">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <h3 class="font-magic text-2xl text-ncst-gold text-gold-glow">
                        <i class="fa-solid fa-trophy text-ncst-gold mr-2"></i>All Achievements
                    </h3>
                    <div class="flex gap-4 text-sm">
                        <span class="text-gray-400">Unlocked: <span class="text-ncst-gold font-bold">${unlockedCount}/${achievements.length}</span></span>
                        <span class="text-gray-400">Points: <span class="text-ncst-neon font-bold">${points}</span></span>
                    </div>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    ${achievementsHtml || '<div class="col-span-full text-gray-400">No achievements configured.</div>'}
                </div>
            </div>
        `;
    }
}

// Export singleton instance
const profileRenderer = new ProfileRenderer();
window.profileRenderer = profileRenderer;
