import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "var(--primary)", hover: "var(--primary-hover)", soft: "var(--primary-soft)" },
        header: { DEFAULT: "var(--header)", 2: "var(--header-2)" },
        accent: "var(--accent)",
        appbg: "var(--bg-app)",
        surface: { DEFAULT: "var(--surface)", 2: "var(--surface-2)" },
        line: "var(--border)",
        ink: { DEFAULT: "var(--text)", muted: "var(--text-muted)", subtle: "var(--text-subtle)" },
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
      },
    },
  },
  plugins: [],
};
export default config;
