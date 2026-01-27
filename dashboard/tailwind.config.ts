import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Clean, minimal light palette (inspired by inspect-mvp)
        bg: {
          primary: "#fefefe",
          secondary: "#f8f9fa",
          tertiary: "#f1f3f5",
          elevated: "#ffffff",
          sidebar: "#fafbfc",
        },
        border: {
          subtle: "#f1f5f9",
          DEFAULT: "#e2e8f0",
          strong: "#cbd5e1",
        },
        text: {
          primary: "#0f172a",
          secondary: "#64748b",
          tertiary: "#94a3b8",
          muted: "#94a3b8",
        },
        accent: {
          DEFAULT: "#2563eb",
          dim: "#1d4ed8",
          light: "#dbeafe",
          "50": "#eff6ff",
          "100": "#dbeafe",
          "500": "#3b82f6",
          "600": "#2563eb",
        },
        status: {
          live: "#10b981",
          test: "#f59e0b",
          revoked: "#ef4444",
        },
        success: {
          DEFAULT: "#10b981",
          light: "#ecfdf5",
        },
        warning: {
          DEFAULT: "#f59e0b",
          light: "#fffbeb",
        },
        error: {
          DEFAULT: "#ef4444",
          light: "#fef2f2",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      boxShadow: {
        sm: "0 1px 3px 0 rgb(0 0 0 / 0.04)",
        md: "0 4px 6px -1px rgb(0 0 0 / 0.05)",
        lg: "0 10px 15px -3px rgb(0 0 0 / 0.05), 0 4px 6px -2px rgb(0 0 0 / 0.03)",
        xl: "0 20px 25px -5px rgb(0 0 0 / 0.05), 0 10px 10px -5px rgb(0 0 0 / 0.02)",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out forwards",
        "fade-in-up": "fadeInUp 0.5s ease-out forwards",
        "fade-in-down": "fadeInDown 0.5s ease-out forwards",
        "slide-up": "slideUp 0.5s ease-out forwards",
        "scale-in": "scaleIn 0.2s ease-out forwards",
        pulse: "pulse 2s ease-in-out infinite",
        "cat-float": "catFloat 3s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeInDown: {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        catFloat: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
      },
      borderRadius: {
        sm: "4px",
        md: "6px",
        lg: "8px",
        xl: "12px",
      },
      spacing: {
        "1": "0.25rem",
        "2": "0.5rem",
        "3": "0.75rem",
        "4": "1rem",
        "5": "1.25rem",
        "6": "1.5rem",
        "8": "2rem",
        "10": "2.5rem",
      },
    },
  },
  plugins: [],
};

export default config;
