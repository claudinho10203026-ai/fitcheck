/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        graphite: {
          950: '#101115',
          900: '#181A20',
          800: '#22252D',
          700: '#2C303A',
          600: '#3A3F4B',
        },
        ember: {
          400: '#FF7A5C',
          500: '#FF5A3C',
          600: '#E8452A',
        },
        mint: {
          400: '#4FE0B8',
          500: '#2DD4A7',
        },
        amber: {
          400: '#FFC15E',
          500: '#FFB238',
        },
        rose: {
          400: '#FB6B77',
          500: '#FB4D5C',
        },
        steel: {
          300: '#B4B9C6',
          400: '#8B93A3',
          500: '#6B7280',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        sans: ['"Inter"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
