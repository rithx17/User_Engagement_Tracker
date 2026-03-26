/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6ff',
          100: '#d9ebff',
          200: '#bad9ff',
          300: '#8ec2ff',
          400: '#5ea2ff',
          500: '#3b82f6',
          600: '#1e63dc',
          700: '#1a4fb0',
          800: '#1c438f',
          900: '#1e3a76'
        }
      },
      boxShadow: {
        soft: '0 8px 30px rgba(15, 23, 42, 0.08)'
      }
    }
  },
  plugins: []
};
