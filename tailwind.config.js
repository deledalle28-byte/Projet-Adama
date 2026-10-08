/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./visite.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        nuit: { DEFAULT: "#0B1426", 2: "#14213D", 3: "#1F2F52" },
        or: { DEFAULT: "#E3A93B", clair: "#F5C56B", fonce: "#B7801E" },
        turquoise: "#3FC1B0",
        papier: "#F7F4EE",
      },
      fontFamily: {
        sans: ["Inter", "Segoe UI", "system-ui", "-apple-system", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
