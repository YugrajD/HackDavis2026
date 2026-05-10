import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        lime:       "#beff50",
        "near-black": "#14140f",
        "warm-cream": "#f5f5eb",
        parchment:  "#fafaf5",
        stone:      "#d2d2c8",
        graphite:   "#6e6e64",
        charcoal:   "#30302a",
        "slate-border": "#919183",
        mint:       "#1dc479",
        coral:      "#eb3131",
      },
      borderRadius: {
        card:   "26px",
        badge:  "8px",
        circle: "50%",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Cabinet Grotesk", "General Sans", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular"],
      },
    },
  },
  plugins: [],
};

export default config;
