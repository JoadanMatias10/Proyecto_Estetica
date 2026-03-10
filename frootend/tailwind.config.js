/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/**/*.{js,jsx,ts,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                rose: {
                    50: '#FFF9FC',
                    100: '#FFE5F1',
                    200: '#FFD1E3',
                    300: '#FFB7D5',
                    400: '#FF8DC7',
                    500: '#E06BB8',
                    600: '#C94FA0',
                    700: '#9B6B8F',
                    800: '#4A3142',
                },
                violet: {
                    50: '#F5F3FF',
                    100: '#EDE9FE',
                    200: '#DDD6FE',
                    300: '#C4B5FD',
                    400: '#A78BFA',
                    500: '#8B5CF6',
                    600: '#7C3AED',
                    700: '#6D28D9',
                    800: '#5B21B6',
                },
                amber: {
                    50: '#FFFBEB',
                    100: '#FEF3C7',
                    200: '#FDE68A',
                    300: '#FCD34D',
                    400: '#FBBF24',
                    500: '#F59E0B',
                    600: '#D97706',
                },
                emerald: {
                    50: '#ECFDF5',
                    100: '#D1FAE5',
                    400: '#34D399',
                    500: '#10B981',
                    600: '#059669',
                },
            },
            boxShadow: {
                'glow': '0 4px 24px rgba(139, 92, 246, 0.25)',
                'glow-rose': '0 4px 24px rgba(255, 141, 199, 0.3)',
            },
        },
    },
    plugins: [],
}
