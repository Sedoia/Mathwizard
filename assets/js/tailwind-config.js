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
                    dark:   '#fffdf8',   /* warm white canvas */
                    blue:   '#f4efe4',   /* ivory surface */
                    gold:   '#b38728',   /* refined gold */
                    neon:   '#c59a3d',   /* accessible gold accent */
                    accent: '#496b58',   /* muted sage */
                    crim:   '#a0443f',   /* restrained warm red */
                    stone:  '#e5ded0',   /* soft stone */
                }
            },
            backgroundImage: {
                'grid-pattern': "linear-gradient(to right, rgba(179, 135, 40, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(179, 135, 40, 0.05) 1px, transparent 1px)",
            },
            animation: {
                'pulse-slow':    'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'spin-slow':     'spin 20s linear infinite',
                'breathe-gold':  'none',
                'float-card':    'float-card 5s ease-in-out infinite',
                'runic-pulse':   'none',
            },
            keyframes: {
                'breathe-gold': {
                    '0%, 100%': { boxShadow: 'none' },
                    '50%':       { boxShadow: 'none' },
                },
                'float-card': {
                    '0%, 100%': { transform: 'translateY(0px)' },
                    '50%':      { transform: 'translateY(-7px)' },
                },
                'runic-pulse': {
                    '0%, 100%': { textShadow: 'none' },
                    '50%':      { textShadow: 'none' },
                },
            }
        }
    }
}
