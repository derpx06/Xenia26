/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Adding specific dark theme colors to match the landing page
        background: "#000000",
        foreground: "#ffffff",
        primary: "#3b82f6", // Blue
        card: "rgba(255, 255, 255, 0.05)",
        border: "rgba(255, 255, 255, 0.1)",
      },
    },
  },
  plugins: [],
}