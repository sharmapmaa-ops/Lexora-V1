/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Deep navy + electric blue - a distinct, premium SaaS palette
        // rather than the generic "blue-500 everywhere" Tailwind
        // default look.
        brand: {
          950: "#070b1a",
          900: "#0b1330",
          800: "#111b3f",
          700: "#182658",
          600: "#213374",
          500: "#2f47a3",
          400: "#4a67d6",
          300: "#7d95e8",
          200: "#b8c5f2",
          100: "#e4e9fb",
          50: "#f3f5fd",
        },
        accent: {
          600: "#0ea86f",
          500: "#12c17f",
          400: "#3fd89a",
        },
        danger: {
          600: "#c0392b",
          500: "#dc2626",
        },
        surface: {
          DEFAULT: "#ffffff",
          subtle: "#f7f8fc",
          muted: "#eef0f8",
        },
      },
      fontFamily: {
        sans: ["'Inter'", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        display: ["'Lexend'", "'Inter'", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(11,19,48,0.04), 0 8px 24px rgba(11,19,48,0.06)",
        "card-hover": "0 4px 12px rgba(11,19,48,0.08), 0 16px 40px rgba(11,19,48,0.10)",
        popover: "0 12px 40px rgba(11,19,48,0.18)",
      },
      borderRadius: {
        xl2: "1.1rem",
      },
    },
  },
  plugins: [],
};
