/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0b0b0d",
          900: "#121215",
          850: "#17171b",
          800: "#1d1d22",
          700: "#26262c",
          600: "#33333b",
          500: "#4a4a54",
        },
        bone: {
          50: "#faf9f6",
          100: "#f1efe9",
          200: "#e2dfd5",
          300: "#c8c4b6",
          400: "#a29d8c",
        },
        amber: {
          film: "#e8a33d",
          film_dim: "#b5772a",
        },
      },
      fontFamily: {
        serif: ["Georgia", "Times New Roman", "serif"],
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
