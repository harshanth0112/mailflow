/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#F7F6F2',
        surface: '#FFFFFF',
        ink: {
          DEFAULT: '#191919',
          muted: '#77736D',
        },
        brand: {
          red: '#EF493C',
          dark: '#241A12',
        },
        border: {
          subtle: '#E5E1D9',
        },
        status: {
          success: '#25845A',
          warning: '#D58A24',
          error: '#C9473D',
        },
      },
      fontFamily: {
        display: ['Anton', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
        mono: ['"Martian Mono"', 'monospace'],
      },
      borderRadius: {
        'editorial': '2px',
        'subtle': '4px',
        'card': '8px',
      },
      boxShadow: {
        'warm': '0 2px 8px -2px rgba(36, 26, 18, 0.06), 0 1px 3px -1px rgba(36, 26, 18, 0.04)',
        'elevated': '0 12px 24px -6px rgba(36, 26, 18, 0.08), 0 4px 8px -2px rgba(36, 26, 18, 0.04)',
      },
    },
  },
  plugins: [],
};
