/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', 
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
        'cyber-cyan': '#06b6d4',
        'cyber-emerald': '#10b981',
        'neon-violet': '#8b5cf6',
        'glow-indigo': '#6366f1',
        'premium-dark': '#030712',
      },
    },
  },
  plugins: [],
}