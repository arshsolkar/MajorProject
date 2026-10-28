/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#15213B',
        brand: { 50: '#eff6ff', 100: '#dbeafe', 500: '#2563eb', 600: '#1d4ed8', 700: '#1d3c91' },
      },
      boxShadow: { panel: '0 8px 24px rgba(15, 23, 42, 0.06)' },
    },
  },
  plugins: [],
}
