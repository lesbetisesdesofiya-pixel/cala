/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./app/**/*.html", "./app/**/*.js"],
  theme: {
    extend: {
      colors: {
        background: "#f8f9ff", surface: "#f8f9ff", "surface-container-lowest": "#ffffff",
        "surface-container-low": "#eff4ff", "surface-container": "#e5eeff",
        "surface-container-high": "#dce9ff", "surface-container-highest": "#d3e4fe",
        "surface-variant": "#d3e4fe",
        primary: "#001428", "primary-container": "#0f2942",
        secondary: "#7d5800", "secondary-container": "#ffb702",
        "secondary-fixed": "#ffdea9", "secondary-fixed-dim": "#ffba27",
        "on-secondary-fixed": "#271900", "on-secondary-container": "#6b4b00",
        tertiary: "#00122d", "tertiary-container": "#08274e",
        "on-surface": "#0b1c30", "on-surface-variant": "#43474d",
        outline: "#74777e", "outline-variant": "#c3c6ce",
        error: "#ba1a1a", "error-container": "#ffdad6"
      },
      fontFamily: { sans: ["Plus Jakarta Sans", "sans-serif"] },
      boxShadow: {
        card: "0 4px 16px -2px rgba(15,41,66,0.05)",
        navy: "0 8px 24px -4px rgba(15,41,66,0.25)"
      }
    }
  },
  plugins: [require("@tailwindcss/forms")]
};
