import type { Config } from "tailwindcss";

/**
 * Europataxi renk sistemi.
 *
 * Renkler doğrudan hex değil, `src/app/globals.css` içinde tanımlı CSS
 * değişkenlerinden gelir. Böylece aynı sınıf adları (`bg-surface`, `text-content`)
 * hem açık hem koyu temada doğru değeri alır; tema değiştirmek için tek bir
 * değişken bloğu yeter, bileşenlere dokunulmaz.
 *
 * Değişmeyen iki renk vardır: `taxi` (marka sarısı, dolgular için) ve `on-taxi`
 * (sarı üstündeki yazı, her zaman siyah). Metin, ikon ve kenarlık vurguları
 * `taxi-ink` kullanır: açık temada sarı beyaz zeminde okunmadığı için koyu
 * kehribara döner (beyaz üzerinde 6,4:1).
 *
 * Tailwind'in varsayılan paleti bilerek kapalıdır: `bg-blue-500` gibi sınıflar
 * derlenmez, siteye mavi sızamaz.
 */
const withOpacity = (variable: string) => `rgb(var(${variable}) / <alpha-value>)`;

const palette = {
  transparent: "transparent",
  current: "currentColor",

  /** Sayfa zemini. */
  surface: withOpacity("--c-surface"),
  /** Yükseltilmiş yüzey: kartlar, widget zemini, ikincil bölümler. */
  "surface-2": withOpacity("--c-surface-2"),
  /** Ana metin rengi. */
  content: withOpacity("--c-content"),
  /** İkincil metin. */
  muted: withOpacity("--c-muted"),
  /** Dekoratif ayraç ve kart kenarlığı. */
  line: withOpacity("--c-line"),
  /** Etkileşimli öğe kenarlığı (WCAG 1.4.11 için en az 3:1). */
  "line-strong": withOpacity("--c-line-strong"),

  /** Marka sarısı; dolgularda her iki temada da aynıdır. */
  taxi: "#FFC20E",
  /** Sarı dolgunun hover durumu. */
  "taxi-dark": "#E0A800",
  /** Sarı zemin üzerindeki yazı; her zaman siyah (12,98:1). */
  "on-taxi": "#000000",
  /** Metin, ikon, kenarlık ve odak halkası vurgusu; temaya göre değişir. */
  "taxi-ink": withOpacity("--c-taxi-ink"),
  /** Karartma katmanı (mobil menü arkası); her zaman siyah. */
  scrim: "#000000",
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
      padding: { DEFAULT: "1rem", md: "1.5rem", lg: "2rem" },
      screens: { sm: "640px", md: "768px", lg: "1024px", xl: "1280px" },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-archivo)", "system-ui", "Segoe UI", "Arial", "sans-serif"],
      },
      borderColor: { DEFAULT: withOpacity("--c-line") },
      ringColor: { DEFAULT: withOpacity("--c-taxi-ink") },
      ringOffsetColor: { DEFAULT: withOpacity("--c-surface") },
      outlineColor: { DEFAULT: withOpacity("--c-taxi-ink") },
      maxWidth: { prose: "70ch" },
      boxShadow: {
        card: "var(--shadow-card)",
        glow: "var(--shadow-glow)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: { "fade-up": "fade-up 0.5s ease-out both" },
    },
  },
  plugins: [],
};

export default config;
