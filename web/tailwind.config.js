/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        visor: {
          bg: "#0a0a0f",
          card: "#12121a",
          border: "#1e1e2e",
          accent: "#6366f1",
          green: "#22c55e",
          red: "#ef4444",
          yellow: "#eab308",
        },
      },
    },
  },
  plugins: [],
};
