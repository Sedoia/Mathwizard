(function initializePasswordReset() {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const actionCode = params.get('oobCode');
    const formState = document.getElementById('reset-form-state');
    const successState = document.getElementById('reset-success-state');
    const errorState = document.getElementById('reset-error-state');
    const accountLabel = document.getElementById('reset-account');
    const errorMessage = document.getElementById('reset-error');
    const fatalError = document.getElementById('reset-fatal-error');
    const form = document.getElementById('reset-form');
    const submitButton = document.getElementById('reset-submit');

    const showFatalError = (message) => {
        formState.classList.add('hidden');
        successState.classList.add('hidden');
        errorState.classList.remove('hidden');
        fatalError.textContent = message;
    };

    const showFormError = (message) => {
        errorMessage.textContent = message;
        errorMessage.classList.remove('hidden');
    };

    const mapError = (error) => {
        const messages = {
            'auth/expired-action-code': 'This reset link has expired. Request a new one from the login page.',
            'auth/invalid-action-code': 'This reset link is invalid or has already been used. Request a new one from the login page.',
            'auth/user-disabled': 'This account has been disabled. Contact an administrator for help.',
            'auth/weak-password': 'Use at least 6 characters for your new password.',
            'auth/network-request-failed': 'The network connection failed. Check your connection and try again.'
        };
        return messages[error?.code] || 'The reset could not be completed. Please request a new link.';
    };

    if (mode !== 'resetPassword' || !actionCode || !window.firebaseAuth) {
        showFatalError('This page needs a valid password-reset link. Open the latest link from your email or request a new one.');
        return;
    }

    const initialize = async () => {
        try {
            const email = await window.firebaseAuth.verifyPasswordResetCode(actionCode);
            accountLabel.textContent = `Restoring the account for ${email}`;
            accountLabel.classList.remove('hidden');
        } catch (error) {
            showFatalError(mapError(error));
        }
    };

    document.querySelectorAll('.password-toggle-btn').forEach(button => {
        button.addEventListener('click', () => {
            const input = document.getElementById(button.dataset.target);
            const icon = button.querySelector('i');
            const reveal = input.type === 'password';
            input.type = reveal ? 'text' : 'password';
            icon.classList.toggle('fa-eye', !reveal);
            icon.classList.toggle('fa-eye-slash', reveal);
            button.setAttribute('aria-label', reveal ? 'Hide password' : 'Show password');
        });
    });

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

    const updatePasswordMeter = (password) => {
        const result = evaluatePassword(password);
        const bar = document.getElementById('reset-password-strength-bar');
        const label = document.getElementById('reset-password-strength-label');

        updateRequirementItem('reset-rule-length', result.hasLength);
        updateRequirementItem('reset-rule-number', result.hasNumber);
        updateRequirementItem('reset-rule-special', result.hasSpecial);
        updateRequirementItem('reset-rule-casing', result.hasCasing);

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

    const passwordInput = document.getElementById('reset-password');
    if (passwordInput) {
        passwordInput.addEventListener('input', () => {
            updatePasswordMeter(passwordInput.value);
        });
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        errorMessage.classList.add('hidden');

        const password = document.getElementById('reset-password').value;
        const confirmation = document.getElementById('reset-confirm-password').value;
        const strength = evaluatePassword(password);

        if (!strength.isValid) {
            showFormError('Please ensure your password meets all requirements (8+ characters, numbers, symbols, and mixed casing).');
            return;
        }
        if (password !== confirmation) {
            showFormError('Your password and confirmation do not match.');
            return;
        }

        const originalText = submitButton.innerHTML;
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Restoring...';
        try {
            await window.firebaseAuth.confirmPasswordReset(actionCode, password);
            formState.classList.add('hidden');
            successState.classList.remove('hidden');
        } catch (error) {
            showFormError(mapError(error));
            submitButton.disabled = false;
            submitButton.innerHTML = originalText;
        }
    });

    initialize();
})();
