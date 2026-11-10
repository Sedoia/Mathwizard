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

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        errorMessage.classList.add('hidden');

        const password = document.getElementById('reset-password').value;
        const confirmation = document.getElementById('reset-confirm-password').value;
        if (password.length < 6) {
            showFormError('Use at least 6 characters for your new password.');
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
