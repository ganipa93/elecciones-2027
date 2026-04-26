/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'lla': '#7a3e9d',
        'uxp': '#00a4e4',
        'pd': '#1b263b',
        'fit': '#e51a2d',
        'blanco': '#999999'
      }
    },
  },
  plugins: [],
}
