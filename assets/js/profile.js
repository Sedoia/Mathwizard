document.addEventListener('DOMContentLoaded', async () => {
    // ============================================================================
    // DYNAMIC DATA LOADING & INITIALIZATION
    // ============================================================================
    
    // Check authentication
    if (!authService.isAuthenticated()) {
        console.warn('User not authenticated. Redirecting to auth page...');
        window.location.href = 'auth.html';
        return;
    }

    // Get current user and player ID
    let currentUser = authService.getCurrentUser();
    const playerId = currentUser?.id || 'player_12345';

    // Refresh user document from Firestore to sync latest session data
    if (typeof authService.refreshCurrentUser === 'function') {
        try {
            currentUser = (await authService.refreshCurrentUser()) || currentUser;
        } catch (e) {
            console.warn('User session refresh warning:', e);
        }
    }

    // Initialize player data from database
    console.log('📊 Loading player data from database...');
    let playerData = await playerService.initializePlayer(playerId);

    // Render profile with dynamic data
    console.log('🎨 Rendering profile with dynamic data...');
    await profileRenderer.render(playerData);

    // Subscribe to live Firestore database updates from the game
    if (typeof playerService.subscribeToPlayer === 'function') {
        playerService.subscribeToPlayer(playerId, (freshData) => {
            console.log('🔄 Real-time game database update received');
            playerData = freshData;
            profileRenderer.render(freshData);

            // If a tab is open, update its content with live data
            const activeTabBtn = document.querySelector('.profile-tab.active');
            const activeTabName = activeTabBtn ? activeTabBtn.getAttribute('data-tab') : 'overview';
            if (activeTabName && activeTabName !== 'overview') {
                profileRenderer.renderTabContent(activeTabName, true);
            }
        });
    }

    console.log('✅ Profile loaded successfully and connected to real-time database');

    const showProfileMessage = (message, isError = false, title = '') => {
        const existing = document.querySelector('.profile-notification');
        if (existing) {
            existing.remove();
        }

        const typeClass = isError ? 'is-error' : 'is-success';
        const iconClass = isError ? 'fa-circle-exclamation' : 'fa-circle-check';
        const defaultTitle = isError ? 'Action Needed' : 'Success';
        const displayTitle = title || defaultTitle;

        const note = document.createElement('div');
        note.className = `profile-notification ${typeClass} animate-fadeInDown`;
        note.setAttribute('role', 'alert');
        note.innerHTML = `
            <div class="flex items-center justify-center w-8 h-8 rounded-full ${isError ? 'bg-red-500/15 text-red-600 dark:text-red-400' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'} shrink-0 text-base">
                <i class="fa-solid ${iconClass}"></i>
            </div>
            <div class="min-w-0 flex-1">
                <p class="notification-title text-xs font-bold uppercase tracking-wider mb-0.5 leading-tight">${displayTitle}</p>
                <p class="notification-message text-sm font-semibold leading-snug">${message}</p>
            </div>
        `;
        document.body.appendChild(note);

        setTimeout(() => {
            note.classList.add('opacity-0', 'transition-opacity', 'duration-300');
            setTimeout(() => note.remove(), 300);
        }, 3200);
    };

    // ============================================================================
    // EDIT PROFILE TAB - FIREBASE BACKED SETTINGS
    // ============================================================================

    const editForm = document.getElementById('edit-profile-form');
    const displayNameInput = document.getElementById('display-name-input');
    const usernameInput = document.getElementById('username-input');
    const emailInput = document.getElementById('email-input');
    const bioInput = document.getElementById('bio-input');
    const discordInput = document.getElementById('discord-input');
    const twitterInput = document.getElementById('twitter-input');
    const privacyOnline = document.getElementById('privacy-online');
    const privacyLeaderboard = document.getElementById('privacy-leaderboard');
    const privacyFriends = document.getElementById('privacy-friends');
    const avatarPreview = document.getElementById('edit-avatar-preview');
    const avatarFileInput = document.getElementById('avatar-file-input');
    const changeAvatarBtn = document.getElementById('change-avatar-btn');
    const changePasswordBtn = document.getElementById('change-password-btn');
    const deleteAccountBtn = document.getElementById('delete-account-btn');
    const modalDeleteAccountBtn = document.getElementById('modal-delete-account-btn');
    const changePasswordModal = document.getElementById('change-password-modal');
    const closeChangePasswordModal = document.getElementById('close-change-password-modal');
    const cancelChangePassword = document.getElementById('cancel-change-password');
    const changePasswordForm = document.getElementById('change-password-form');
    const cpCurrentPassword = document.getElementById('cp-current-password');
    const cpNewPassword = document.getElementById('cp-new-password');
    const cpConfirmPassword = document.getElementById('cp-confirm-password');

    const deleteAccountModal = document.getElementById('delete-account-modal');
    const closeDeleteAccountModal = document.getElementById('close-delete-account-modal');
    const cancelDeleteAccount = document.getElementById('cancel-delete-account');
    const deleteAccountForm = document.getElementById('delete-account-form');
    const daConfirmText = document.getElementById('da-confirm-text');
    const daPasswordWrap = document.getElementById('da-password-wrap');
    const daPassword = document.getElementById('da-password');
    const daGoogleNote = document.getElementById('da-google-note');

    const initializePasswordToggles = (root = document) => {
        const toggleButtons = root.querySelectorAll('.password-toggle-btn');
        toggleButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetId = button.getAttribute('data-target');
                const input = targetId ? document.getElementById(targetId) : null;
                if (!input) {
                    return;
                }

                const icon = button.querySelector('i');
                const reveal = input.type === 'password';
                input.type = reveal ? 'text' : 'password';

                if (icon) {
                    icon.classList.toggle('fa-eye', !reveal);
                    icon.classList.toggle('fa-eye-slash', reveal);
                }

                button.setAttribute('aria-label', reveal ? 'Hide password' : 'Show password');
            });
        });
    };

    initializePasswordToggles();

    let selectedAvatarDataUrl = playerData.avatarUrl || '';

    const fillEditForm = () => {
        if (displayNameInput) {
            displayNameInput.value = currentUser.name || playerData.name || '';
        }
        if (usernameInput) {
            usernameInput.value = currentUser.username || '';
        }
        if (emailInput) {
            emailInput.value = currentUser.email || '';
        }
        if (bioInput) {
            bioInput.value = playerData.bio || '';
        }
        if (discordInput) {
            discordInput.value = playerData.socialLinks?.discord || '';
        }
        if (twitterInput) {
            twitterInput.value = playerData.socialLinks?.twitter || '';
        }

        const privacy = currentUser.privacySettings || playerData.settings?.privacy || {};
        if (privacyOnline) {
            privacyOnline.checked = privacy.showOnlineStatus !== false;
        }
        if (privacyLeaderboard) {
            privacyLeaderboard.checked = privacy.showLeaderboardProfile !== false;
        }
        if (privacyFriends) {
            privacyFriends.checked = privacy.allowFriendRequests !== false;
        }

        if (avatarPreview && selectedAvatarDataUrl) {
            avatarPreview.innerHTML = `<img src="${selectedAvatarDataUrl}" alt="Avatar Preview" class="w-full h-full object-cover rounded-full">`;
        }
    };

    fillEditForm();

    if (changeAvatarBtn && avatarFileInput) {
        changeAvatarBtn.addEventListener('click', () => avatarFileInput.click());

        avatarFileInput.addEventListener('change', () => {
            const file = avatarFileInput.files?.[0];
            if (!file) {
                return;
            }

            if (!file.type.startsWith('image/')) {
                showProfileMessage('Please select an image file.', true);
                avatarFileInput.value = '';
                return;
            }

            if (file.size > 1024 * 1024) {
                showProfileMessage('Avatar must be 1MB or smaller.', true);
                avatarFileInput.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = () => {
                selectedAvatarDataUrl = String(reader.result || '');
                if (avatarPreview && selectedAvatarDataUrl) {
                    avatarPreview.innerHTML = `<img src="${selectedAvatarDataUrl}" alt="Avatar Preview" class="w-full h-full object-cover rounded-full">`;
                }
            };
            reader.readAsDataURL(file);
        });
    }

    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            try {
                const nextName = (displayNameInput?.value || '').trim();
                const nextUsername = (usernameInput?.value || '').trim().replace(/^@+/, '');
                const nextEmail = (emailInput?.value || '').trim().toLowerCase();

                if (!nextName || !nextUsername || !nextEmail) {
                    showProfileMessage('Name, username, and email are required.', true);
                    return;
                }

                const existingPrivacy = currentUser.privacySettings || playerData.settings?.privacy || {};
                const privacySettings = {
                    showOnlineStatus: privacyOnline ? !!privacyOnline.checked : (existingPrivacy.showOnlineStatus !== false),
                    showLeaderboardProfile: privacyLeaderboard ? !!privacyLeaderboard.checked : (existingPrivacy.showLeaderboardProfile !== false),
                    allowFriendRequests: privacyFriends ? !!privacyFriends.checked : (existingPrivacy.allowFriendRequests !== false)
                };

                const emailChanged = nextEmail !== (currentUser.email || '').toLowerCase();
                if (emailChanged) {
                    const providerIds = (window.firebaseAuth?.currentUser?.providerData || []).map(p => p.providerId);
                    let currentPasswordForEmail = '';

                    if (providerIds.includes('password')) {
                        currentPasswordForEmail = prompt('To change your email, enter your current password:') || '';
                        if (!currentPasswordForEmail) {
                            showProfileMessage('Email change cancelled.', true);
                            return;
                        }
                    }

                    await authService.updateEmail(currentPasswordForEmail, nextEmail);
                }

                const userUpdates = {
                    name: nextName,
                    username: nextUsername,
                    bio: (bioInput?.value || '').trim(),
                    socialLinks: {
                        discord: (discordInput?.value || '').trim(),
                        twitter: (twitterInput?.value || '').trim()
                    },
                    privacySettings
                };

                if (selectedAvatarDataUrl) {
                    userUpdates.avatarUrl = selectedAvatarDataUrl;
                }

                const updatedUser = await authService.updateProfile(userUpdates);
                currentUser = updatedUser;

                const updatedPlayer = await playerService.updatePlayerProfile(playerId, {
                    name: updatedUser.name,
                    online: privacySettings.showOnlineStatus,
                    avatarUrl: updatedUser.avatarUrl || playerData.avatarUrl || null,
                    bio: userUpdates.bio,
                    socialLinks: userUpdates.socialLinks,
                    settings: {
                        ...(playerData.settings || {}),
                        privacy: privacySettings
                    }
                });

                playerData = updatedPlayer;
                await profileRenderer.render(playerData);
                fillEditForm();
                showProfileMessage('Profile settings saved successfully.');
            } catch (error) {
                showProfileMessage(error.message || 'Failed to save profile settings.', true);
            }
        });
    }

    const openModal = (modalEl) => {
        if (!modalEl) {
            return;
        }
        modalEl.classList.remove('hidden');
        modalEl.classList.add('flex');
    };

    const closeModal = (modalEl) => {
        if (!modalEl) {
            return;
        }
        modalEl.classList.add('hidden');
        modalEl.classList.remove('flex');
    };

    const evaluatePassword = (password) => {
        const minLength = 8;
        const hasLength = password.length >= minLength;
        const hasNumber = /[0-9]/.test(password);
        const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        const hasCasing = /[a-z]/.test(password) && /[A-Z]/.test(password);

        let score = 0;
        if (hasLength) score += 1;
        if (hasNumber) score += 1;
        if (hasSpecial) score += 1;
        if (hasCasing) score += 1;

        return {
            hasLength,
            hasNumber,
            hasSpecial,
            hasCasing,
            score,
            isValid: score === 4
        };
    };

    const updateRequirementItem = (elId, passed) => {
        const el = document.getElementById(elId);
        if (!el) return;
        const icon = el.querySelector('.rule-icon') || el.querySelector('i');
        if (passed) {
            el.classList.remove('is-unmet');
            el.classList.add('is-met');
            if (icon) {
                icon.className = 'fa-solid fa-circle-check rule-icon text-xs';
            }
        } else {
            el.classList.remove('is-met');
            el.classList.add('is-unmet');
            if (icon) {
                icon.className = 'fa-solid fa-circle-xmark rule-icon text-xs';
            }
        }
    };

    const updateCpPasswordMeter = (password) => {
        const result = evaluatePassword(password);
        const bar = document.getElementById('cp-password-strength-bar');
        const label = document.getElementById('cp-password-strength-label');

        updateRequirementItem('cp-rule-length', result.hasLength);
        updateRequirementItem('cp-rule-number', result.hasNumber);
        updateRequirementItem('cp-rule-special', result.hasSpecial);
        updateRequirementItem('cp-rule-casing', result.hasCasing);

        if (!bar || !label) return result;

        if (!password) {
            bar.style.width = '0%';
            bar.className = 'h-full transition-all duration-300 rounded-full bg-gray-400';
            label.textContent = 'Enter a password';
            label.className = 'auth-strength-label font-bold text-[11px] transition-colors';
            return result;
        }

        switch (result.score) {
            case 1:
                bar.style.width = '25%';
                bar.className = 'h-full transition-all duration-300 rounded-full bg-red-600';
                label.textContent = 'Weak';
                label.className = 'font-bold text-[11px] text-red-600 dark:text-red-400 transition-colors';
                break;
            case 2:
                bar.style.width = '50%';
                bar.className = 'h-full transition-all duration-300 rounded-full bg-amber-500';
                label.textContent = 'Moderate';
                label.className = 'font-bold text-[11px] text-amber-600 dark:text-amber-400 transition-colors';
                break;
            case 3:
                bar.style.width = '75%';
                bar.className = 'h-full transition-all duration-300 rounded-full bg-yellow-500';
                label.textContent = 'Strong';
                label.className = 'font-bold text-[11px] text-amber-700 dark:text-yellow-300 transition-colors';
                break;
            case 4:
                bar.style.width = '100%';
                bar.className = 'h-full transition-all duration-300 rounded-full bg-emerald-600 dark:bg-green-400 shadow-[0_0_10px_rgba(34,197,94,0.4)]';
                label.textContent = 'Arcane Shield (Very Strong)';
                label.className = 'font-bold text-[11px] text-emerald-700 dark:text-green-300 transition-colors';
                break;
            default:
                bar.style.width = '10%';
                bar.className = 'h-full transition-all duration-300 rounded-full bg-red-600';
                label.textContent = 'Very Weak';
                label.className = 'font-bold text-[11px] text-red-600 dark:text-red-400 transition-colors';
        }

        return result;
    };

    if (cpNewPassword) {
        cpNewPassword.addEventListener('input', () => {
            updateCpPasswordMeter(cpNewPassword.value);
        });
    }

    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', () => {
            const providerIds = (window.firebaseAuth?.currentUser?.providerData || []).map(p => p.providerId);
            if (providerIds.includes('google.com') && !providerIds.includes('password')) {
                showProfileMessage('This account uses Google sign-in. Password change is not available.', true);
                return;
            }
            if (changePasswordForm) {
                changePasswordForm.reset();
            }
            updateCpPasswordMeter('');
            openModal(changePasswordModal);
        });
    }

    if (closeChangePasswordModal) {
        closeChangePasswordModal.addEventListener('click', () => closeModal(changePasswordModal));
    }

    if (cancelChangePassword) {
        cancelChangePassword.addEventListener('click', () => closeModal(changePasswordModal));
    }

    if (changePasswordModal) {
        changePasswordModal.addEventListener('click', (e) => {
            if (e.target === changePasswordModal) {
                closeModal(changePasswordModal);
            }
        });
    }

    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const currentPassword = cpCurrentPassword?.value || '';
            const newPassword = cpNewPassword?.value || '';
            const confirmPassword = cpConfirmPassword?.value || '';

            if (!currentPassword) {
                showProfileMessage('Current password is required.', true);
                return;
            }

            const strength = evaluatePassword(newPassword);
            if (!strength.isValid) {
                showProfileMessage('New password must meet all arcane requirements (8+ characters, numbers, symbols, and uppercase/lowercase letters).', true);
                return;
            }

            if (newPassword !== confirmPassword) {
                showProfileMessage('Password confirmation does not match.', true);
                return;
            }

            try {
                await authService.changePassword(currentPassword, newPassword);
                closeModal(changePasswordModal);
                showProfileMessage('Password changed successfully.');
            } catch (error) {
                showProfileMessage(error.message || 'Failed to change password.', true);
            }
        });
    }

    const handleDeleteAccount = async () => {
        const providerIds = (window.firebaseAuth?.currentUser?.providerData || []).map(p => p.providerId);
        let password = '';

        if ((daConfirmText?.value || '').trim() !== 'DELETE') {
            showProfileMessage('Type DELETE to confirm account deletion.', true);
            return;
        }

        if (providerIds.includes('password')) {
            password = daPassword?.value || '';
            if (!password) {
                showProfileMessage('Current password is required.', true);
                return;
            }
        }

        try {
            await authService.deleteCurrentAccount(password);
            closeModal(deleteAccountModal);
            showProfileMessage('Your account has been deleted successfully. Redirecting to sign in...');
            setTimeout(() => {
                window.location.href = 'auth.html';
            }, 1200);
        } catch (error) {
            showProfileMessage(error.message || 'Failed to delete account.', true);
        }
    };

    const openDeleteModal = () => {
        const providerIds = (window.firebaseAuth?.currentUser?.providerData || []).map(p => p.providerId);
        const passwordBased = providerIds.includes('password');

        if (deleteAccountForm) {
            deleteAccountForm.reset();
        }

        if (daPasswordWrap && daPassword) {
            daPasswordWrap.classList.toggle('hidden', !passwordBased);
            daPassword.required = passwordBased;
        }

        if (daGoogleNote) {
            daGoogleNote.classList.toggle('hidden', passwordBased);
        }

        openModal(deleteAccountModal);
    };

    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', openDeleteModal);
    }
    if (modalDeleteAccountBtn) {
        modalDeleteAccountBtn.addEventListener('click', openDeleteModal);
    }

    if (closeDeleteAccountModal) {
        closeDeleteAccountModal.addEventListener('click', () => closeModal(deleteAccountModal));
    }

    if (cancelDeleteAccount) {
        cancelDeleteAccount.addEventListener('click', () => closeModal(deleteAccountModal));
    }

    if (deleteAccountModal) {
        deleteAccountModal.addEventListener('click', (e) => {
            if (e.target === deleteAccountModal) {
                closeModal(deleteAccountModal);
            }
        });
    }

    if (deleteAccountForm) {
        deleteAccountForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleDeleteAccount();
        });
    }

    // ============================================================================
    // UI INTERACTION HANDLERS
    // ============================================================================

    // Settings Modal
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    const closeSettingsIcon = document.getElementById('close-settings');

    if (settingsBtn && settingsModal) {
        settingsBtn.addEventListener('click', () => {
            settingsModal.classList.remove('hidden');
        });

        closeSettingsBtn.addEventListener('click', () => {
            settingsModal.classList.add('hidden');
        });

        closeSettingsIcon.addEventListener('click', () => {
            settingsModal.classList.add('hidden');
        });

        // Close modal when clicking outside
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) {
                settingsModal.classList.add('hidden');
            }
        });
    }

    // Logout Button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to logout?')) {
                authService.logout();
                alert('Logout successful! Redirecting to home...');
                window.location.href = 'index.html';
            }
        });
    }

    // Mobile Menu Toggle
    const menuBtn = document.getElementById('mobile-menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');

    if (menuBtn && mobileMenu) {
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const opening = mobileMenu.classList.contains('hidden');
            mobileMenu.classList.toggle('hidden');
            menuBtn.setAttribute('aria-expanded', opening ? 'true' : 'false');
        });

        mobileMenu.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        document.addEventListener('click', () => {
            if (!mobileMenu.classList.contains('hidden')) {
                mobileMenu.classList.add('hidden');
                menuBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // Quick Action Buttons - FIXED with proper IDs
    const resumeBtn = document.getElementById('resume-game-btn');
    const newChallengeBtn = document.getElementById('new-challenge-btn');

    if (resumeBtn) {
        resumeBtn.addEventListener('click', () => {
            const lastBattle = playerData.battleHistory[0];
            const message = lastBattle 
                ? `Resuming your last challenge: "${lastBattle.opponent}" (${lastBattle.difficulty})...`
                : 'Resuming your last challenge...';
            alert(message);
        });
    }

    if (newChallengeBtn) {
        newChallengeBtn.addEventListener('click', () => {
            alert('Starting new challenge! Select your difficulty level...');
        });
    }

    // Inventory Item Hover Effects
    const inventoryItems = document.querySelectorAll('.hover\\:border-ncst-neon[class*="inventory"]');
    inventoryItems.forEach(item => {
        item.addEventListener('mouseenter', function() {
            this.style.transform = 'translateX(5px)';
        });
        item.addEventListener('mouseleave', function() {
            this.style.transform = 'translateX(0)';
        });
    });

    // Achievement Animations
    const achievements = document.querySelectorAll('.hover\\:border-ncst-gold, .hover\\:border-ncst-neon, .hover\\:border-ncst-accent');
    achievements.forEach(achievement => {
        achievement.style.transition = 'all 0.3s ease';
        achievement.addEventListener('mouseenter', function() {
            if (!this.classList.contains('opacity-50')) {
                this.style.transform = 'translateY(-5px)';
                this.style.boxShadow = '0 10px 30px rgba(100, 255, 218, 0.2)';
            }
        });
        achievement.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = 'none';
        });
    });

    // Settings Form Interactions
    const settingCheckboxes = document.querySelectorAll('#settings-modal input[type="checkbox"]');
    const settingSelect = document.querySelector('#settings-modal select');

    settingCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', async function() {
            const label = this.closest('label').querySelector('span').textContent;
            const state = this.checked ? 'enabled' : 'disabled';
            console.log(`${label} has been ${state}`);
            
            // Save to database
            const settings = {
                [label.toLowerCase().replace(/\s+/g, '_')]: this.checked
            };
            await playerService.updateSettings(playerId, settings);
        });
    });

    if (settingSelect) {
        settingSelect.addEventListener('change', async function() {
            console.log(`Difficulty changed to: ${this.value}`);
            
            // Save to database
            await playerService.updateSettings(playerId, {
                difficulty: this.value
            });
        });
    }

    // XP animation while keeping real data value from renderer
    const xpBar = document.getElementById('xp-bar');
    if (xpBar) {
        const finalWidth = xpBar.style.width || '0%';
        xpBar.style.width = '0%';
        setTimeout(() => {
            xpBar.style.width = finalWidth;
            xpBar.style.transition = 'width 1s ease-out';
        }, 100);
    }

    // Profile Picture Animation
    const profilePic = document.querySelector('.w-32.h-32');
    if (profilePic) {
        profilePic.style.animation = 'bounce 3s infinite';
    }

    // Settings Modal Keyboard Close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && settingsModal && !settingsModal.classList.contains('hidden')) {
            settingsModal.classList.add('hidden');
        }
    });

    // Daily Challenge Progress Animation
    const progressBars = document.querySelectorAll('.h-2.bg-ncst-dark\\/50');
    progressBars.forEach((bar, index) => {
        const fill = bar.querySelector('.bg-ncst-neon, .bg-ncst-gold, .bg-ncst-accent, .bg-gradient-to-r');
        if (fill) {
            const originalWidth = fill.style.width || '0';
            fill.style.width = '0';
            setTimeout(() => {
                fill.style.width = originalWidth;
                fill.style.transition = 'width 2s ease-out';
            }, 100 + (index * 200));
        }
    });

    // Battle Log Win/Loss Colors
    const battleItems = document.querySelectorAll('[class*="border-l-4"][class*="border-green"], [class*="border-l-4"][class*="border-red"]');
    battleItems.forEach(item => {
        item.addEventListener('mouseenter', function() {
            this.style.transform = 'translateX(8px)';
        });
        item.addEventListener('mouseleave', function() {
            this.style.transform = 'translateX(0)';
        });
    });

    console.log('%c🧙 Welcome to your Profile, Archmage!', 'color: #FFD700; font-size: 18px; font-weight: bold;');
    console.log('%cMay your calculations be ever accurate! ⚡', 'color: #64ffda; font-size: 14px;');
});
