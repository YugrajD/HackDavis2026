import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#050608",
        asphalt: "#080a0d",
        surface: "#0c1116",
        "surface-raised": "#111820",
        "surface-hot": "#17120b",
        line: "#1f2a33",
        "line-strong": "#33424d",
        roadText: "#e8edf0",
        "roadText-muted": "#9aa6ad",
        "roadText-dim": "#5f6b74",
        amber: "#f59e0b",
        orange: "#f97316",
        critical: "#fb4e1b",
        telemetry: "#22d3ee",
        panel: "#0c1116",
        cyanline: "#22d3ee",
        warning: "#f59e0b",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular"],
      },
    },
  },
  plugins: [],
};

export default config;
