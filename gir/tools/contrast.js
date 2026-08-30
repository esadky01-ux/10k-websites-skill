/* WCAG AA kontrast denetimi — tokens.css içindeki 4 tema için
   kullanılan renk çiftlerini hesaplar. Normal metin eşiği 4.5:1,
   büyük/kalın metin eşiği 3:1. */
const fs = require("fs");
const path = require("path");
const css = fs.readFileSync(path.join(__dirname, "..", "css/tokens.css"), "utf8");

function parseBlock(selector) {
  const re = new RegExp(selector.replace(/[[\]"=\-]/g, (c) => "\\" + c) + "\\s*{([^}]+)}", "m");
  const m = css.match(re);
  const out = {};
  if (!m) { return out; }
  for (const line of m[1].matchAll(/--([a-z-]+):\s*([^;]+);/g)) { out["--" + line[1]] = line[2].trim(); }
  return out;
}

const base = parseBlock(":root");
const themes = {
  "navy-gold": { ...base, ...parseBlock('[data-theme="navy-gold"]') },
  "warm-clay": { ...base, ...parseBlock('[data-theme="warm-clay"]') },
  "charcoal-brass": { ...base, ...parseBlock('[data-theme="charcoal-brass"]') },
  "sage-linen": { ...base, ...parseBlock('[data-theme="sage-linen"]') }
};

function lum(hex) {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(fg, bg) {
  const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

/* [ön plan, arka plan, eşik, açıklama] */
const PAIRS = [
  ["--color-text", "--color-bg", 4.5, "gövde metni / zemin"],
  ["--color-text", "--color-surface", 4.5, "gövde metni / kart"],
  ["--color-text-muted", "--color-bg", 4.5, "soluk metin / zemin"],
  ["--color-text-muted", "--color-surface", 4.5, "soluk metin / kart"],
  ["--color-primary", "--color-bg", 4.5, "başlık-link / zemin"],
  ["--color-primary", "--color-surface", 4.5, "başlık-link / kart"],
  ["--color-on-primary", "--color-primary", 4.5, "birincil buton metni"],
  ["--color-on-primary", "--color-primary-hover", 4.5, "birincil buton hover"],
  ["--color-on-accent", "--color-accent", 4.5, "vurgu buton metni"],
  ["--color-on-primary", "--color-accent-hover", 4.5, "vurgu buton hover"],
  ["--color-topbar-text", "--color-topbar-bg", 4.5, "topbar"],
  ["--color-footer-text", "--color-footer-bg", 4.5, "footer metni"],
  ["--color-footer-muted", "--color-footer-bg", 4.5, "footer soluk"],
  ["--color-badge-text", "--color-badge", 4.5, "badge"],
  ["--color-price", "--color-surface", 4.5, "fiyat"],
  ["--color-price-old", "--color-surface", 4.5, "eski fiyat"],
  ["--color-success", "--color-surface", 4.5, "stok durumu"],
  ["--color-success", "--color-bg", 4.5, "stok durumu / zemin"],
  ["--color-accent-soft", "--color-topbar-bg", 3, "topbar ikonları (dekoratif eşik)"],
  ["--color-accent-soft", "--color-footer-bg", 3, "footer altın vurgu (büyük/ikon)"],
  ["--color-accent-soft", "--color-primary", 3, "nav aktif alt çizgi / hero eyebrow"]
];

let fails = 0;
for (const [name, vars] of Object.entries(themes)) {
  console.log(`\n— tema: ${name}`);
  for (const [fg, bg, min, label] of PAIRS) {
    if (!vars[fg] || !vars[bg]) { console.log(`  ? ${label}: değişken yok (${fg}/${bg})`); fails++; continue; }
    const r = ratio(vars[fg], vars[bg]);
    const ok = r >= min;
    if (!ok) { fails++; }
    console.log(`  ${ok ? "✓" : "✗"} ${label}: ${vars[fg]} / ${vars[bg]} = ${r.toFixed(2)} (min ${min})`);
  }
}
console.log(fails ? `\n✗ ${fails} kontrast ihlali` : "\n✓ tüm temalar AA eşiklerini geçiyor");
process.exitCode = fails ? 1 : 0;
