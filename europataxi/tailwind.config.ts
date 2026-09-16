import type { Config } from "tailwindcss";

/**
 * Europataxi renk paleti. Bileşenlerde ham hex kullanılmaz; yalnızca bu isimler.
 * Tailwind'in varsayılan paleti bilerek KAPATILMIŞTIR: `bg-blue-500` gibi sınıflar
 * derlenmez, böylece siteye mavi ton sızamaz.
 */
const palette = {
  transparent: "transparent",
  current: "currentColor",
  ink: "#000000",
  "ink-soft": "#141414",
  line: "#2A2A2A",
  /**
   * Etkileşimli öğelerin kenarlığı (alanlar, sayaç, anahtar, ikincil buton).
   * WCAG 1.4.11 bileşen sınırları için 3:1 ister; `line` siyah zeminde 1,46:1'de kalır,
   * bu ton hem `ink` hem `ink-soft` üzerinde 3:1'i geçer. Dekoratif ayraçlar `line` kalır.
   */
  "line-strong": "#666666",
  taxi: "#FFC20E",
  "taxi-dark": "#E0A800",
  paper: "#FFFFFF",
  muted: "#A3A3A3",
};

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    colors: palette,
    /** Tip ölçeği: 12 (yalnızca yasal/etiket) / 14 / 16 / 20 / 28 / 40 / 56 px */
    fontSize: {
      xs: ["0.75rem", { lineHeight: "1rem" }],
      sm: ["0.875rem", { lineHeight: "1.25rem" }],
      base: ["1rem", { lineHeight: "1.5rem" }],
      lg: ["1.25rem", { lineHeight: "1.75rem" }],
      xl: ["1.75rem", { lineHeight: "2.125rem" }],
      "2xl": ["2.5rem", { lineHeight: "2.875rem" }],
      "3xl": ["3.5rem", { lineHeight: "3.75rem" }],
    },
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        md: "1.5rem",
        lg: "2rem",
      },
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-archivo)", "system-ui", "Segoe UI", "Arial", "sans-serif"],
      },
      borderColor: {
        DEFAULT: palette.line,
      },
      ringColor: {
        DEFAULT: palette.taxi,
      },
      ringOffsetColor: {
        DEFAULT: palette.ink,
      },
      outlineColor: {
        DEFAULT: palette.taxi,
      },
      maxWidth: {
        prose: "70ch",
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 12px 40px -20px rgba(0,0,0,0.9)",
        glow: "0 0 0 1px rgba(255,194,14,0.35), 0 18px 50px -20px rgba(255,194,14,0.35)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
