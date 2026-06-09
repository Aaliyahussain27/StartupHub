/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'blue-tide': '#97A3AE',
        'soft-sand': '#DCCCB4',
        'driftwood': '#8A5033',
        'hub-bg': '#0B0F19',
        'hub-card': '#131C2E',
        'hub-border': '#222F47',
        'hub-text': '#E2E8F0',
      },
    },
  },
  plugins: [],
}
