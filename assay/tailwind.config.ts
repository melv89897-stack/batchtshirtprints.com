import type { Config } from "tailwindcss";

/**
 * Design tokens lifted directly from the Assay brand board (1-prototypes/09-brand-board.jsx)
 * so every screen in the app draws from the same palette instead of re-guessing colors.
 */
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#12151C",
        "ink-soft": "#2A2F3A",
        canvas: "#F3F4F6",
        surface: "#FFFFFF",
        "surface-alt": "#FAFBFC",
        line: "#E4E6EB",
        "line-soft": "#EEF0F3",
        sub: "#6B7280",
        "sub-light": "#9AA1AC",
        brand: "#14324B",
        trust: "#0E7A5F",
        "trust-bg": "#E8F2EE",
        live: "#8A2B2B",
        "live-bg": "#F6EBEB",
        gold: "#9C7A3C",
        "gold-bg": "#F4EDDF",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        ui: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        card: "16px",
      },
    },
  },
  plugins: [],
};
export default config;
