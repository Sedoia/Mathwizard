document.addEventListener('DOMContentLoaded', () => {
    // Auth-aware navbar state on home page
    const desktopAuthSlot = document.getElementById('desktop-auth-slot');
    const desktopSigninBtn = document.getElementById('desktop-signin-btn');
    const mobileSigninBtn = document.getElementById('mobile-signin-btn');
    const mobileAuthSlot = document.getElementById('mobile-auth-slot');

    const sessionUserRaw = localStorage.getItem('mathwizard_current_user');
    const sessionToken = localStorage.getItem('mathwizard_token');
    let sessionUser = null;

    try {
        sessionUser = sessionUserRaw ? JSON.parse(sessionUserRaw) : null;
    } catch (error) {
        sessionUser = null;
    }

    const isAuthenticated = !!sessionUser && !!sessionToken;

    const getInitials = (name) => {
        if (!name) {
            return 'MW';
        }
        const parts = name.trim().split(/\s+/).slice(0, 2);
        return parts.map(p => p.charAt(0).toUpperCase()).join('');
    };

    const buildAvatar = (user) => {
        if (user.avatarUrl) {
            return `<img src="${user.avatarUrl}" alt="Avatar" class="w-8 h-8 rounded-full object-cover border border-ncst-gold/60">`;
        }
        return `<div class="w-8 h-8 rounded-full border border-ncst-gold/60 bg-ncst-gold/20 text-ncst-gold text-[0.65rem] font-bold flex items-center justify-center">${getInitials(user.name || user.username)}</div>`;
    };

    const clearSessionAndRedirect = () => {
        localStorage.removeItem('mathwizard_current_user');
        localStorage.removeItem('mathwizard_token');
        sessionStorage.clear();
        window.location.href = 'index.html';
    };

    if (isAuthenticated) {
        if (desktopSigninBtn) {
            desktopSigninBtn.classList.add('hidden');
        }

        const destination = sessionUser.role === 'admin' ? 'admin.html' : 'profile.html';
        const displayName = sessionUser.name || sessionUser.username || 'Player';

        if (desktopAuthSlot) {
            desktopAuthSlot.innerHTML = `
                <a href="${destination}" class="hidden md:flex items-center gap-2 px-3 py-2 border border-ncst-gold/40 rounded-sm hover:border-ncst-gold transition-colors max-w-[220px]">
                    ${buildAvatar(sessionUser)}
                    <span class="text-xs lg:text-sm text-ncst-gold truncate">${displayName}</span>
                </a>
                <button id="desktop-logout-btn" type="button" class="hidden md:flex px-3 py-2 border border-ncst-accent text-ncst-accent text-xs lg:text-sm font-bold rounded-sm hover:bg-ncst-accent/10 transition-colors">
                    <i class="fa-solid fa-right-from-bracket"></i>
                </button>
            `;

            const desktopLogoutBtn = document.getElementById('desktop-logout-btn');
            if (desktopLogoutBtn) {
                desktopLogoutBtn.addEventListener('click', clearSessionAndRedirect);
            }
        }

        if (mobileSigninBtn) {
            mobileSigninBtn.classList.add('hidden');
        }

        if (mobileAuthSlot) {
            mobileAuthSlot.classList.remove('hidden');
            mobileAuthSlot.innerHTML = `
                <a href="${destination}" class="block px-4 sm:px-5 py-2 min-h-[44px] flex items-center justify-center gap-2 border border-ncst-gold text-ncst-gold text-xs sm:text-sm font-bold tracking-widest hover:bg-ncst-gold/10 transition-colors rounded-lg mt-2">
                    ${buildAvatar(sessionUser)}
                    <span class="truncate max-w-[140px]">${displayName}</span>
                </a>
                <button id="mobile-logout-btn" type="button" class="w-full px-4 sm:px-5 py-2 mt-2 min-h-[44px] flex items-center justify-center border border-ncst-accent text-ncst-accent text-xs sm:text-sm font-bold tracking-widest hover:bg-ncst-accent/10 transition-colors rounded-lg">
                    LOG OUT <i class="fa-solid fa-right-from-bracket ml-2"></i>
                </button>
            `;

            const mobileLogoutBtn = document.getElementById('mobile-logout-btn');
            if (mobileLogoutBtn) {
                mobileLogoutBtn.addEventListener('click', clearSessionAndRedirect);
            }
        }
    }

    // Mobile Menu Toggle
    const menuBtn = document.querySelector('.menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');

    if (menuBtn && mobileMenu) {
        menuBtn.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
            
            // Toggle icon between bars and X
            const icon = menuBtn.querySelector('i');
            if (mobileMenu.classList.contains('hidden')) {
                icon.classList.remove('fa-xmark');
                icon.classList.add('fa-bars-staggered');
            } else {
                icon.classList.remove('fa-bars-staggered');
                icon.classList.add('fa-xmark');
            }
        });

        // Close menu when clicking on links
        const menuLinks = mobileMenu.querySelectorAll('a');
        menuLinks.forEach(link => {
            link.addEventListener('click', () => {
                mobileMenu.classList.add('hidden');
                const icon = menuBtn.querySelector('i');
                icon.classList.remove('fa-xmark');
                icon.classList.add('fa-bars-staggered');
            });
        });
    }

    // Smooth scroll for buttons with scroll-btn class
    const scrollBtns = document.querySelectorAll('.scroll-btn');
    scrollBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-target');
            const element = document.getElementById(target);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // Video button placeholder
    const videoBtn = document.querySelector('.video-btn');
    if (videoBtn) {
        videoBtn.addEventListener('click', () => {
            alert('Trailer coming soon! Subscribe to be notified.');
        });
    }

    // Intersection Observer for animations on scroll
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // Observe all sections for fade-in effect
    document.querySelectorAll('section').forEach(section => {
        section.style.opacity = '0';
        section.style.transform = 'translateY(20px)';
        section.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(section);
    });

    // Add hover effects to glass panels
    const glassPanels = document.querySelectorAll('.glass-panel');
    glassPanels.forEach(panel => {
        panel.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px)';
        });
        panel.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });

    // Enhanced button feedback
    const buttons = document.querySelectorAll('button:not(.menu-toggle)');
    buttons.forEach(button => {
        button.addEventListener('click', function() {
            // Add click feedback
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = 'scale(1)';
            }, 100);
        });
    });

    // Scroll navbar background on scroll
    const navbar = document.querySelector('nav');
    let lastScrollTop = 0;

    window.addEventListener('scroll', () => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        if (scrollTop > 50) {
            navbar.style.backgroundColor = 'rgba(5, 10, 20, 0.98)';
            navbar.style.backdropFilter = 'blur(10px)';
        } else {
            navbar.style.backgroundColor = 'rgba(5, 10, 20, 0.9)';
            navbar.style.backdropFilter = 'blur(8px)';
        }
        
        lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
    });

    // Add active link highlighting on scroll
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('nav a[href^="#"]');

    window.addEventListener('scroll', () => {
        let current = '';
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            
            if (scrollY >= sectionTop - 200) {
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('text-ncst-gold');
            if (link.getAttribute('href').slice(1) === current) {
                link.classList.add('text-ncst-gold');
            }
        });
    });

    // Console welcome message
    console.log('%cMath Wizard', 'color: #64ffda; font-size: 24px; font-weight: bold;');
    console.log('%cMaster Calculus Through Gaming', 'color: #FFD700; font-size: 14px;');

    // APK download thank-you popup
const apkBtn = document.getElementById('apk-download-btn');
const thanksModal = document.getElementById('download-thanks-modal');
const closeThanks = document.getElementById('close-download-thanks');

const openThanks = () => {
    thanksModal?.classList.remove('hidden');
    thanksModal?.classList.add('flex');
};
const hideThanks = () => {
    thanksModal?.classList.add('hidden');
    thanksModal?.classList.remove('flex');
};

if (apkBtn && thanksModal) {
    // Don't preventDefault: the browser starts the download itself.
    apkBtn.addEventListener('click', () => setTimeout(openThanks, 500));
    closeThanks?.addEventListener('click', hideThanks);
    thanksModal.addEventListener('click', (e) => {
        if (e.target === thanksModal) hideThanks();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') hideThanks();
    });
}
});