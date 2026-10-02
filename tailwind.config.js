/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Papercut theatre language: deep plum-ink stage, warm paper accents.
        // "ink" = page/atmosphere surfaces, "bone" = text tones, amber.film = construction-paper gold accent.
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
          film: "#e8a33d",
          film_dim: "#cf8f2f",
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
