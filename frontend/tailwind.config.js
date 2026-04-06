/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0f4ff',
          100: '#dde5ff',
          200: '#c3cfff',
          300: '#9aadff',
          400: '#697eff',
          500: '#4455f5',
          600: '#3338e8',
          700: '#2b2cce',
          800: '#2628a7',
          900: '#252884',
        }
      }
    }
  },
  plugins: [],
}
