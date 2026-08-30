/* Klon ekran görüntüleri + konsol/istek hatası denetimi.
   Kullanım: node tools/serve.js 8090 &  →  node tools/screenshot.js */
const { chromium } = require("playwright");
const path = require("path");
const BASE = "http://127.0.0.1:8090";
const OUT = path.join(__dirname, "..", "analysis");

const SHOTS = [
  { url: "/fr/panneaux-bambou.html", name: "compare-category-fr-1440", width: 1440, full: true },
  { url: "/fr/panneaux-bambou.html", name: "compare-category-fr-768", width: 768, full: true },
  { url: "/fr/panneaux-bambou.html", name: "compare-category-fr-390", width: 390, full: true },
  { url: "/fr/index.html", name: "compare-home-fr-1440", width: 1440, full: true },
  { url: "/tr/index.html", name: "compare-home-tr-1440", width: 1440, full: true },
  { url: "/fr/produit-clay-bp06.html", name: "compare-product-fr-1440", width: 1440, full: true },
  { url: "/tr/urun-clay-bp06.html", name: "compare-product-tr-390", width: 390, full: true },
  { url: "/tr/bambu-paneller.html", name: "compare-category-tr-1440", width: 1440, full: true }
];
const THEMES = ["navy-gold", "warm-clay", "charcoal-brass", "sage-linen"];

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const problems = [];

  async function capture(url, name, width, { full = false, theme = null } = {}) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    /* cookie bar görüntüleri kapatmasın diye tercihi önceden kaydet */
    await page.addInitScript(() => {
      try { localStorage.setItem("gir-cookies", JSON.stringify("accepted")); } catch (e) {}
    });
    page.on("console", (msg) => {
      if (msg.type() === "error") { problems.push(`[console] ${url} (${name}): ${msg.text()}`); }
    });
    page.on("pageerror", (err) => problems.push(`[pageerror] ${url} (${name}): ${err.message}`));
    page.on("requestfailed", (req) => {
      const u = req.url();
      if (u.startsWith(BASE)) { problems.push(`[requestfailed] ${url} (${name}): ${u}`); }
    });
    const resp = await page.goto(BASE + url, { waitUntil: "networkidle" });
    if (!resp || resp.status() !== 200) { problems.push(`[http] ${url}: status ${resp && resp.status()}`); }
    if (theme) {
      await page.evaluate((th) => document.documentElement.setAttribute("data-theme", th), theme);
      await page.waitForTimeout(150);
    }
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(OUT, name + ".png"), fullPage: full });
    await page.close();
    console.log("✓", name);
  }

  for (const s of SHOTS) { await capture(s.url, s.name, s.width, { full: s.full }); }
  for (const theme of THEMES) {
    await capture("/fr/panneaux-bambou.html", `theme-${theme}-fr`, 1440, { theme });
    await capture("/tr/bambu-paneller.html", `theme-${theme}-tr`, 1440, { theme });
  }

  await browser.close();
  if (problems.length) {
    console.log("\nSORUNLAR:");
    problems.forEach((p) => console.log("  " + p));
    process.exitCode = 1;
  } else {
    console.log("\nkonsol/istek hatası yok ✓");
  }
})();
