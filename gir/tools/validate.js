/* Kırık link / eksik görsel / i18n anahtar eşitliği denetimi.
   Kullanım: node tools/validate.js  (çıkış kodu 0 = temiz) */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

const errors = [];

/* 1) i18n sözlükleri aynı anahtar kümesine sahip mi? */
function flatten(obj, prefix = "") {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? flatten(v, prefix + k + ".") : [prefix + k]);
}
const fr = JSON.parse(fs.readFileSync(path.join(ROOT, "data/i18n/fr.json"), "utf8"));
const tr = JSON.parse(fs.readFileSync(path.join(ROOT, "data/i18n/tr.json"), "utf8"));
const frKeys = new Set(flatten(fr));
const trKeys = new Set(flatten(tr));
for (const k of frKeys) { if (!trKeys.has(k)) { errors.push(`i18n: tr.json içinde eksik anahtar: ${k}`); } }
for (const k of trKeys) { if (!frKeys.has(k)) { errors.push(`i18n: fr.json içinde eksik anahtar: ${k}`); } }

/* 2) HTML sayfalarında href/src/srcset hedefleri mevcut mu? */
const pages = [];
for (const dir of ["fr", "tr"]) {
  for (const f of fs.readdirSync(path.join(ROOT, dir))) {
    if (f.endsWith(".html")) { pages.push(path.join(dir, f)); }
  }
}
pages.push("index.html");

const SKIP = /^(https?:|mailto:|tel:|#|data:)/;
for (const rel of pages) {
  const html = fs.readFileSync(path.join(ROOT, rel), "utf8");
  const dir = path.dirname(path.join(ROOT, rel));
  const targets = new Set();

  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) { targets.add(m[1]); }
  for (const m of html.matchAll(/srcset="([^"]+)"/g)) {
    for (const part of m[1].split(",")) { targets.add(part.trim().split(/\s+/)[0]); }
  }
  for (let url of targets) {
    if (SKIP.test(url) || !url) { continue; }
    url = url.split("#")[0].split("?")[0];
    if (!url) { continue; }
    const file = path.resolve(dir, decodeURIComponent(url));
    if (!fs.existsSync(file)) { errors.push(`${rel}: hedef yok → ${url}`); }
  }

  /* 3) img alt zorunlu */
  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    if (!/\balt="/.test(m[0])) { errors.push(`${rel}: alt eksik → ${m[0].slice(0, 80)}…`); }
  }
}

/* 4) products.json görselleri + swatch mevcut mu? */
const data = JSON.parse(fs.readFileSync(path.join(ROOT, "data/products.json"), "utf8"));
for (const p of data.products) {
  for (const img of [...p.images, p.swatch]) {
    if (!fs.existsSync(path.join(ROOT, img))) { errors.push(`products.json: dosya yok → ${img}`); }
    const base = img.replace(/\.(jpg|png)$/i, "");
    if (p.images.includes(img)) {
      for (const w of [400, 800, 1600]) {
        if (!fs.existsSync(path.join(ROOT, `${base}-${w}.webp`))) {
          errors.push(`webp varyantı yok → ${base}-${w}.webp`);
        }
      }
    }
  }
}

if (errors.length) {
  console.log(`✗ ${errors.length} sorun:`);
  errors.forEach((e) => console.log("  " + e));
  process.exitCode = 1;
} else {
  console.log(`✓ ${pages.length} sayfa: kırık link yok, eksik görsel yok, alt metinler tamam, i18n anahtarları eşit (${frKeys.size})`);
}
