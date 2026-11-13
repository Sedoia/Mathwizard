(function () {
    const storageKey = 'mathwizard_theme';
    const root = document.documentElement;
    const storedTheme = localStorage.getItem(storageKey);
    const initialTheme = storedTheme === 'dark' || storedTheme === 'light'
        ? storedTheme
        : 'light';

    root.dataset.theme = initialTheme;

    const updateToggle = (button, theme) => {
        const nextTheme = theme === 'dark' ? 'light' : 'dark';
        const isDark = theme === 'dark';
        button.setAttribute('aria-pressed', String(isDark));
        button.setAttribute('aria-label', `Switch to ${nextTheme} mode`);
        button.title = `Switch to ${nextTheme} mode`;
        button.innerHTML = `
            <i class="fa-solid ${isDark ? 'fa-sun' : 'fa-moon'}" aria-hidden="true"></i>
            <span>${isDark ? 'Light' : 'Dark'} mode</span>
        `;
    };

    const mountToggle = () => {
        if (document.querySelector('[data-theme-toggle]')) {
            return;
        }

        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.themeToggle = '';
        button.className = 'theme-toggle';
        button.addEventListener('click', () => {
            const nextTheme = root.dataset.theme === 'dark' ? 'light' : 'dark';
            root.dataset.theme = nextTheme;
            localStorage.setItem(storageKey, nextTheme);
            updateToggle(button, nextTheme);
        });

        updateToggle(button, root.dataset.theme);
        document.body.appendChild(button);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountToggle);
    } else {
        mountToggle();
    }
})();
