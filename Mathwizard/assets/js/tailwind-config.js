tailwind.config = {
    theme: {
        extend: {
            fontFamily: {
                magic:   ['"Cinzel Decorative"', 'Georgia', 'serif'],
                heading: ['Cinzel', 'Georgia', 'serif'],
                tech:    ['"Crimson Text"', 'Georgia', 'serif'],
                flavor:  ['"IM Fell English"', 'Georgia', 'serif'],
            },
            colors: {
                ncst: {
                    dark:   '#1a0e05',   /* deep dungeon */
                    blue:   '#2c1a0b',   /* aged mahogany */
                    gold:   '#d4a843',   /* burnished gold */
                    neon:   '#f0d98a',   /* pale candlelight */
                    accent: '#2d6a4f',   /* forest sage */
                    crim:   '#8b1a1a',   /* heraldic crimson */
                    stone:  '#3a2a1e',   /* smoked stone */
                }
            },
            backgroundImage: {
                'grid-pattern': "linear-gradient(to right, rgba(212, 168, 67, 0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(212, 168, 67, 0.04) 1px, transparent 1px)",
            },
            animation: {
                'pulse-slow':    'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'spin-slow':     'spin 20s linear infinite',
                'breathe-gold':  'breathe-gold 3.5s ease-in-out infinite',
                'float-card':    'float-card 5s ease-in-out infinite',
                'runic-pulse':   'runic-pulse 2.5s ease-in-out infinite',
            },
            keyframes: {
                'breathe-gold': {
                    '0%, 100%': { boxShadow: '0 0 10px rgba(212,168,67,0.25)' },
                    '50%':       { boxShadow: '0 0 24px rgba(212,168,67,0.65), 0 0 48px rgba(212,168,67,0.25)' },
                },
                'float-card': {
                    '0%, 100%': { transform: 'translateY(0px)' },
                    '50%':      { transform: 'translateY(-7px)' },
                },
                'runic-pulse': {
                    '0%, 100%': { textShadow: '0 0 8px rgba(212,168,67,0.5)' },
                    '50%':      { textShadow: '0 0 20px rgba(212,168,67,1.0), 0 0 40px rgba(212,168,67,0.5)' },
                },
            }
        }
    }
}
