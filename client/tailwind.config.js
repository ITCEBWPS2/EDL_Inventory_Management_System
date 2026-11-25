/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        edl: {
          ink: "#280818",
          deep: "#3b0c20",
          maroon: "#5a1230",
          wine: "#7a1a3c",
          gold: "#f6c026",
          cream: "#fbf6f1"
        },
        ink: "#280818",
        surface: "#fcfbf9",
        card: "#ffffff",
        line: "#eee6e1",
        slate: {
          DEFAULT: "#8a7a80",
          50: '#faf8f7',
          100: '#f5eff0',
          200: '#e6dcd7',
          300: '#c5b8bc',
          400: '#a3959a',
          500: '#8a7a80',
          600: '#736167',
          700: '#5c4c52',
          800: '#47393e',
          900: '#33272b',
        },
        signal: {
          DEFAULT: "#f6c026",
          hover: "#e5af1d",
          light: "#fdf8eb",
        },
        status: {
          in: "#2e7d58",
          inBg: "rgba(46, 125, 88, 0.12)",
          out: "#b33947",
          outBg: "rgba(179, 57, 71, 0.12)",
          transfer: "#8a7a80",
          transferBg: "rgba(138, 122, 128, 0.12)",
        }
      },
      fontFamily: {
        sans: ['"Inter"', '"IBM Plex Sans"', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '10px',
        xl: '12px',
        '2xl': '16px',
      },
      boxShadow: {
        subtle: '0 1px 3px rgba(15, 15, 30, 0.08), 0 1px 2px rgba(15, 15, 30, 0.04)',
        card: '0 1px 2px rgba(15, 15, 30, 0.10), 0 8px 22px rgba(15, 15, 30, 0.14)',
        'card-hover': '0 12px 28px rgba(15, 15, 30, 0.20)',
        'card-active': '0 2px 6px rgba(15, 15, 30, 0.12)',
        modal: '0 10px 30px -5px rgba(40, 8, 24, 0.20), 0 4px 12px -2px rgba(40, 8, 24, 0.10)',
      }
    },
  },
  plugins: [],
}
