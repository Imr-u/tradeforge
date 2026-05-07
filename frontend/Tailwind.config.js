/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        forge: {
          bg:      '#0b0d11',
          surface: '#13161d',
          panel:   '#1a1e28',
          border:  '#252a38',
          muted:   '#3a4055',
          text:    '#c8cfe0',
          subtle:  '#6b7491',
          accent:  '#4f8ef7',
          green:   '#22d3a5',
          red:     '#f7536b',
          yellow:  '#f7c948',
          purple:  '#9b7af7',
        }
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 20px rgba(79,142,247,0.15)',
      }
    },
  },
  plugins: [],
}