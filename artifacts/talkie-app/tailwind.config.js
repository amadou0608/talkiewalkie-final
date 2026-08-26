/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // --- Jeton de couleurs "poste radio numerique" ---
        ink: '#12161C',        // fond principal (chassis)
        panel: '#1B212A',      // cartes / surfaces
        panel2: '#232B36',     // surfaces surelevees / hover
        line: '#2C3541',       // hairlines, bordures de cadran
        signal: '#3FAFA6',     // teal — en ligne / connecte
        signalDim: '#255956',
        transmit: '#F0A233',   // ambre — en cours de transmission (LED d'appareil radio)
        transmitDim: '#7A5420',
        alert: '#E1594F',      // corail — hors ligne / erreur
        paper: '#EDEFF2',      // texte clair
        paperDim: '#9AA4B2',   // texte secondaire
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        dial: '0 0 0 1px rgba(255,255,255,0.04), 0 20px 60px -20px rgba(0,0,0,0.7)',
      },
      keyframes: {
        pulseRing: {
          '0%': { transform: 'scale(0.95)', opacity: '0.55' },
          '70%': { transform: 'scale(1.55)', opacity: '0' },
          '100%': { transform: 'scale(1.55)', opacity: '0' },
        },
        vu: {
          '0%, 100%': { transform: 'scaleY(0.3)' },
          '50%': { transform: 'scaleY(1)' },
        },
      },
      animation: {
        pulseRing: 'pulseRing 1.6s cubic-bezier(0.2,0.6,0.4,1) infinite',
        vu: 'vu 0.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
