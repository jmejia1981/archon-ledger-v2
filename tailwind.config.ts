import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f5fb',
          100: '#e0ebf7',
          200: '#c1d7ef',
          300: '#a2c3e7',
          400: '#83afdf',
          500: '#1a3a6b',
          600: '#153156',
          700: '#102841',
          800: '#0b1f2c',
          900: '#051617',
        },
      },
      fontFamily: {
        inter: ['var(--font-inter)', 'sans-serif'],
        playfair: ['var(--font-playfair)', 'serif'],
      },
    },
  },
  plugins: [],
}

export default config
