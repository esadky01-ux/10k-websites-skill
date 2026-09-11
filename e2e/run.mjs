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
// Hızlı Sesli Sipariş: sahte MediaRecorder + stub'lanmış sunucu yanıtıyla tam akış
const FAKE_MEDIA = () => {
  const track = { stop() {} };
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async () => ({ getTracks: () => [track] }) } });
  class FakeRecorder {
    static isTypeSupported() { return true; }
    constructor(stream, opts) { this.stream = stream; this.mimeType = (opts && opts.mimeType) || "audio/webm"; this.state = "inactive"; window.__rec = this; }
    start() { this.state = "recording"; }
    stop() { this.state = "inactive"; if (this.ondataavailable) this.ondataavailable({ data: new Blob([new Uint8Array(4000)], { type: "audio/webm" }) }); if (this.onstop) this.onstop(); }
  }
  window.MediaRecorder = FakeRecorder;
  window.__spoken = [];
  Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { cancel() {}, getVoices() { return []; }, speak(u) { window.__spoken.push(u.text); } } });
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
};
const ORDER_RESULT = { transkript: "bana 5 koli tabasco 350 ml yaz", dil: "tr", eklenenler: [{ id: "fd-szn-020", isim: "Tabasco Acı Sos", koli: 5, adet: 0, adetMetni: "5 koli", ambalaj: "12 x 350 ml", birimFiyat: null }], secenekler: [{ sorgu: "tavuk döner", koli: 2, adet: 0, adetMetni: "2 koli", adaylar: [{ id: "fd-don-035", isim: "Düzgün Hindi-Dana Döner", ambalaj: "1 x 10 kg", etiket: "1 x 10 kg", birimFiyat: null }, { id: "fd-don-038", isim: "Düzgün Hindi-Dana Döner", ambalaj: "1 x 15 kg", etiket: "1 x 15 kg", birimFiyat: null }] }], bulunamayanlar: ["uzay mekiği"], toplamTutar: null, yedek: false };

