/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f7ff',
          100: '#dbeefe',
          200: '#bfdefc',
          300: '#93c7fa',
          400: '#60a6f7',
          500: '#3b88f6',
          600: '#2567e1',
          700: '#1d50b8',
          800: '#1b4696',
          900: '#1b3a78'
        }
      }
    }
  },
  plugins: []
}
