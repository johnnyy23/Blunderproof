import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        board: {
          dark: "#536b4f",
          light: "#c8d6a5"
        }
      },
      boxShadow: {
        glow: "0 18px 80px rgba(34, 197, 94, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
