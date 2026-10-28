/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#F3EFE6",
        surface: "#FFFCF5",
        ink: {
          DEFAULT: "#292331",
          light: "#4E4659",
          muted: "#786E80",
          faint: "#A59CAE",
        },
        copper: {
          DEFAULT: "#A6533D",
          hover: "#8E4430",
          light: "#F7ECE8",
          border: "#E4B2A5",
        },
        teal: {
          DEFAULT: "#276660",
          hover: "#1F524D",
          light: "#E7F3F2",
          border: "#95C6C1",
        },
        saffron: {
          DEFAULT: "#D5A441",
          hover: "#BD8E30",
          light: "#FBF5E5",
          border: "#ECCF89",
        },
        critical: {
          DEFAULT: "#A73752",
          hover: "#8F2A42",
          light: "#FAEAEE",
          border: "#E3A3B2",
        },
        border: {
          DEFAULT: "#DCD4C7",
          subtle: "#EBE5DB",
          dark: "#B8ACA0",
        },
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'Cambria', 'serif'],
        sans: ['"Inter"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        sm: '6px',
        md: '8px',
        lg: '10px',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(41, 35, 49, 0.05)',
        md: '0 4px 6px -1px rgba(41, 35, 49, 0.07), 0 2px 4px -1px rgba(41, 35, 49, 0.04)',
        card: '0 1px 3px rgba(41, 35, 49, 0.06), 0 1px 2px rgba(41, 35, 49, 0.04)',
      }
    },
  },
  plugins: [],
}
