/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/**/*.{js,jsx,ts,tsx}",
    ],
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
            },
            boxShadow: {
                'glow': '0 4px 24px rgba(255, 141, 199, 0.3)',
            },
        },
    },
    plugins: [],
}
