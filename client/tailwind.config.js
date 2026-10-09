/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#10233B",
        surface: "#FAFAF9",
        card: "#FFFFFF",
        line: "#E1E4E8",
        slate: "#5B6B7C",
        signal: {
          DEFAULT: "#E8A23A",
          hover: "#D6922C",
          light: "#FDF5E8",
        },
        status: {
          in: "#2F7A5C",
          inBg: "rgba(47, 122, 92, 0.12)",
          out: "#B4483A",
          outBg: "rgba(180, 72, 58, 0.12)",
          transfer: "#5B6B7C",
          transferBg: "rgba(91, 107, 124, 0.12)",
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
      },
      boxShadow: {
        subtle: '0 1px 3px rgba(16, 35, 59, 0.05), 0 1px 2px rgba(16, 35, 59, 0.03)',
        card: '0 2px 8px -2px rgba(16, 35, 59, 0.06), 0 1px 4px -1px rgba(16, 35, 59, 0.04)',
        modal: '0 10px 30px -5px rgba(16, 35, 59, 0.15), 0 4px 12px -2px rgba(16, 35, 59, 0.08)',
      }
    },
  },
  plugins: [],
}
