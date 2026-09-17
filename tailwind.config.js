/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Aurora liquid-glass language: deep storm-teal atmosphere, white ink.
        // "ink" = page/atmosphere surfaces, "bone" = text tones, amber.film = glass accent.
        ink: {
          950: "#04121b",
          900: "#0a1f2c",
          850: "#0e2635",
          800: "#12303f",
          700: "#1a3d4f",
          600: "#28505f",
          500: "#3d6675",
        },
        bone: {
          50: "#ffffff",
          100: "rgba(255,255,255,0.93)",
          200: "rgba(255,255,255,0.85)",
          300: "rgba(255,255,255,0.75)",
          400: "rgba(255,255,255,0.62)",
        },
        amber: {
          film: "#7dd3c8",
          film_dim: "#5bb8ad",
        },
      },
      fontFamily: {
        serif: ["Inter Tight", "Inter", "sans-serif"],
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
