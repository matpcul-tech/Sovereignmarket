/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          0: '#050605',
          1: '#0a0c0a',
          2: '#11140f',
          3: '#181c14',
        },
        line: {
          DEFAULT: '#1f2418',
          bright: '#2e3a1e',
        },
        amber: {
          DEFAULT: '#d4a017',
          bright: '#f5c542',
          dim: '#8a6b13',
        },
        green: {
          DEFAULT: '#6fcf3f',
          bright: '#9eff5e',
          dim: '#3d7821',
        },
        red: {
          DEFAULT: '#e84545',
          bright: '#ff6464',
          dim: '#8a2929',
        },
        text: {
          0: '#e8e6dc',
          1: '#b8b5a5',
          2: '#76735f',
          3: '#4a4838',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        serif: ['Fraunces', 'serif'],
      },
    },
  },
  plugins: [],
};
