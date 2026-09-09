#!/usr/bin/env node
/**
 * Uçtan uca testler (Playwright). Sunucu çalışıyor olmalı: BASE_URL (varsayılan http://localhost:3210).
 * Kapsam: dil yönlendirmeleri, SEO/hreflang/JSON-LD, bölge sayfaları, kayıt/giriş, fiyatlar,
 * sepet ve WhatsApp fişi, tekrar sipariş, mobil kart görünümü.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3210";
const OUT = process.env.E2E_OUT ?? "e2e/screenshots";
mkdirSync(OUT, { recursive: true });
const exe = process.env.PLAYWRIGHT_CHROMIUM ?? (process.env.PLAYWRIGHT_BROWSERS_PATH ? `${process.env.PLAYWRIGHT_BROWSERS_PATH}/chromium` : undefined);

let failures = 0;
const results = [];
async function check(name, fn) {
  try {
    await fn();
    results.push(`✔ ${name}`);
  } catch (err) {
    failures++;
    results.push(`✘ ${name}\n    ${String(err?.message ?? err).split("\n")[0]}`);
  }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, locale: "nl-BE" });
const page = await ctx.newPage();
const consoleErrors = [];
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));

const status = async (path, opts = {}) => {
  const res = await ctx.request.get(BASE + path, { maxRedirects: 0, ...opts });
  return { status: res.status(), location: res.headers()["location"], body: await res.text() };
};

// ── Dil yönlendirmeleri ──────────────────────────────────────────────
await check("/ serves Dutch home (200, lang nl-BE)", async () => {
  const r = await status("/");
  assert(r.status === 200, `status ${r.status}`);
  assert(/<html[^>]*lang="nl-BE"/.test(r.body), "html lang");
  assert(/Horeca groothandel Aarschot/.test(r.body), "Dutch title");
});
await check("/tr serves Turkish home", async () => {
  const r = await status("/tr");
  assert(r.status === 200 && /<html[^>]*lang="tr"/.test(r.body), "tr html");
  assert(/Toptan Gıda/.test(r.body), "Turkish title");
});
await check("/nl/bestellen redirects 308 to /bestellen", async () => {
  const r = await status("/nl/bestellen");
  assert(r.status === 308 && r.location?.endsWith("/bestellen"), `${r.status} ${r.location}`);
});
await check("/siparis (legacy) redirects to /tr/siparis", async () => {
  const r = await status("/siparis");
  assert(r.status === 308 && r.location?.endsWith("/tr/siparis"), `${r.status} ${r.location}`);
});
await check("/tr/siparis rewrites to Turkish order page", async () => {
  const r = await status("/tr/siparis");
  assert(r.status === 200 && /Hızlı Sipariş/.test(r.body), "tr order page");
});
await check("hreflang alternates present on home", async () => {
  const r = await status("/");
  assert(/hrefLang="tr"|hreflang="tr"/i.test(r.body) && /hreflang="nl-BE"/i.test(r.body) && /hreflang="x-default"/i.test(r.body), "hreflang tags");
  assert(/rel="canonical" href="https:\/\/maximusfood\.be\/?"/.test(r.body), "canonical");
});

// ── SEO: bölge sayfaları ────────────────────────────────────────────
await check("region page /regio/leuven has H1, geo meta, JSON-LD FAQ + Service + Breadcrumb", async () => {
  const r = await status("/regio/leuven");
  assert(r.status === 200, `status ${r.status}`);
  assert(/<h1[^>]*>[^<]*Leuven/.test(r.body), "h1 with city");
  assert(/name="geo.position" content="50\.\d+;4\.\d+"/.test(r.body), "geo.position");
  assert(/name="ICBM"/.test(r.body), "ICBM");
  const ld = [...r.body.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((m) => JSON.parse(m[1]));
  const graph = ld.flatMap((d) => d["@graph"] ?? [d]);
  const types = graph.map((g) => g["@type"]).flat();
  for (const t of ["Service", "FAQPage", "BreadcrumbList"]) assert(types.includes(t), `missing ${t} in JSON-LD`);
  assert(/hreflang="tr" href="https:\/\/maximusfood\.be\/tr\/bolgeler\/leuven"/i.test(r.body), "hreflang tr for region");
  assert(/<title>Horeca groothandel Leuven/i.test(r.body) || /<title>[^<]*Leuven[^<]*<\/title>/.test(r.body), "title with city");
});
await check("Turkish region page /tr/bolgeler/leuven works", async () => {
  const r = await status("/tr/bolgeler/leuven");
  assert(r.status === 200 && /<html[^>]*lang="tr"/.test(r.body) && /Leuven/.test(r.body), "tr region");
});
await check("regions index lists all 28 regions", async () => {
  const r = await status("/regio");
  const count = (r.body.match(/href="\/regio\/[a-z0-9-]+"/g) ?? []).length;
  assert(count >= 28, `only ${count} region links`);
});
await check("sitemap has NL+TR region URLs and robots allows", async () => {
  const s = await status("/sitemap.xml");
  const nlRegions = (s.body.match(/maximusfood\.be\/regio\/[a-z0-9-]+<\/loc>/g) ?? []).length;
  const trRegions = (s.body.match(/maximusfood\.be\/tr\/bolgeler\/[a-z0-9-]+<\/loc>/g) ?? []).length;
  assert(nlRegions >= 28 && trRegions >= 28, `sitemap regions nl=${nlRegions} tr=${trRegions}`);
  assert(/xhtml:link/.test(s.body) || /hreflang/.test(s.body), "sitemap alternates");
  const rb = await status("/robots.txt");
  assert(/Sitemap: https:\/\/maximusfood\.be\/sitemap\.xml/.test(rb.body), "robots sitemap");
});
await check("blog NL and TR articles render", async () => {
  const a = await status("/blog/15-procent-korting-bij-afhaling-aarschot");
  assert(a.status === 200 && /15/.test(a.body), "nl article");
  const b = await status("/tr/blog/aarschot-depodan-teslimde-yuzde-15-maliyet-avantaji");
  assert(b.status === 200, "tr article");
});
await check("prices API is protected", async () => {
  const r = await status("/api/prices");
  assert(r.status === 401, `status ${r.status}`);
});

// ── Kayıt, giriş, fiyat, sepet, tekrar sipariş ─────────────────────
const email = `e2e-${Date.now()}@example.com`;
await check("register via form lands on account page", async () => {
  await page.goto(`${BASE}/registreren`, { waitUntil: "networkidle" });
  await page.fill('input[name="company"]', "E2E Dönerzaak");
  await page.fill('input[name="firstName"]', "Test");
  await page.fill('input[name="lastName"]', "Persoon");
  await page.fill('input[name="phone"]', "+32 470 00 00 00");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', "wachtwoord123");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/account$/, { timeout: 15000 });
  await page.waitForSelector("text=E2E Dönerzaak");
  await page.waitForSelector('[data-testid="status-banner"]');
  await page.screenshot({ path: `${OUT}/account-pending.png` });
});
await check("pending account sees no prices, prices API returns 403", async () => {
  const r = await ctx.request.get(`${BASE}/api/prices`);
  assert(r.status() === 403, `status ${r.status()}`);
  await page.goto(`${BASE}/bestellen?categorie=icecekler`, { waitUntil: "networkidle" });
  await page.waitForSelector("table");
  await page.waitForSelector("table >> text=Na goedkeuring");
  assert(!/€ \d/.test(await page.locator("table").innerText()), "no prices for pending account");
});
await check("admin logs in at /beheer and approves the customer", async () => {
  const admin = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const ap = await admin.newPage();
  await ap.goto(`${BASE}/beheer`, { waitUntil: "networkidle" });
  await ap.fill('input[name="password"]', process.env.ADMIN_PASSWORD ?? "e2e-admin");
  await ap.click('button[type="submit"]');
  await ap.waitForSelector("text=E2E Dönerzaak");
  await ap.screenshot({ path: `${OUT}/admin-pending.png`, fullPage: true });
  const btn = ap.locator('button[data-testid^="approve-"]').first();
  await btn.click();
  await ap.waitForSelector("text=Goedgekeurd");
  await ap.screenshot({ path: `${OUT}/admin-approved.png`, fullPage: true });
  await admin.close();
  await page.reload({ waitUntil: "networkidle" });
});
await check("logged-in order page shows prices and estimate in cart", async () => {
  await page.goto(`${BASE}/bestellen?categorie=icecekler`, { waitUntil: "networkidle" });
  await page.waitForSelector("table");
  await page.waitForFunction(() => /€/.test(document.body.innerText), null, { timeout: 15000 });
  assert(!(await page.locator("text=Log in voor prijzen").count()), "login prompt should be gone");
  const plus = page.locator('table button[aria-label="Colli verhogen"]');
  await plus.nth(0).click(); await plus.nth(0).click(); await plus.nth(2).click();
  await page.screenshot({ path: `${OUT}/order-prices.png` });
  await page.locator('button[aria-label="Winkelmandje"]').first().click();
  await page.waitForSelector('[data-testid="cart-estimate"]');
  await page.locator('label:has-text("Afhaling in magazijn")').click();
  const est = await page.locator('[data-testid="cart-estimate"]').textContent();
  assert(/€/.test(est ?? ""), "estimate shown");
  await page.screenshot({ path: `${OUT}/cart-loggedin.png` });
});
await check("WhatsApp send records the order in the account", async () => {
  const [popup] = await Promise.all([
    ctx.waitForEvent("page"),
    page.locator('a:has-text("Verstuur bestelling via WhatsApp")').click(),
  ]);
  await popup.close();
  await page.waitForTimeout(800);
  const res = await ctx.request.get(`${BASE}/api/orders`);
  const data = await res.json();
  assert(data.orders?.length === 1, `orders ${data.orders?.length}`);
  assert(data.orders[0].delivery === "depo", "pickup delivery saved");
  assert(typeof data.orders[0].estimateExclVat === "number", "estimate saved");
});
await check("save current cart as fixed list", async () => {
  page.once("dialog", (d) => d.accept("Dinsdagbestelling"));
  await page.locator('button:has-text("Bewaar als vaste bestelling")').click();
  await page.waitForSelector("text=Bewaard in uw account");
  const res = await ctx.request.get(`${BASE}/api/lists`);
  const data = await res.json();
  assert(data.lists?.[0]?.name === "Dinsdagbestelling", "list saved");
});
await check("account shows last order and reorder fills the cart", async () => {
  await page.locator('button[aria-label="Winkelmandje sluiten"]').click();
  await page.locator('button:has-text("Mandje leegmaken")').count();
  await page.goto(`${BASE}/account`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="reorder-last"]');
  await page.screenshot({ path: `${OUT}/account-orders.png`, fullPage: true });
  await page.evaluate(() => localStorage.removeItem("maximus-cart-v1"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="reorder-last"]');
  await page.locator('[data-testid="reorder-last"]').click();
  await page.waitForSelector('[data-testid="cart-estimate"]');
  const items = await page.locator('aside[role="dialog"] .divide-y > div').count();
  assert(items === 2, `cart lines after reorder: ${items}`);
  await page.screenshot({ path: `${OUT}/reorder.png` });
});
await check("logout then login with wrong password shows error, right password works", async () => {
  await page.locator('button[aria-label="Winkelmandje sluiten"]').click();
  await page.locator('button:has-text("Uitloggen")').click();
  await page.waitForURL(`${BASE}/`);
  await page.goto(`${BASE}/inloggen`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', "verkeerd");
  await page.click('button[type="submit"]');
  await page.waitForSelector('[role="alert"]');
  await page.fill('input[name="password"]', "wachtwoord123");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/account$/);
});

// ── Türkçe akış ve mobil kart görünümü ─────────────────────────────
await check("Turkish order page + Turkish WhatsApp receipt", async () => {
  await page.goto(`${BASE}/tr/siparis?kategori=soslar`, { waitUntil: "networkidle" });
  await page.waitForSelector("table");
  await page.locator('table button[aria-label="Koli artır"]').nth(0).click();
  await page.locator('button[aria-label="Sepetim"]').first().click();
  const href = await page.locator('a:has-text("WhatsApp ile Sipariş Gönder")').getAttribute("href");
  const msg = decodeURIComponent(href.split("text=")[1]);
  assert(/Sipariş Fişi/.test(msg) && /Soslar/.test(msg), "Turkish receipt");
});
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const mp = await mobile.newPage();
await check("mobile order page uses card view, table hidden", async () => {
  await mp.goto(`${BASE}/bestellen?categorie=soslar`, { waitUntil: "networkidle" });
  await mp.waitForSelector('[data-testid="mobile-cards"]');
  assert(await mp.locator('[data-testid="mobile-cards"]').isVisible(), "cards visible");
  assert(!(await mp.locator("table").isVisible().catch(() => false)), "table hidden on mobile");
  await mp.locator('[data-testid="mobile-cards"] button[aria-label="Colli verhogen"]').nth(0).click();
  await mp.screenshot({ path: `${OUT}/mobile-cards.png` });
  const scrollW = await mp.evaluate(() => document.documentElement.scrollWidth);
  assert(scrollW <= 390, `horizontal overflow ${scrollW}`);
});
await check("mobile home renders without horizontal overflow", async () => {
  await mp.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const scrollW = await mp.evaluate(() => document.documentElement.scrollWidth);
  assert(scrollW <= 390, `overflow ${scrollW}`);
  await mp.screenshot({ path: `${OUT}/mobile-home.png` });
});
// Sesli asistan: sahte SpeechRecognition/speechSynthesis ile tam akış (API → sepet eylemi → yanıt)
await check("voice agent adds a spoken order to the cart", async () => {
  const vctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, locale: "tr-TR" });
  const vp = await vctx.newPage();
  await vp.addInitScript(() => {
    class FakeSR {
      constructor() { window.__sr = this; this.onresult = null; this.onend = null; this.onerror = null; }
      start() {}
      stop() { if (this.onend) this.onend(); }
      abort() {}
    }
    window.SpeechRecognition = FakeSR;
    window.__spoken = [];
    // window.speechSynthesis salt okunur bir getter; defineProperty ile değiştirilir
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        cancel() {},
        getVoices() { return []; },
        speak(u) { window.__spoken.push(u.text); setTimeout(() => { if (u.onstart) u.onstart(); setTimeout(() => { if (u.onend) u.onend(); }, 5); }, 0); },
      },
    });
    window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  });
  await vp.goto(`${BASE}/tr`, { waitUntil: "networkidle" });
  await vp.click("[data-testid=voice-open]");
  await vp.waitForSelector("[data-testid=voice-reply]");
  const greeting = await vp.textContent("[data-testid=voice-reply]");
  assert(/Selamünaleyküm abi/.test(greeting ?? ""), `greeting: ${greeting}`);
  await vp.click("[data-testid=voice-mic]");
  await vp.waitForFunction(() => document.querySelector("[data-testid=voice-status]")?.textContent?.includes("Dinliyor"));
  await vp.evaluate(() => {
    const results = [Object.assign([{ transcript: "bana 5 koli tabasco 350ml yaz" }], { isFinal: true })];
    window.__sr.onresult({ resultIndex: 0, results });
  });
  await vp.waitForFunction(() => /Ekledim abi/.test(document.querySelector("[data-testid=voice-reply]")?.textContent ?? ""));
  const cartLines = await vp.evaluate(() => JSON.parse(localStorage.getItem("maximus-cart-v1") ?? "{}").lines ?? []);
  assert(cartLines.length === 1 && cartLines[0].cases === 5, `cart: ${JSON.stringify(cartLines)}`);
  const spoken = await vp.evaluate(() => window.__spoken);
  assert(spoken.some((s) => /Ekledim abi, başka ne lazım/.test(s)), `spoken: ${spoken.join(" | ")}`);
  // Felemenkçeye anında geçiş
  await vp.evaluate(() => {
    const results = [Object.assign([{ transcript: "twee dozen tabasco 350ml graag" }], { isFinal: true })];
    window.__sr.onresult({ resultIndex: 0, results });
  });
  await vp.waitForFunction(() => /Staat erop baas/.test(document.querySelector("[data-testid=voice-reply]")?.textContent ?? ""));
  const langBadge = await vp.textContent("[data-testid=voice-lang]");
  assert((langBadge ?? "").toLowerCase() === "nl", `lang badge: ${langBadge}`);
  await vp.screenshot({ path: `${OUT}/voice-agent.png` });
  await vctx.close();
});
await check("voice agent API validates input and reports mode", async () => {
  const cfg = await (await ctx.request.get(`${BASE}/api/voice-agent`)).json();
  assert(cfg.agent === "Maximus Dijital Plasiyer" && cfg.greetings?.tr, "config");
  const bad = await ctx.request.post(`${BASE}/api/voice-agent`, { data: {} });
  assert(bad.status() === 400, `expected 400, got ${bad.status()}`);
  const rtc = await ctx.request.post(`${BASE}/api/voice-agent/webrtc`, { headers: { "Content-Type": "application/sdp" }, data: "v=0" });
  assert(rtc.status() === 503, `expected 503 without VOICE_API_KEY, got ${rtc.status()}`);
});
await check("no console errors during run", async () => {
  // 401/403 yanıtları tasarım gereği (yanlış şifre, oturumsuz veya onaysız fiyat isteği)
  const real = consoleErrors.filter((e) => !/favicon|404|401|403/.test(e));
  assert(real.length === 0, real.slice(0, 3).join(" | "));
});

await browser.close();
console.log(results.join("\n"));
console.log(`\n${results.length - failures}/${results.length} passed`);
process.exit(failures ? 1 : 0);
