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
  // Chrome otomatik çevirisi DOM'u bozmasın diye panel translate="no"
  assert((await vp.getAttribute("[data-testid=voice-panel]", "translate")) === "no", "panel notranslate");
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
await check("voice agent survives a throwing speech engine (mobile) without crashing the page", async () => {
  const mctx = await browser.newContext({ viewport: { width: 390, height: 760 }, locale: "tr-TR", userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36" });
  const mp2 = await mctx.newPage();
  const pageErrors = [];
  mp2.on("pageerror", (e) => pageErrors.push(String(e)));
  await mp2.addInitScript(() => {
    class ThrowingSR {
      constructor() { window.__sr = this; }
      start() { throw new DOMException("audio capture failed", "InvalidStateError"); }
      stop() {}
      abort() { throw new Error("abort failed"); }
    }
    window.SpeechRecognition = ThrowingSR;
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { cancel() { throw new Error("synth broken"); }, getVoices() { throw new Error("no voices"); }, speak() { throw new Error("speak broken"); } } });
    window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
    // Kayıt yedeğinde mikrofon izni reddedilir
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async () => { throw new DOMException("Permission denied", "NotAllowedError"); } } });
    window.MediaRecorder = class { static isTypeSupported() { return true; } };
  });
  await mp2.goto(`${BASE}/tr`, { waitUntil: "networkidle" });
  await mp2.click("[data-testid=voice-open]");
  await mp2.waitForSelector("[data-testid=voice-reply]");
  await mp2.click("[data-testid=voice-mic]");
  // Fırlatan motor → otomatik kayıt modu, gerçek hata küçük puntoyla görünür
  await mp2.waitForSelector("[data-testid=voice-mode]");
  const detail = await mp2.textContent("[data-testid=voice-detail]");
  assert(/InvalidStateError: audio capture failed/.test(detail ?? ""), `detail: ${detail}`);
  assert(await mp2.locator("[data-testid=voice-panel]").isVisible(), "panel still visible");
  assert(await mp2.locator("h1").first().isVisible(), "page content still rendered");
  // Kayıt modunda mikrofon izni reddi → nazik uyarı, sayfa ayakta
  await mp2.click("[data-testid=voice-mic]");
  await mp2.waitForFunction(() => /Mikrofon izni/.test(document.querySelector("[data-testid=voice-panel] [role=alert]")?.textContent ?? ""));
  const detail2 = await mp2.textContent("[data-testid=voice-detail]");
  assert(/NotAllowedError/.test(detail2 ?? ""), `detail2: ${detail2}`);
  assert(pageErrors.length === 0, `uncaught: ${pageErrors.join(" | ")}`);
  await mp2.screenshot({ path: `${OUT}/voice-agent-error.png` });
  await mctx.close();
});
await check("voice agent falls back to recorder mode when speech recognition is missing", async () => {
  const rctx = await browser.newContext({ viewport: { width: 390, height: 760 }, locale: "tr-TR", userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36" });
  const rp = await rctx.newPage();
  const pageErrors = [];
  rp.on("pageerror", (e) => pageErrors.push(String(e)));
  await rp.addInitScript(() => {
    delete window.SpeechRecognition;
    delete window.webkitSpeechRecognition;
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { cancel() {}, getVoices() { return []; }, speak(u) { setTimeout(() => { if (u.onstart) u.onstart(); if (u.onend) u.onend(); }, 0); } } });
    window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
    // Sahte mikrofon ve MediaRecorder
    const track = { stop() {} };
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async () => ({ getTracks: () => [track] }) } });
    class FakeRecorder {
      static isTypeSupported() { return true; }
      constructor(stream, opts) { this.stream = stream; this.mimeType = (opts && opts.mimeType) || "audio/webm"; this.state = "inactive"; window.__rec = this; }
      start() { this.state = "recording"; }
      stop() { this.state = "inactive"; if (this.ondataavailable) this.ondataavailable({ data: new Blob([new Uint8Array(4000)], { type: "audio/webm" }) }); if (this.onstop) this.onstop(); }
    }
    window.MediaRecorder = FakeRecorder;
  });
  await rp.goto(`${BASE}/tr`, { waitUntil: "networkidle" });
  await rp.click("[data-testid=voice-open]");
  await rp.waitForSelector("[data-testid=voice-reply]");
  await rp.click("[data-testid=voice-mic]");
  await rp.waitForSelector("[data-testid=voice-mode]");
  assert((await rp.getAttribute("[data-testid=voice-mic]", "data-mode")) === "recorder", "recorder mode active");
  // Kayıt: bas → durdur → sunucuya gönder → STT tanımlı olmadığı için nazik uyarı
  await rp.click("[data-testid=voice-mic]");
  await rp.waitForFunction(() => window.__rec && window.__rec.state === "recording");
  await rp.click("[data-testid=voice-mic]");
  await rp.waitForFunction(() => /VOICE_STT_URL/.test(document.querySelector("[data-testid=voice-panel] [role=alert]")?.textContent ?? ""));
  assert(await rp.locator("h1").first().isVisible(), "page content still rendered");
  assert(pageErrors.length === 0, `uncaught: ${pageErrors.join(" | ")}`);
  await rp.screenshot({ path: `${OUT}/voice-agent-recorder.png` });
  await rctx.close();
});
await check("voice agent falls back to browser speech when server TTS fails", async () => {
  const tctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, locale: "tr-TR" });
  const tp = await tctx.newPage();
  await tp.addInitScript(() => {
    class FakeSR { constructor() { window.__sr = this; } start() {} stop() {} abort() {} }
    window.SpeechRecognition = FakeSR;
    window.__spoken = [];
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { cancel() {}, getVoices() { return []; }, speak(u) { window.__spoken.push(u.text); setTimeout(() => { if (u.onstart) u.onstart(); if (u.onend) u.onend(); }, 0); } } });
    window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  });
  // Yapılandırma TTS var desin, TTS uç noktası ise hata versin → tarayıcı sesi devreye girmeli
  await tp.route("**/api/voice-agent", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const res = await route.fetch();
    const json = await res.json();
    await route.fulfill({ json: { ...json, tts: true } });
  });
  await tp.route("**/api/voice-agent/tts", (route) => route.fulfill({ status: 502, json: { error: "tts-upstream", detail: "upstream 401: invalid key" } }));
  await tp.goto(`${BASE}/tr`, { waitUntil: "networkidle" });
  await tp.click("[data-testid=voice-open]");
  await tp.waitForFunction(() => (window.__spoken || []).some((s) => /Selamünaleyküm/.test(s)));
  const detail = await tp.textContent("[data-testid=voice-detail]");
  assert(/tts 502/.test(detail ?? "") && /invalid key/.test(detail ?? ""), `detail: ${detail}`);
  await tctx.close();
});
await check("voice agent transcribe, tts and log endpoints respond", async () => {
  const tts = await ctx.request.post(`${BASE}/api/voice-agent/tts`, { data: { text: "merhaba" } });
  assert(tts.status() === 503, `expected 503 without TTS key, got ${tts.status()}`);
  const log = await ctx.request.post(`${BASE}/api/voice-agent/log`, { data: { where: "e2e", name: "TestError", message: "hello" } });
  assert(log.status() === 204, `log status ${log.status()}`);
  const tr = await ctx.request.post(`${BASE}/api/voice-agent/transcribe`, { multipart: { audio: { name: "a.webm", mimeType: "audio/webm", buffer: Buffer.alloc(2000) }, lang: "tr" } });
  assert(tr.status() === 503, `expected 503 without VOICE_STT_URL, got ${tr.status()}`);
});
await check("page opts out of Google Translate and the voice panel survives a translated DOM", async () => {
  const gctx = await browser.newContext({ viewport: { width: 390, height: 760 }, locale: "tr-TR", userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36" });
  const gp = await gctx.newPage();
  const pageErrors = [];
  gp.on("pageerror", (e) => pageErrors.push(String(e)));
  await gp.addInitScript(() => {
    class FakeSR { constructor() { window.__sr = this; } start() {} stop() {} abort() {} }
    window.SpeechRecognition = FakeSR;
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { cancel() {}, getVoices() { return []; }, speak(u) { setTimeout(() => { if (u.onstart) u.onstart(); if (u.onend) u.onend(); }, 0); } } });
    window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  });
  await gp.goto(`${BASE}/`, { waitUntil: "networkidle" });
  assert((await gp.getAttribute("html", "translate")) === "no", "html translate=no");
  assert((await gp.locator('meta[name="google"][content="notranslate"]').count()) === 1, "meta notranslate");
  await gp.click("[data-testid=voice-open]");
  await gp.waitForSelector("[data-testid=voice-reply]");
  // Google Translate taklidi: paneldeki her metin düğümünü <font> içine sar ve metnini değiştir
  await gp.evaluate(() => {
    const walker = document.createTreeWalker(document.querySelector("[data-testid=voice-panel]"), NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const n of nodes) {
      if (!n.nodeValue.trim()) continue;
      const font = document.createElement("font");
      n.parentNode.insertBefore(font, n);
      font.appendChild(n);
      n.nodeValue = "[çeviri] " + n.nodeValue;
    }
  });
  // Durum değişimleri, yeni balonlar ve uyarılar çevrilmiş DOM üzerinde render edilmeli
  await gp.click("[data-testid=voice-mic]");
  await gp.waitForFunction(() => /Dinliyor|Luistert/.test(document.querySelector("[data-testid=voice-status]")?.textContent ?? ""));
  await gp.evaluate(() => { window.__sr.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: "bana 5 koli tabasco 350ml yaz" }], { isFinal: true })] }); });
  await gp.waitForFunction(() => /Ekledim abi/.test(document.querySelector("[data-testid=voice-reply]")?.textContent ?? ""));
  await gp.waitForFunction(() => /Dinliyor|Luistert/.test(document.querySelector("[data-testid=voice-status]")?.textContent ?? "") && !!window.__sr.onerror);
  await gp.evaluate(() => { if (window.__sr.onerror) window.__sr.onerror({ error: "not-allowed" }); });
  await gp.waitForFunction(() => /Mikrofon izni|Microfoon geweigerd/.test(document.querySelector("[data-testid=voice-panel] [role=alert]")?.textContent ?? ""));
  await gp.click("[data-testid=voice-close]");
  await gp.waitForSelector("[data-testid=voice-open]");
  assert((await gp.locator("[data-testid=voice-boundary]").count()) === 0, "no error boundary shown");
  assert(pageErrors.length === 0, `uncaught: ${pageErrors.join(" | ")}`);
  await gctx.close();
});
await check("voice agent hears a short greeting right after speaking (echo guard) and resumes listening on mobile", async () => {
  const hctx = await browser.newContext({ viewport: { width: 390, height: 760 }, locale: "tr-TR", userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36" });
  const hp = await hctx.newPage();
  const pageErrors = [];
  hp.on("pageerror", (e) => pageErrors.push(String(e)));
  await hp.addInitScript(() => {
    window.__srCount = 0;
    class FakeSR { constructor() { window.__sr = this; window.__srCount++; } start() {} stop() {} abort() {} }
    window.SpeechRecognition = FakeSR;
    window.__spoken = [];
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { cancel() {}, resume() {}, getVoices() { return []; }, speak(u) { window.__spoken.push(u.text); setTimeout(() => { if (u.onstart) u.onstart(); setTimeout(() => { if (u.onend) u.onend(); }, 400); }, 0); } } });
    window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  });
  await hp.goto(`${BASE}/tr`, { waitUntil: "networkidle" });
  await hp.click("[data-testid=voice-open]");
  await hp.waitForFunction(() => (window.__spoken || []).some((s) => /Selamünaleyküm/.test(s)));
  await hp.click("[data-testid=voice-mic]");
  await hp.waitForFunction(() => document.querySelector("[data-testid=voice-status]")?.textContent?.includes("Dinliyor"));
  const before = await hp.evaluate(() => window.__srCount);
  // Karşılamanın hemen ardından kısa bir "selamünaleyküm": yankı değil, müşterinin sözü
  await hp.evaluate(() => { window.__sr.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: "selamünaleyküm" }], { isFinal: true })] }); });
  await hp.waitForFunction(() => /Aleykümselam abi/.test(document.querySelector("[data-testid=voice-reply]")?.textContent ?? ""));
  // Mobil yarı çift yönlü: konuşma bittikten sonra dinleme yeni bir motorla otomatik devam eder
  await hp.waitForFunction((n) => window.__srCount > n && /Dinliyor/.test(document.querySelector("[data-testid=voice-status]")?.textContent ?? ""), before);
  // İkinci cümle de işlenir
  await hp.evaluate(() => { window.__sr.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: "bana 5 koli tabasco 350ml yaz" }], { isFinal: true })] }); });
  await hp.waitForFunction(() => /Ekledim abi/.test(document.querySelector("[data-testid=voice-reply]")?.textContent ?? ""));
  assert(pageErrors.length === 0, `uncaught: ${pageErrors.join(" | ")}`);
  await hctx.close();
});
await check("voice agent shows an unmute button when autoplay is blocked and plays after the tap", async () => {
  const actx = await browser.newContext({ viewport: { width: 390, height: 760 }, locale: "tr-TR", userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36" });
  const ap = await actx.newPage();
  await ap.addInitScript(() => {
    class FakeSR { constructor() { window.__sr = this; } start() {} stop() {} abort() {} }
    window.SpeechRecognition = FakeSR;
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { cancel() {}, resume() {}, getVoices() { return []; }, speak(u) { setTimeout(() => { if (u.onstart) u.onstart(); if (u.onend) u.onend(); }, 0); } } });
    window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
    // İlk play() çağrıları otomatik oynatma engeline takılır; kullanıcı "Sesi aç"a dokununca izin verilir
    window.__plays = 0; window.__allowPlay = false;
    HTMLMediaElement.prototype.play = function () {
      window.__plays++;
      if (!window.__allowPlay) return Promise.reject(new DOMException("play() failed because the user didn't interact", "NotAllowedError"));
      setTimeout(() => { this.dispatchEvent(new Event("play")); setTimeout(() => this.dispatchEvent(new Event("ended")), 50); }, 0);
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function () {};
  });
  await ap.route("**/api/voice-agent", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const res = await route.fetch();
    await route.fulfill({ json: { ...(await res.json()), tts: true } });
  });
  await ap.route("**/api/voice-agent/tts", (route) => route.fulfill({ status: 200, contentType: "audio/mpeg", body: Buffer.alloc(4000, 1) }));
  await ap.goto(`${BASE}/tr`, { waitUntil: "networkidle" });
  await ap.click("[data-testid=voice-open]");
  await ap.waitForSelector("[data-testid=voice-unmute]");
  const detail = await ap.textContent("[data-testid=voice-detail]");
  assert(/NotAllowedError/.test(detail ?? ""), `detail: ${detail}`);
  await ap.evaluate(() => { window.__allowPlay = true; });
  await ap.click("[data-testid=voice-unmute]");
  await ap.waitForFunction(() => !document.querySelector("[data-testid=voice-unmute]"));
  assert((await ap.evaluate(() => window.__plays)) >= 2, "played after unmute");
  await actx.close();
});
await check("voice agent follows the site language switch", async () => {
  const lctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, locale: "tr-TR" });
  const lp = await lctx.newPage();
  await lp.addInitScript(() => {
    class FakeSR { constructor() { window.__sr = this; } start() {} stop() {} abort() {} }
    window.SpeechRecognition = FakeSR;
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { cancel() {}, resume() {}, getVoices() { return []; }, speak(u) { setTimeout(() => { if (u.onstart) u.onstart(); if (u.onend) u.onend(); }, 0); } } });
    window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  });
  await lp.goto(`${BASE}/tr`, { waitUntil: "networkidle" });
  await lp.click("[data-testid=voice-open]");
  await lp.waitForFunction(() => /Selamünaleyküm/.test(document.querySelector("[data-testid=voice-reply]")?.textContent ?? ""));
  assert((await lp.textContent("[data-testid=voice-lang]"))?.toLowerCase() === "tr", "starts in site language");
  await lp.click('a[hreflang="nl-BE"]');
  await lp.waitForURL((u) => !/\/tr(\/|$)/.test(u.pathname));
  await lp.waitForFunction(() => (document.querySelector("[data-testid=voice-lang]")?.textContent ?? "").toLowerCase() === "nl" || !!document.querySelector("[data-testid=voice-open]"));
  if (await lp.locator("[data-testid=voice-open]").count()) await lp.click("[data-testid=voice-open]");
  await lp.waitForFunction(() => /Dag baas/.test(document.querySelector("[data-testid=voice-reply]")?.textContent ?? ""));
  assert((await lp.textContent("[data-testid=voice-lang]"))?.toLowerCase() === "nl", "follows site language");
  await lctx.close();
});
await check("voice agent's silent unlock clip is a valid, playable WAV", async () => {
  const wctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, locale: "tr-TR" });
  const wp = await wctx.newPage();
  const pageErrors = [];
  wp.on("pageerror", (e) => pageErrors.push(String(e)));
  // Kilit açma sırasında ses öğesine verilen klibi yakala (gerçek play() çağrısı aynen devam eder)
  await wp.addInitScript(() => {
    const realPlay = HTMLMediaElement.prototype.play;
    window.__unlockSrc = null;
    HTMLMediaElement.prototype.play = function () {
      if (!window.__unlockSrc && typeof this.src === "string" && this.src.startsWith("data:audio/wav")) window.__unlockSrc = this.src;
      return realPlay.call(this);
    };
  });
  await wp.goto(`${BASE}/tr`, { waitUntil: "networkidle" });
  await wp.click("[data-testid=voice-open]");
  await wp.waitForFunction(() => !!window.__unlockSrc);
  // Yakalanan klibi gerçek Chromium'da bir dokunuş içinde çal
  await wp.evaluate(() => {
    const b = document.createElement("button"); b.id = "__play"; b.textContent = "play"; document.body.appendChild(b);
    b.onclick = () => {
      const a = new Audio(window.__unlockSrc);
      window.__wav = null;
      a.play().then(() => { window.__wav = { ok: true, duration: a.duration }; }).catch((e) => { window.__wav = { ok: false, error: e.name + ": " + e.message }; });
    };
  });
  await wp.click("#__play");
  await wp.waitForFunction(() => window.__wav !== null);
  const r = await wp.evaluate(() => window.__wav);
  assert(r.ok && r.duration > 0.01, `unlock clip: ${JSON.stringify(r)}`);
  assert((await wp.locator("[data-testid=voice-detail]").count()) === 0, "unlock must not surface an error line");
  assert(pageErrors.length === 0, `uncaught: ${pageErrors.join(" | ")}`);
  await wctx.close();
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
