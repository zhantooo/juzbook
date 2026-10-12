import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        muted: "var(--muted)",
        card: "var(--card)",
        line: "var(--line)",
        accent: "var(--accent)",
        accentSoft: "var(--accent-soft)",
        success: "var(--success)"
      },
      boxShadow: {
        panel: "0 24px 80px rgba(8, 15, 22, 0.28)"
      },
      borderRadius: {
        xl2: "1.5rem",
        // Үлкен панельдің бұрышы. Радиус шкаласы: 2xl (1rem) ұсақ элемент,
        // 3xl (1.5rem) карта, panel (2rem) панель, full батырма.
        panel: "2rem"
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)"
      }
    }
  },
  plugins: []
};

export default config;
