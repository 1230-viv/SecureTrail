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
        severity: {
          critical: '#DC2626',
          criticalLight: '#FEE2E2',
          criticalDark: '#7F1D1D',
          high: '#EA580C',
          highLight: '#FFEDD5',
          highDark: '#7C2D12',
          medium: '#CA8A04',
          mediumLight: '#FEF9C3',
          mediumDark: '#713F12',
          low: '#2563EB',
          lowLight: '#DBEAFE',
          lowDark: '#1E3A8A',
        },
        surface: {
          light: '#F8FAFC',
          card: '#FFFFFF',
          dark: '#0B0E1A',
          darkCard: '#161B2E',
          darkElevated: '#1E2642',
        },
      },
      fontSize: {
        'display': ['56px', { lineHeight: '1', fontWeight: '900', letterSpacing: '-0.02em' }],
        'metric-lg': ['40px', { lineHeight: '1', fontWeight: '900', letterSpacing: '-0.02em' }],
        'metric-md': ['28px', { lineHeight: '1', fontWeight: '800' }],
      },
      boxShadow: {
        'card': '0 1px 3px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.04)',
        'card-hover': '0 8px 32px rgba(99, 102, 241, 0.15)',
        'hero': '0 4px 24px rgba(99, 102, 241, 0.12), 0 2px 8px rgba(15, 23, 42, 0.06)',
        'alert': '0 4px 24px rgba(239, 68, 68, 0.15), 0 0 0 1px rgba(239, 68, 68, 0.1)',
        'dark-card': '0 4px 16px rgba(0, 0, 0, 0.4)',
        'dark-hero': '0 8px 40px rgba(0, 0, 0, 0.6), 0 0 1px rgba(99, 102, 241, 0.3)',
      },
    },
  },
  plugins: [],
}
