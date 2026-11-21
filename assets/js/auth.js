document.addEventListener('DOMContentLoaded', () => {
    // Redirect if already authenticated
    if (authService.isAuthenticated()) {
        const user = authService.getCurrentUser();
        console.log('User already authenticated. Redirecting...');
        
        // Redirect admin to admin panel, regular users to profile
        if (user && user.role === 'admin') {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'profile.html';
        }
        return;
    }

    if (new URLSearchParams(window.location.search).get('mode') === 'register') {
        toggleAuth();
    }

    // Form elements
    const loginFormContainer = document.getElementById('login-form');
    const signupFormContainer = document.getElementById('signup-form');
    const loginForm = loginFormContainer?.querySelector('form');
    const signupForm = signupFormContainer?.querySelector('form');

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

    // =========================================================================
    // OTP MODAL CONTROLLER
    // =========================================================================

    const otpModal = document.getElementById('otp-modal');
    const otpDigitInputs = otpModal ? otpModal.querySelectorAll('.otp-digit') : [];
    const otpVerifyBtn = document.getElementById('otp-verify-btn');
    const otpResendBtn = document.getElementById('otp-resend-btn');
    const otpCancelBtn = document.getElementById('otp-cancel-btn');
    const otpErrorMsg = document.getElementById('otp-error-msg');
    const otpCountdown = document.getElementById('otp-countdown');
    const otpSubtitle = document.getElementById('otp-subtitle');
    const otpEmailHint = document.getElementById('otp-email-hint');

    let _otpCountdownInterval = null;
    let _otpCallbacks = { onVerified: null, onCancel: null };
    let _otpEmail = '';
    let _otpPurpose = '';

    function openOTPModal(email, purpose, onVerified, onCancel) {
        _otpEmail = email;
        _otpPurpose = purpose;
        _otpCallbacks = { onVerified, onCancel };

        // Set display text
        const masked = (typeof otpService !== 'undefined' && otpService.maskEmail)
            ? otpService.maskEmail(email)
            : email;

        if (otpSubtitle) {
            otpSubtitle.textContent = purpose === 'login'
                ? 'Confirm your identity to continue'
                : 'Verify your email to complete registration';
        }
        if (otpEmailHint) {
            otpEmailHint.innerHTML = `Code sent to <strong>${masked}</strong>`;
        }

        // Clear inputs & errors
        otpDigitInputs.forEach(input => { input.value = ''; });
        hideOTPError();

        // Show modal
        if (otpModal) {
            otpModal.classList.remove('hidden');
            otpModal.classList.add('flex');
        }

        // Focus first digit
        if (otpDigitInputs.length > 0) {
            setTimeout(() => otpDigitInputs[0].focus(), 100);
        }

        // Start countdown
        startResendCountdown();
    }

    function closeOTPModal() {
        if (otpModal) {
            otpModal.classList.add('hidden');
            otpModal.classList.remove('flex');
        }
        clearCountdownTimer();
        otpDigitInputs.forEach(input => { input.value = ''; });
        hideOTPError();
        _otpEmail = '';
        _otpPurpose = '';
        _otpCallbacks = { onVerified: null, onCancel: null };
    }

    function getOTPCode() {
        return Array.from(otpDigitInputs).map(input => input.value).join('');
    }

    function showOTPError(message) {
        if (otpErrorMsg) {
            otpErrorMsg.textContent = message;
            otpErrorMsg.classList.remove('hidden');
        }
    }

    function hideOTPError() {
        if (otpErrorMsg) {
            otpErrorMsg.textContent = '';
            otpErrorMsg.classList.add('hidden');
        }
    }

    function setVerifyBtnLoading(loading) {
        if (!otpVerifyBtn) return;
        if (loading) {
            otpVerifyBtn.disabled = true;
            otpVerifyBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Verifying...';
        } else {
            otpVerifyBtn.disabled = false;
            otpVerifyBtn.innerHTML = '<i class="fa-solid fa-check-double mr-2"></i> Verify Code';
        }
    }

    // --- OTP Input Navigation (digit-by-digit, backspace, paste) ---
    otpDigitInputs.forEach((input, index) => {
        // Only allow single digit
        input.addEventListener('input', (e) => {
            const val = e.target.value.replace(/[^0-9]/g, '');
            e.target.value = val.slice(0, 1);

            // Auto-advance
            if (val && index < otpDigitInputs.length - 1) {
                otpDigitInputs[index + 1].focus();
            }

            hideOTPError();
        });

        // Backspace navigation
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                otpDigitInputs[index - 1].focus();
                otpDigitInputs[index - 1].value = '';
            }
            // Enter to verify
            if (e.key === 'Enter') {
                e.preventDefault();
                if (otpVerifyBtn) otpVerifyBtn.click();
            }
        });

        // Paste support (paste 6 digits fills all fields)
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pastedData = (e.clipboardData || window.clipboardData).getData('text');
            const digits = pastedData.replace(/[^0-9]/g, '').slice(0, 6);

            if (digits.length > 0) {
                for (let i = 0; i < otpDigitInputs.length; i++) {
                    otpDigitInputs[i].value = digits[i] || '';
                }
                // Focus last filled or the unfilled one
                const focusIndex = Math.min(digits.length, otpDigitInputs.length - 1);
                otpDigitInputs[focusIndex].focus();
            }
        });
    });

    // --- Verify OTP ---
    if (otpVerifyBtn) {
        otpVerifyBtn.addEventListener('click', async () => {
            const code = getOTPCode();

            if (code.length !== 6) {
                showOTPError('Please enter all 6 digits of your verification code.');
                return;
            }

            setVerifyBtnLoading(true);
            hideOTPError();

            try {
                const result = await otpService.verifyOTP(_otpEmail, code);

                if (result.success) {
                    // Success animation
                    otpVerifyBtn.innerHTML = '<i class="fa-solid fa-check mr-2"></i> Verified!';
                    otpVerifyBtn.classList.add('bg-green-500/20', 'border-green-500', 'text-green-400');

                    // Cleanup OTP
                    otpService.cleanupOTP();

                    // Call success callback
                    if (_otpCallbacks.onVerified) {
                        setTimeout(() => {
                            _otpCallbacks.onVerified();
                        }, 500);
                    }
                } else {
                    showOTPError(result.message);
                    setVerifyBtnLoading(false);
                    // Clear inputs for retry
                    otpDigitInputs.forEach(input => { input.value = ''; });
                    if (otpDigitInputs.length > 0) otpDigitInputs[0].focus();
                }
            } catch (err) {
                showOTPError(err.message || 'Verification failed. Please try again.');
                setVerifyBtnLoading(false);
            }
        });
    }

    // --- Resend OTP ---
    if (otpResendBtn) {
        otpResendBtn.addEventListener('click', async () => {
            if (otpResendBtn.disabled) return;

            otpResendBtn.disabled = true;
            otpResendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Sending...';

            try {
                await otpService.resendOTP(_otpEmail, _otpPurpose);
                showNotification('A new verification code has been sent to your email.', 'success', 'Code Resent');
                // Clear inputs
                otpDigitInputs.forEach(input => { input.value = ''; });
                hideOTPError();
                if (otpDigitInputs.length > 0) otpDigitInputs[0].focus();
            } catch (err) {
                showOTPError(err.message || 'Failed to resend code. Please try again.');
            }

            startResendCountdown();
        });
    }

    // --- Cancel OTP ---
    if (otpCancelBtn) {
        otpCancelBtn.addEventListener('click', () => {
            const cancelCallback = _otpCallbacks.onCancel;
            closeOTPModal();
            if (cancelCallback) cancelCallback();
        });
    }

    // --- Resend Countdown Timer ---
    function startResendCountdown() {
        clearCountdownTimer();
        let seconds = 60;

        if (otpResendBtn) {
            otpResendBtn.disabled = true;
            otpResendBtn.innerHTML = '<i class="fa-solid fa-rotate-right mr-1"></i> Resend Code';
        }

        const updateDisplay = () => {
            if (otpCountdown) {
                otpCountdown.textContent = `Resend available in ${seconds}s`;
            }
        };

        updateDisplay();

        _otpCountdownInterval = setInterval(() => {
            seconds -= 1;

            if (seconds <= 0) {
                clearCountdownTimer();
                if (otpCountdown) otpCountdown.textContent = '';
                if (otpResendBtn) {
                    otpResendBtn.disabled = false;
                    otpResendBtn.innerHTML = '<i class="fa-solid fa-rotate-right mr-1"></i> Resend Code';
                }
            } else {
                updateDisplay();
            }
        }, 1000);
    }

    function clearCountdownTimer() {
        if (_otpCountdownInterval) {
            clearInterval(_otpCountdownInterval);
            _otpCountdownInterval = null;
        }
    }

    // =========================================================================
    // LOGIN FORM SUBMISSION — with OTP verification
    // =========================================================================

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const emailInput = loginForm.querySelector('#login-identifier')
                || loginForm.querySelector('input[type="text"], input[type="email"]');
            const passwordInput = loginForm.querySelector('#login-password')
                || loginForm.querySelector('input[name="password"]');
            const email = emailInput?.value.trim() || '';
            const password = passwordInput?.value || '';
            
            if (!email || !password) {
                showNotification('Please enter both your email or username and password.', 'error', 'Sign-In Incomplete');
                return;
            }

            const button = loginForm.querySelector('button[type="submit"]');
            const originalText = button.innerHTML;

            try {
                button.disabled = true;
                button.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Verifying credentials...';

                // Step 1: Validate credentials by logging in
                const response = await authService.login(email, password);

                // Step 2: Get the actual email (may have been a username login)
                const resolvedEmail = response.email || email;

                // Step 3: Send OTP for login verification
                button.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Sending verification code...';
                await otpService.sendOTP(resolvedEmail, 'login');

                // Step 4: Show OTP modal
                // Keep the user signed in but don't redirect until OTP is verified
                button.innerHTML = '<i class="fa-solid fa-envelope-circle-check mr-2"></i> Check your email';
                button.disabled = true;

                openOTPModal(
                    resolvedEmail,
                    'login',
                    // onVerified callback
                    () => {
                        closeOTPModal();
                        button.innerHTML = '<i class="fa-solid fa-check mr-2"></i> Success!';
                        button.classList.add('bg-green-500/20', 'border-green-500', 'text-green-400');

                        showNotification(`Welcome back, ${response.name}. Redirecting to your dashboard...`, 'success', 'Sign-In Successful');

                        setTimeout(() => {
                            if (response.role === 'admin') {
                                window.location.href = 'admin.html';
                            } else {
                                window.location.href = 'profile.html';
                            }
                        }, 1000);
                    },
                    // onCancel callback
                    () => {
                        // Log out since they cancelled OTP
                        authService.logout();
                        button.disabled = false;
                        button.innerHTML = originalText;
                        showNotification('Login verification cancelled.', 'info', 'Verification Cancelled');
                    }
                );

            } catch (error) {
                showNotification(error.message, 'error', 'Sign-In Failed');
                button.disabled = false;
                button.innerHTML = originalText;
                
                // Shake animation
                loginForm.classList.add('animate-shake');
                setTimeout(() => loginForm.classList.remove('animate-shake'), 500);
            }
        });
    }

    // =========================================================================
    // PASSWORD STRENGTH & VALIDATION
    // =========================================================================

    const evaluatePassword = (password = '') => {
        const hasLength = password.length >= 8;
        const hasNumber = /\d/.test(password);
        const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?`~]/.test(password);
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

    const updatePasswordMeter = (password) => {
        const result = evaluatePassword(password);
        const bar = document.getElementById('password-strength-bar');
        const label = document.getElementById('password-strength-label');

        updateRequirementItem('rule-length', result.hasLength);
        updateRequirementItem('rule-number', result.hasNumber);
        updateRequirementItem('rule-special', result.hasSpecial);
        updateRequirementItem('rule-casing', result.hasCasing);

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
                break;
        }

        return result;
    };

    const updatePasswordMatchIndicator = () => {
        const passwordInput = document.getElementById('signup-password');
        const confirmInput = document.getElementById('signup-confirm-password');
        const matchStatus = document.getElementById('password-match-status');

        if (!passwordInput || !confirmInput || !matchStatus) return;

        const pwd = passwordInput.value;
        const confirmPwd = confirmInput.value;

        if (!confirmPwd) {
            matchStatus.classList.add('hidden');
            matchStatus.textContent = '';
            return;
        }

        matchStatus.classList.remove('hidden');
        if (pwd === confirmPwd) {
            matchStatus.className = 'auth-match-status-ok flex items-center gap-1.5 text-[11px] mt-1.5';
            matchStatus.innerHTML = '<i class="fa-solid fa-circle-check"></i> Passwords match perfectly';
        } else {
            matchStatus.className = 'auth-match-status-err flex items-center gap-1.5 text-[11px] mt-1.5';
            matchStatus.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Passwords do not match';
        }
    };

    // Live Listeners for Password Input & Match
    const signupPasswordInput = document.getElementById('signup-password');
    const signupConfirmPasswordInput = document.getElementById('signup-confirm-password');

    if (signupPasswordInput) {
        signupPasswordInput.addEventListener('input', (e) => {
            updatePasswordMeter(e.target.value);
            updatePasswordMatchIndicator();
        });
    }

    if (signupConfirmPasswordInput) {
        signupConfirmPasswordInput.addEventListener('input', () => {
            updatePasswordMatchIndicator();
        });
    }

    // =========================================================================
    // SIGNUP FORM SUBMISSION — with OTP verification
    // =========================================================================

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const firstNameInput = signupForm.querySelector('#signup-first-name');
            const lastNameInput = signupForm.querySelector('#signup-last-name');
            const usernameInput = signupForm.querySelector('#signup-username');
            const emailInput = signupForm.querySelector('#signup-email');
            const passwordInput = signupForm.querySelector('#signup-password');
            const confirmPasswordInput = signupForm.querySelector('#signup-confirm-password');
            const termsCheckbox = signupForm.querySelector('#signup-terms');
            
            const firstName = firstNameInput?.value.trim() || '';
            const lastName = lastNameInput?.value.trim() || '';
            const username = usernameInput?.value.trim() || '';
            const email = emailInput?.value.trim().toLowerCase() || '';
            const password = passwordInput?.value || '';
            const confirmPassword = confirmPasswordInput?.value || '';
            
            if (!firstName || !lastName || !username || !email || !password || !confirmPassword) {
                showNotification('Complete all required fields to create your account.', 'error', 'Sign-Up Incomplete');
                return;
            }

            // NCST Engineering Student Domain Check
            if (!email.endsWith('@ncst.edu.ph')) {
                showNotification('Registration is restricted to NCST Engineering students. Please enter your official @ncst.edu.ph institutional email.', 'error', 'NCST Email Required');
                emailInput?.focus();
                return;
            }

            // Username format validation
            const usernameRegex = /^[a-zA-Z0-9_]{3,24}$/;
            if (!usernameRegex.test(username)) {
                showNotification('Username must be 3-24 characters containing only letters, numbers, or underscores.', 'error', 'Invalid Username');
                usernameInput?.focus();
                return;
            }

            // Strong password requirements check
            const strength = evaluatePassword(password);
            if (!strength.isValid) {
                showNotification('Your password must fulfill all 4 security requirements: 8+ characters, numbers, special symbol (!@#$%), and mixed upper/lower case.', 'error', 'Strong Password Required');
                passwordInput?.focus();
                return;
            }

            if (password !== confirmPassword) {
                showNotification('Your password and confirmation do not match.', 'error', 'Password Mismatch');
                confirmPasswordInput?.focus();
                return;
            }

            if (!termsCheckbox?.checked) {
                showNotification('You need to agree to the Terms of Service and Privacy Policy before continuing.', 'error', 'Terms Required');
                return;
            }

            const button = signupForm.querySelector('button[type="submit"]');
            const originalText = button.innerHTML;

            try {
                button.disabled = true;
                button.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Sending verification code...';

                // Step 1: Send OTP to email BEFORE creating the account
                await otpService.sendOTP(email, 'registration');

                // Step 2: Store pending registration data
                const pendingPayload = { firstName, lastName, username, email, password };

                button.innerHTML = '<i class="fa-solid fa-envelope-circle-check mr-2"></i> Check your email';
                button.disabled = true;

                // Step 3: Show OTP modal
                openOTPModal(
                    email,
                    'registration',
                    // onVerified callback — now create the actual account
                    async () => {
                        closeOTPModal();
                        button.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Creating your account...';

                        try {
                            const response = await authService.register(pendingPayload);

                            button.innerHTML = '<i class="fa-solid fa-check mr-2"></i> Account Enrolled!';
                            button.classList.add('bg-green-500');

                            showNotification(`Welcome to Math Wizard, ${response.name}! Your NCST Engineering account is ready.`, 'success', 'Sign-Up Complete');

                            setTimeout(() => {
                                window.location.href = 'profile.html';
                            }, 1000);
                        } catch (regError) {
                            showNotification(regError.message, 'error', 'Sign-Up Failed');
                            button.disabled = false;
                            button.innerHTML = originalText;
                        }
                    },
                    // onCancel callback
                    () => {
                        button.disabled = false;
                        button.innerHTML = originalText;
                        showNotification('Email verification cancelled. Your account was not created.', 'info', 'Verification Cancelled');
                    }
                );

            } catch (error) {
                showNotification(error.message, 'error', 'Verification Failed');
                button.disabled = false;
                button.innerHTML = originalText;
            }
        });
    }
    
    // Input focus effects
    const inputs = document.querySelectorAll('input:not(.otp-digit)');
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            this.parentElement.classList.add('opacity-100');
        });
        
        input.addEventListener('blur', function() {
            if (!this.value) {
                this.parentElement.classList.remove('opacity-100');
            }
        });
        
        // Validate on input
        input.addEventListener('input', function() {
            this.classList.remove('border-ncst-accent');
        });
    });

    // Developer note only
    console.log('Auth page ready.');
});

// Notification System
function normalizeAuthMessage(message) {
    const text = String(message || '').trim();
    if (!text) {
        return 'Something went wrong. Please try again.';
    }

    const lower = text.toLowerCase();

    if (lower.includes('invalid-credential') || lower.includes('wrong-password') || lower.includes('user-not-found')) {
        return 'The email/username or password is incorrect. Please try again.';
    }

    if (lower.includes('too-many-requests')) {
        return 'Too many attempts were detected. Wait a moment and try again.';
    }

    if (lower.includes('email-already-in-use')) {
        return 'This email is already registered. Try signing in instead.';
    }

    if (lower.includes('invalid-email')) {
        return 'Please enter a valid email address.';
    }

    if (lower.includes('weak-password')) {
        return 'Choose a stronger password with at least 6 characters.';
    }

    return text;
}

function showNotification(message, type = 'info', title = '') {
    // Remove existing notification
    const existing = document.querySelector('.auth-notification');
    if (existing) existing.remove();

    const icons = {
        success: 'fa-circle-check',
        error: 'fa-circle-exclamation',
        info: 'fa-circle-info',
        warning: 'fa-triangle-exclamation'
    };

    const iconColors = {
        success: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
        error: 'bg-red-500/15 text-red-600 dark:text-red-400',
        info: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
        warning: 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
    };

    const defaultTitles = {
        success: 'Success',
        error: 'Action Needed',
        info: 'Notice',
        warning: 'Warning'
    };

    const finalTitle = title || defaultTitles[type] || defaultTitles.info;
    const finalMessage = normalizeAuthMessage(message);
    const iconClass = icons[type] || icons.info;
    const iconWrapColor = iconColors[type] || iconColors.info;

    const notification = document.createElement('div');
    notification.className = `auth-notification is-${type} fixed top-20 sm:top-24 left-1/2 -translate-x-1/2 z-50 transition-all duration-300`;
    notification.setAttribute('role', 'alert');
    notification.innerHTML = `
        <div class="flex items-center justify-center w-8 h-8 rounded-full ${iconWrapColor} shrink-0 text-base">
            <i class="fa-solid ${iconClass}"></i>
        </div>
        <div class="auth-notification-copy min-w-0 flex-1">
            <p class="auth-notification-title text-xs font-bold uppercase tracking-wider mb-0.5 leading-tight">${finalTitle}</p>
            <p class="auth-notification-message text-sm font-semibold leading-snug">${finalMessage}</p>
        </div>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('opacity-0', 'transition-opacity');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Toggle between login and signup forms
function toggleAuth() {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    
    loginForm.classList.toggle('hidden');
    signupForm.classList.toggle('hidden');
    
    // Re-add animations
    if (!loginForm.classList.contains('hidden')) {
        loginForm.classList.remove('animate-fadeInRight');
        loginForm.classList.add('animate-fadeInLeft');
        signupForm.classList.remove('animate-fadeInLeft');
        signupForm.classList.add('animate-fadeInRight');
    } else {
        loginForm.classList.remove('animate-fadeInLeft');
        loginForm.classList.add('animate-fadeInRight');
        signupForm.classList.remove('animate-fadeInRight');
        signupForm.classList.add('animate-fadeInLeft');
    }
}

// Forgot Password Functions
function openForgotPassword() {
    const modal = document.getElementById('forgot-password-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.getElementById('forgot-step-email')?.classList.remove('hidden');
        document.getElementById('forgot-step-success')?.classList.add('hidden');
    }
}

function closeForgotPassword() {
    const modal = document.getElementById('forgot-password-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        const emailInput = document.getElementById('forgot-email');
        if (emailInput) emailInput.value = '';
    }
}

async function submitForgotPassword(event) {
    event.preventDefault();
    const email = document.getElementById('forgot-email')?.value;
    
    if (!email) {
        showNotification('Please enter your email address', 'error');
        return;
    }

    try {
        await authService.requestPasswordReset(email);
        document.getElementById('forgot-step-email')?.classList.add('hidden');
        document.getElementById('forgot-step-success')?.classList.remove('hidden');
    } catch (error) {
        showNotification('Error sending reset email', 'error');
    }
}
