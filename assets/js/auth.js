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
                button.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Signing in...';

                const response = await authService.login(email, password);
                
                button.innerHTML = '<i class="fa-solid fa-check mr-2"></i> Success!';
                button.classList.add('bg-green-500/20', 'border-green-500', 'text-green-400');
                
                showNotification(`Welcome back, ${response.name}. Redirecting to your dashboard...`, 'success', 'Sign-In Successful');
                
                setTimeout(() => {
                    // Redirect based on role
                    if (response.role === 'admin') {
                        window.location.href = 'admin.html';
                    } else {
                        window.location.href = 'profile.html';
                    }
                }, 1000);
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

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const nameInput = signupForm.querySelector('#signup-name') || signupForm.querySelector('input[type="text"]');
            const emailInput = signupForm.querySelector('#signup-email') || signupForm.querySelector('input[type="email"]');
            const passwordInput = signupForm.querySelector('#signup-password');
            const confirmPasswordInput = signupForm.querySelector('#signup-confirm-password');
            const termsCheckbox = signupForm.querySelector('#signup-terms') || signupForm.querySelector('input[type="checkbox"]');
            
            const name = nameInput?.value.trim();
            const email = emailInput?.value.trim();
            const password = passwordInput?.value;
            const confirmPassword = confirmPasswordInput?.value;
            
            if (!name || !email || !password || !confirmPassword) {
                showNotification('Complete all required fields to create your account.', 'error', 'Sign-Up Incomplete');
                return;
            }

            if (password !== confirmPassword) {
                showNotification('Your password and confirmation do not match.', 'error', 'Password Mismatch');
                return;
            }

            if (password.length < 6) {
                showNotification('Use at least 6 characters for a secure password.', 'error', 'Password Too Short');
                return;
            }

            if (!termsCheckbox?.checked) {
                showNotification('You need to agree to the Terms of Service before continuing.', 'error', 'Terms Required');
                return;
            }

            const button = signupForm.querySelector('button[type="submit"]');
            const originalText = button.innerHTML;

            try {
                button.disabled = true;
                button.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Creating account...';

                const response = await authService.register(name, email, password);
                
                button.innerHTML = '<i class="fa-solid fa-check mr-2"></i> Account Created!';
                button.classList.add('bg-green-500');
                
                showNotification(`Welcome to Math Wizard, ${response.name}. Your account is ready.`, 'success', 'Sign-Up Complete');
                
                setTimeout(() => {
                    window.location.href = 'profile.html';
                }, 1000);
            } catch (error) {
                showNotification(error.message, 'error', 'Sign-Up Failed');
                button.disabled = false;
                button.innerHTML = originalText;
            }
        });
    }
    
    // Input focus effects
    const inputs = document.querySelectorAll('input');
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

    // Google SSO login
    const googleSSOButton = document.getElementById('google-sso-btn');
    if (googleSSOButton) {
        googleSSOButton.addEventListener('click', async () => {
            const originalText = googleSSOButton.innerHTML;

            try {
                googleSSOButton.disabled = true;
                googleSSOButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Connecting Google...';

                const response = await authService.loginWithGoogle();
                showNotification(`Welcome, ${response.name}. Signing you in now...`, 'success', 'Google Sign-In Successful');

                setTimeout(() => {
                    if (response.role === 'admin') {
                        window.location.href = 'admin.html';
                    } else {
                        window.location.href = 'profile.html';
                    }
                }, 700);
            } catch (error) {
                showNotification(error.message, 'error', 'Google Sign-In Failed');
                googleSSOButton.disabled = false;
                googleSSOButton.innerHTML = originalText;
            }
        });
    }

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

    const colors = {
        success: 'bg-green-500/20 border-green-500 text-green-400',
        error: 'bg-red-500/20 border-red-500 text-red-400',
        info: 'bg-blue-500/20 border-blue-500 text-blue-400',
        warning: 'bg-yellow-500/20 border-yellow-500 text-yellow-400'
    };

    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle',
        warning: 'fa-exclamation-triangle'
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

    const notification = document.createElement('div');
    notification.className = `auth-notification fixed top-20 sm:top-24 left-1/2 -translate-x-1/2 rounded-xl border ${colors[type]} z-50 transition-all duration-300`;
    const inner = document.createElement('div');
    inner.className = 'auth-notification-inner flex items-start gap-3';

    const icon = document.createElement('i');
    icon.className = `fa-solid ${iconClass} auth-notification-icon mt-0.5`;
    icon.setAttribute('aria-hidden', 'true');

    const copy = document.createElement('div');
    copy.className = 'auth-notification-copy min-w-0';

    const titleEl = document.createElement('p');
    titleEl.className = 'auth-notification-title';
    titleEl.textContent = finalTitle;

    const messageEl = document.createElement('p');
    messageEl.className = 'auth-notification-message';
    messageEl.textContent = finalMessage;

    copy.appendChild(titleEl);
    copy.appendChild(messageEl);
    inner.appendChild(icon);
    inner.appendChild(copy);
    notification.appendChild(inner);

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
