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
        // Terminal-inspired palette
        bg: {
          primary: "#0a0a0a",
          secondary: "#111111",
          tertiary: "#1a1a1a",
          elevated: "#222222",
        },
        border: {
          subtle: "#262626",
          DEFAULT: "#333333",
          strong: "#444444",
        },
        text: {
          primary: "#fafafa",
          secondary: "#a1a1a1",
          tertiary: "#666666",
          muted: "#525252",
        },
        accent: {
          DEFAULT: "#22c55e",
          dim: "#16a34a",
          glow: "rgba(34, 197, 94, 0.15)",
          muted: "rgba(34, 197, 94, 0.08)",
        },
        status: {
          live: "#22c55e",
          test: "#eab308",
          revoked: "#ef4444",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "1rem" }],
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out forwards",
        "slide-up": "slideUp 0.5s ease-out forwards",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
        blink: "blink 1s step-end infinite",
        reveal: "reveal 0.8s ease-out forwards",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(34, 197, 94, 0.4)" },
          "50%": { boxShadow: "0 0 20px 5px rgba(34, 197, 94, 0.2)" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        reveal: {
          "0%": { width: "0", opacity: "0" },
          "100%": { width: "100%", opacity: "1" },
        },
      },
      backgroundImage: {
        "grid-pattern":
          "linear-gradient(to right, #1a1a1a 1px, transparent 1px), linear-gradient(to bottom, #1a1a1a 1px, transparent 1px)",
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        noise: "url('/noise.svg')",
      },
    },
  },
  plugins: [],
};

export default config;
