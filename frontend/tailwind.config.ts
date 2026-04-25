import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-base':      '#0a0a0f',
        'bg-surface':   '#111118',
        'bg-elevated':  '#1a1a24',
        'border-dim':   '#2a2a3a',
        'border-bright':'#3a3a4a',
        accent:         '#7c80b0',
        'accent-glow':  'rgba(124,128,176,0.12)',
        'text-primary': '#c8c8d8',
        'text-secondary':'#7a7a94',
        'text-muted':   '#4e4e64',
        success:        '#3d7a50',
        warning:        '#8a6a2a',
        error:          '#7a3434',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      letterSpacing: {
        label: '0.08em',
        wide:  '0.05em',
        ocr:   '0.1em',
      },
      boxShadow: {
        card:  '0 0 0 1px #2a2a3a',
        glow:  '0 0 20px rgba(124,128,176,0.12)',
        'glow-sm': '0 0 12px rgba(124,128,176,0.08)',
      },
      animation: {
        pulse_slow: 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'count-in': 'countIn 0.6s ease-out forwards',
        'fade-up':  'fadeUp 0.4s ease-out forwards',
        shimmer:    'shimmer 1.5s infinite',
        spin_slow:  'spin 1s linear infinite',
      },
      keyframes: {
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        countIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}

export default config