await check("voice order: record → server result → cart lines + summary card", async () => {
  const vctx = await browser.newContext({ viewport: { width: 390, height: 760 }, locale: "tr-TR", userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36" });
  const vp = await vctx.newPage();
  const pageErrors = [];
  vp.on("pageerror", (e) => pageErrors.push(String(e)));
  await vp.addInitScript(FAKE_MEDIA);
  await vp.route("**/api/voice-agent", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    await route.fulfill({ json: { configured: true, tts: true, maxSeconds: 30 } });
  });
  let uploaded = null;
  await vp.route("**/api/voice-agent/order-audio", async (route) => {
    uploaded = { method: route.request().method(), type: route.request().headers()["content-type"] || "" };
    await route.fulfill({ json: ORDER_RESULT });
  });
  await vp.goto(`${BASE}/tr`, { waitUntil: "networkidle" });
  assert((await vp.getAttribute("html", "translate")) === "no", "html translate=no");
  await vp.click("[data-testid=voice-open]");
  assert((await vp.getAttribute("[data-testid=voice-panel]", "translate")) === "no", "panel notranslate");
  await vp.waitForSelector("[data-testid=voice-mic]:not([disabled])");
  await vp.click("[data-testid=voice-mic]");
  await vp.waitForFunction(() => window.__rec && window.__rec.state === "recording");
  assert(/Kaydediyor/.test(await vp.textContent("[data-testid=voice-status]")), "recording status");
  await vp.click("[data-testid=voice-mic]");
  await vp.waitForSelector("[data-testid=voice-summary]");
  assert(uploaded && uploaded.method === "POST" && /multipart\/form-data/.test(uploaded.type), `upload: ${JSON.stringify(uploaded)}`);
  assert(/bana 5 koli tabasco/.test(await vp.textContent("[data-testid=voice-transcript]")), "transcript shown");
  assert(/5 koli/.test(await vp.textContent("[data-testid=voice-added]")), "added line shown");
  assert(/uzay mekiği/.test(await vp.textContent("[data-testid=voice-missing]")), "missing line shown");
  let cartLines = await vp.evaluate(() => JSON.parse(localStorage.getItem("maximus-cart-v1") ?? "{}").lines ?? []);
  assert(cartLines.length === 1 && cartLines[0].productId === "fd-szn-020" && cartLines[0].cases === 5, `cart: ${JSON.stringify(cartLines)}`);
  // "Hangisi olsun?" chip'i: seçilen varyant istenen miktarla sepete girer, kartta eklenenlere taşınır
  assert(/Hangisi olsun/.test(await vp.textContent("[data-testid=voice-choices]")), "variant chooser shown");
  assert((await vp.locator("[data-testid=voice-choice]").count()) === 2, "two variant chips");
  await vp.click('[data-testid=voice-choice][data-product-id="fd-don-038"]');
  await vp.waitForFunction(() => !document.querySelector("[data-testid=voice-choices]"));
  assert(/15 kg/.test(await vp.textContent("[data-testid=voice-added]")), "chosen variant listed as added");
  cartLines = await vp.evaluate(() => JSON.parse(localStorage.getItem("maximus-cart-v1") ?? "{}").lines ?? []);
  const doner = cartLines.find((l) => l.productId === "fd-don-038");
  assert(doner && doner.cases === 2, `variant in cart: ${JSON.stringify(cartLines)}`);
  // "Özeti dinle": yalnızca dokunuşla; TTS başarısızsa tarayıcı sesine düşer
  await vp.route("**/api/voice-agent/tts", (route) => route.fulfill({ status: 502, json: { error: "tts-upstream", detail: "upstream 401" } }));
  await vp.click("[data-testid=voice-listen]");
  await vp.waitForFunction(() => (window.__spoken || []).some((s) => /Sepete ekledim/.test(s)));
  // "Sepete git" sepet panelini açar
  await vp.click("[data-testid=voice-go-cart]");
  await vp.waitForSelector('aside[role="dialog"].translate-x-0');
  assert((await vp.locator("[data-testid=voice-panel]").count()) === 0, "voice panel closed");
  assert(pageErrors.length === 0, `uncaught: ${pageErrors.join(" | ")}`);
  await vp.screenshot({ path: `${OUT}/voice-order.png` });
  await vctx.close();
});
await check("voice order: gentle notices for missing config, denied microphone and too-short clips", async () => {
  const nctx = await browser.newContext({ viewport: { width: 390, height: 760 }, locale: "tr-TR" });
  const np = await nctx.newPage();
  const pageErrors = [];
  np.on("pageerror", (e) => pageErrors.push(String(e)));
  await np.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async () => { throw new DOMException("Permission denied", "NotAllowedError"); } } });
    window.MediaRecorder = class { static isTypeSupported() { return true; } };
  });
  await np.goto(`${BASE}/tr`, { waitUntil: "networkidle" });
  await np.click("[data-testid=voice-open]");
  // Anahtarsız yerel sunucu → düğme devre dışı, açık uyarı
  await np.waitForFunction(() => /OPENAI_API_KEY/.test(document.querySelector("[data-testid=voice-panel] [role=alert]")?.textContent ?? ""));
  assert(await np.locator("[data-testid=voice-mic]").isDisabled(), "button disabled without config");
  await nctx.close();
  const dctx = await browser.newContext({ viewport: { width: 390, height: 760 }, locale: "tr-TR" });
  const dp = await dctx.newPage();
  dp.on("pageerror", (e) => pageErrors.push(String(e)));
  await dp.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async () => { throw new DOMException("Permission denied", "NotAllowedError"); } } });
    window.MediaRecorder = class { static isTypeSupported() { return true; } };
  });
  await dp.route("**/api/voice-agent", (route) => (route.request().method() === "GET" ? route.fulfill({ json: { configured: true, tts: false, maxSeconds: 30 } }) : route.continue()));
  await dp.goto(`${BASE}/tr`, { waitUntil: "networkidle" });
  await dp.click("[data-testid=voice-open]");
  await dp.waitForSelector("[data-testid=voice-mic]:not([disabled])");
  await dp.click("[data-testid=voice-mic]");
  await dp.waitForFunction(() => /Mikrofon izni/.test(document.querySelector("[data-testid=voice-panel] [role=alert]")?.textContent ?? ""));
  assert(/NotAllowedError/.test(await dp.textContent("[data-testid=voice-detail]")), "detail shows real error");
  assert(pageErrors.length === 0, `uncaught: ${pageErrors.join(" | ")}`);
  await dctx.close();
});
// Canlı görüşme (GPT-Live): sahte RTCPeerConnection + stub'lanmış /api/realtime-session ile araç çağrısı akışı
const FAKE_RTC = () => {
  const track = { enabled: true, stop() {} };
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async () => ({ getTracks: () => [track], getAudioTracks: () => [track] }) } });
  window.AudioContext = undefined;
  window.__dcSent = [];
  class FakeChannel {
    constructor(label) { this.label = label; this.readyState = "connecting"; window.__dc = this; }
    send(msg) { window.__dcSent.push(JSON.parse(msg)); }
    close() { this.readyState = "closed"; }
  }
  class FakePC {
    constructor() { this.connectionState = "new"; window.__pc = this; }
    addTrack() {}
    createDataChannel(label) { return new FakeChannel(label); }
    async createOffer() { return { type: "offer", sdp: "v=0\r\no=fake offer" }; }
    async setLocalDescription() {}
    async setRemoteDescription(desc) {
      window.__answer = desc;
      const dc = window.__dc;
      setTimeout(() => { dc.readyState = "open"; if (dc.onopen) dc.onopen(); if (dc.onmessage) dc.onmessage({ data: JSON.stringify({ type: "session.started" }) }); }, 10);
    }
    close() { this.connectionState = "closed"; }
  }
  window.RTCPeerConnection = FakePC;
  window.__emit = (ev) => window.__dc.onmessage({ data: JSON.stringify(ev) });
};
await check("live voice: WebRTC offer → session → captions, tool call adds to cart, end call", async () => {
  const lctx = await browser.newContext({ viewport: { width: 390, height: 760 }, locale: "tr-TR" });
  const lp = await lctx.newPage();
  const pageErrors = [];
  lp.on("pageerror", (e) => pageErrors.push(String(e)));
  await lp.addInitScript(FAKE_RTC);
  await lp.route("**/api/voice-agent", (route) => (route.request().method() === "GET" ? route.fulfill({ json: { configured: true, tts: false, maxSeconds: 30, live: true, liveModel: "gpt-live-1" } }) : route.continue()));
  await lp.route("**/api/realtime-session", async (route) => {
    const body = route.request().postDataJSON();
    assert(/^v=0/.test(body.sdp) && body.lang === "tr", "offer + lang posted");
    await route.fulfill({ status: 201, json: { id: "sess_e2e", sdp: "v=0\r\no=fake answer", model: "gpt-live-1", backendModel: "gpt-5.6-terra" } });
  });
  await lp.goto(`${BASE}/tr`, { waitUntil: "networkidle" });
  await lp.click("[data-testid=voice-open]");
  await lp.waitForSelector("[data-testid=live-start]:not([disabled])");
  assert((await lp.getAttribute("[data-testid=voice-tab-live]", "aria-selected")) === "true", "live tab default when configured");
  await lp.click("[data-testid=live-start]");
  await lp.waitForSelector("[data-testid=live-end]");
  await lp.waitForFunction(() => /Dinliyor/.test(document.querySelector("[data-testid=live-status]")?.textContent ?? ""));
  assert((await lp.evaluate(() => window.__dc.label)) === "oai-events", "data channel label");
  assert((await lp.evaluate(() => window.__answer.type)) === "answer", "remote answer applied");
  assert((await lp.evaluate(() => window.__dcSent.some((m) => m.type === "session.start"))) === false, "no session.start sent on the channel");
  await lp.evaluate(() => window.__emit({ type: "session.input_transcript.delta", delta: "beş koli tabasco" }));
  await lp.waitForFunction(() => /beş koli tabasco/.test(document.querySelector("[data-testid=live-captions]")?.textContent ?? ""));
  await lp.evaluate(() => window.__emit({ type: "session.delegation.created" }));
  await lp.waitForFunction(() => /Düşünüyor/.test(document.querySelector("[data-testid=live-status]")?.textContent ?? ""));
  await lp.evaluate(() => window.__emit({ type: "response.event", event: { type: "response.output_item.done", item: { type: "function_call", call_id: "call_1", name: "search_catalog", arguments: JSON.stringify({ query: "tabasco 350 ml" }) } } }));
  await lp.waitForFunction(() => window.__dcSent.some((m) => m.type === "response.item.create" && m.item.call_id === "call_1"));
  const searchOut = await lp.evaluate(() => JSON.parse(window.__dcSent.find((m) => m.type === "response.item.create" && m.item.call_id === "call_1").item.output));
  assert(searchOut.results.some((r) => r.id === "fd-szn-020"), "search_catalog returned tabasco");
  assert((await lp.evaluate(() => window.__dcSent.filter((m) => m.type === "response.create").length)) === 1, "response.create after tool output");
  await lp.evaluate(() => window.__emit({ type: "response.event", event: { type: "response.output_item.done", item: { type: "function_call", call_id: "call_2", name: "add_to_cart", arguments: JSON.stringify({ productId: "fd-szn-020", cases: 5, units: 0 }) } } }));
  await lp.waitForFunction(() => /add_to_cart/.test(document.querySelector("[data-testid=live-tools]")?.textContent ?? ""));
  const stored = await lp.evaluate(() => JSON.parse(localStorage.getItem("maximus-cart-v1") ?? "{}"));
  const line = (stored.lines ?? []).find((l) => l.productId === "fd-szn-020");
  assert(line && line.cases === 5, `cart line via tool call: ${JSON.stringify(stored.lines)}`);
  await lp.evaluate(() => window.__emit({ type: "session.output_transcript.delta", delta: "Ekledim, 5 koli Tabasco. Başka?" }));
  await lp.waitForFunction(() => /Konuşuyor/.test(document.querySelector("[data-testid=live-status]")?.textContent ?? ""));
  assert(/Ekledim/.test(await lp.textContent("[data-testid=live-captions]")), "assistant caption shown");
  await lp.click("[data-testid=live-mute]");
  await lp.waitForFunction(() => window.__dcSent.some((m) => m.type === "session.input_audio.mute"));
  await lp.click("[data-testid=live-end]");
  await lp.waitForSelector("[data-testid=live-start]");
  assert((await lp.evaluate(() => window.__dcSent.some((m) => m.type === "session.close"))) === true, "session.close sent");
  assert((await lp.evaluate(() => window.__pc.connectionState)) === "closed", "peer connection closed");
  assert(/Görüşme bitti/.test(await lp.textContent("[data-testid=live-ended]")), "ended notice");
  await lp.screenshot({ path: `${OUT}/voice-live.png` });
  // Bas-konuş sekmesi yedek olarak erişilebilir
  await lp.click("[data-testid=voice-tab-push]");
  await lp.waitForSelector("[data-testid=voice-mic]");
  assert(pageErrors.length === 0, `uncaught: ${pageErrors.join(" | ")}`);
  await lctx.close();
});
await check("live voice: without server config the push-to-talk tab is the default and live start is disabled", async () => {
  const cctx = await browser.newContext({ viewport: { width: 390, height: 760 }, locale: "nl-BE" });
  const cp = await cctx.newPage();
  await cp.goto(`${BASE}/nl`, { waitUntil: "networkidle" });
  await cp.click("[data-testid=voice-open]");
  await cp.waitForSelector("[data-testid=voice-push-panel]");
  assert((await cp.getAttribute("[data-testid=voice-tab-push]", "aria-selected")) === "true", "push tab default without live");
  await cp.click("[data-testid=voice-tab-live]");
  await cp.waitForSelector("[data-testid=live-start][disabled]");
  assert(/nog niet ingesteld/.test(await cp.textContent("[data-testid=live-panel] [role=alert]")), "Dutch not-configured notice");
  const rs = await ctx.request.post(`${BASE}/api/realtime-session`, { data: { sdp: "v=0\r\no=test", lang: "tr" } });
  assert(rs.status() === 503, `realtime-session without key → 503, got ${rs.status()}`);
  await cctx.close();
});
await check("voice order API: config, validation and secret-free errors", async () => {
  const cfg = await (await ctx.request.get(`${BASE}/api/voice-agent`)).json();
  assert(cfg.configured === false && cfg.live === false && typeof cfg.maxSeconds === "number", "config shape");
  const oa = await ctx.request.post(`${BASE}/api/voice-agent/order-audio`, { multipart: { audio: { name: "a.webm", mimeType: "audio/webm", buffer: Buffer.alloc(2000) }, lang: "tr" } });
  assert(oa.status() === 503, `expected 503 without key, got ${oa.status()}`);
  const tts = await ctx.request.post(`${BASE}/api/voice-agent/tts`, { data: { text: "merhaba" } });
  assert(tts.status() === 503, `expected 503 without key, got ${tts.status()}`);
  const log = await ctx.request.post(`${BASE}/api/voice-agent/log`, { data: { where: "e2e", name: "TestError", message: "hello" } });
  assert(log.status() === 204, `log status ${log.status()}`);
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
