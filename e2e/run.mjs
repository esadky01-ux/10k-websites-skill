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
  assert(/rel="canonical" href="https:\/\/www\.maximusfood\.eu\/?"/.test(r.body), "canonical");
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
  assert(/hreflang="tr" href="https:\/\/www\.maximusfood\.eu\/tr\/bolgeler\/leuven"/i.test(r.body), "hreflang tr for region");
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
  const nlRegions = (s.body.match(/www\.maximusfood\.eu\/regio\/[a-z0-9-]+<\/loc>/g) ?? []).length;
  const trRegions = (s.body.match(/www\.maximusfood\.eu\/tr\/bolgeler\/[a-z0-9-]+<\/loc>/g) ?? []).length;
  assert(nlRegions >= 28 && trRegions >= 28, `sitemap regions nl=${nlRegions} tr=${trRegions}`);
  assert(/xhtml:link/.test(s.body) || /hreflang/.test(s.body), "sitemap alternates");
  const rb = await status("/robots.txt");
  assert(/Sitemap: https:\/\/www\.maximusfood\.eu\/sitemap\.xml/.test(rb.body), "robots sitemap");
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
  await page.goto(`${BASE}/bestellen?categorie=dranken`, { waitUntil: "networkidle" });
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
  await page.goto(`${BASE}/bestellen?categorie=dranken`, { waitUntil: "networkidle" });
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
  await page.goto(`${BASE}/tr/siparis?kategori=sauzen`, { waitUntil: "networkidle" });
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
  await mp.goto(`${BASE}/bestellen?categorie=sauzen`, { waitUntil: "networkidle" });
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
await check("interface languages: Dutch, French, English and Turkish pages, menu and route slugs", async () => {
  const lctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const lp = await lctx.newPage();
  const pageErrors = [];
  lp.on("pageerror", (e) => pageErrors.push(String(e)));
  // Her dilin ana sayfası ve sipariş sayfası kendi URL parçasıyla açılır
  for (const [path, htmlLang, marker] of [
    ["/", "nl-BE", "Uw betrouwbare groothandel"],
    ["/fr", "fr-BE", "grossiste"],
    ["/en", "en", "wholesale"],
    ["/tr", "tr", "toptan"],
  ]) {
    const res = await lp.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
    assert(res.status() === 200, `${path} → ${res.status()}`);
    assert((await lp.getAttribute("html", "lang")) === htmlLang, `${path} html lang`);
    const body = (await lp.textContent("body")).toLowerCase();
    assert(body.includes(marker.toLowerCase()), `${path} shows ${marker}`);
    assert((await lp.getAttribute("html", "dir")) === null, `${path} has no dir attribute`);
  }
  for (const [path, status] of [["/fr/commander", 200], ["/en/order", 200], ["/tr/siparis", 200], ["/fr/zones", 200], ["/en/regions", 200], ["/fr/connexion", 200], ["/ar", 404], ["/ku", 404]]) {
    const res = await lp.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
    assert(res.status() === status, `${path} → ${res.status()}, expected ${status}`);
  }
  // Dil seçimi her sayfada ilk bakışta görünür: tıklanacak açılır liste yok
  for (const [path, current] of [["/fr/commander", "fr"], ["/", "nl"], ["/tr/siparis", "tr"]]) {
    await lp.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    const bar = lp.locator("[data-testid=lang-bar]");
    assert(await bar.isVisible(), `${path} language bar visible without any click`);
    const hrefs = await lp.$$eval("[data-testid=lang-bar] a", (as) => as.map((a) => a.getAttribute("href")));
    assert(hrefs.length === 4, `${path} shows ${hrefs.length} languages, expected 4`);
    for (const l of ["nl", "fr", "en", "tr"]) {
      assert(await lp.locator(`[data-testid=lang-bar] [data-testid=lang-option-${l}]`).isVisible(), `${path} ${l} visible`);
    }
    assert((await lp.locator(`[data-testid=lang-bar] [data-testid=lang-option-${current}][aria-current="true"]`).count()) === 1, `${path} marks ${current} as current`);
    const box = await bar.boundingBox();
    assert(box && box.y < 120, `${path} language bar sits at the top (y=${box && Math.round(box.y)})`);
  }
  // Şerit bağlantıları her dilde, Felemenkçe (varsayılan) sayfalarda da doğru olmalı: tıklamadan önce href'ler sınanır
  for (const [path, want] of [
    ["/fr/commander", "/bestellen,/fr/commander,/en/order,/tr/siparis"],
    ["/bestellen", "/bestellen,/fr/commander,/en/order,/tr/siparis"],
    ["/", "/,/fr,/en,/tr"],
    ["/regio/leuven", "/regio/leuven,/fr/zones/leuven,/en/regions/leuven,/tr/bolgeler/leuven"],
  ]) {
    await lp.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    const hrefs = await lp.$$eval("[data-testid=lang-bar] a", (as) => as.map((a) => a.getAttribute("href")));
    assert(hrefs.join(",") === want, `${path} bar hrefs: ${hrefs.join(",")}, expected ${want}`);
  }
  await lp.goto(`${BASE}/fr/commander`, { waitUntil: "networkidle" });
  await lp.click("[data-testid=lang-bar] [data-testid=lang-option-tr]");
  await lp.waitForURL("**/tr/siparis");
  assert(pageErrors.length === 0, `uncaught: ${pageErrors.join(" | ")}`);
  await lp.screenshot({ path: `${OUT}/lang-bar-desktop.png` });
  await lctx.close();

  // Mobilde de şerit görünür; hamburger menüsünü açmaya gerek yok
  const mctx = await browser.newContext({ viewport: { width: 390, height: 780 }, locale: "tr-TR", userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36" });
  const mp = await mctx.newPage();
  await mp.goto(`${BASE}/tr`, { waitUntil: "networkidle" });
  assert(await mp.locator("[data-testid=lang-bar]").isVisible(), "language bar visible on mobile without opening the menu");
  for (const l of ["nl", "fr", "en", "tr"]) {
    const chip = mp.locator(`[data-testid=lang-bar] [data-testid=lang-option-${l}]`);
    assert(await chip.isVisible(), `${l} chip visible on mobile`);
    const b = await chip.boundingBox();
    assert(b && b.x >= 0 && b.x + b.width <= 390 && b.y + b.height <= 780, `${l} chip inside the mobile viewport`);
  }
  assert((await mp.evaluate(() => document.documentElement.scrollWidth)) <= 390, "no horizontal overflow from the language bar");
  await mp.screenshot({ path: `${OUT}/lang-bar-mobile.png`, clip: { x: 0, y: 0, width: 390, height: 220 } });
  // Hamburger menüsündeki ayrıntılı liste de duruyor
  await mp.click("[data-testid=menu-open]");
  await mp.waitForSelector("[data-testid=lang-inline]");
  await mp.click("[data-testid=lang-inline] [data-testid=lang-option-fr]");
  await mp.waitForURL("**/fr");
  await mctx.close();
});
await check("long-form pages fall back to a written language and stay out of the index", async () => {
  const cctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const cp = await cctx.newPage();
  // Fransızca bölge sayfası: metin Hollandaca, uyarı görünür, canonical Hollandacaya bakar, noindex
  await cp.goto(`${BASE}/fr/zones/leuven`, { waitUntil: "domcontentloaded" });
  await cp.waitForSelector("[data-testid=content-lang-notice]");
  assert(/Nederlands/.test(await cp.textContent("[data-testid=content-lang-notice]")), "notice names the written language");
  assert((await cp.getAttribute('link[rel=canonical]', "href")).endsWith("/regio/leuven"), "canonical points at the Dutch page");
  assert(/noindex/.test(await cp.getAttribute('meta[name=robots]', "content")), "fallback region page is noindex");
  // Hollandaca bölge sayfası dizine girer ve uyarı göstermez
  await cp.goto(`${BASE}/regio/leuven`, { waitUntil: "domcontentloaded" });
  assert((await cp.locator("[data-testid=content-lang-notice]").count()) === 0, "written page has no notice");
  assert(/index/.test(await cp.getAttribute('meta[name=robots]', "content")), "Dutch region page is indexed");
  // Site haritası: arayüz sayfaları dört dilde, uzun içerik yalnızca nl/tr
  const xml = await (await ctx.request.get(`${BASE}/sitemap.xml`)).text();
  for (const u of ["/fr/commander", "/en/order", "/tr/siparis", "/fr/zones", "/regio/leuven", "/tr/bolgeler/leuven"]) {
    assert(xml.includes(`www.maximusfood.eu${u}<`) || xml.includes(`www.maximusfood.eu${u}?`), `sitemap has ${u}`);
  }
  for (const u of ["/fr/zones/leuven", "/en/regions/leuven", "/fr/blog", "/en/blog"]) {
    assert(!xml.includes(`www.maximusfood.eu${u}<`), `sitemap must not list ${u}`);
  }
  await cctx.close();
});
await check("category slugs: Dutch links, filtering works and old Turkish links redirect", async () => {
  const sctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const sp = await sctx.newPage();
  // Ana sayfadaki kategori kartı yeni slug'a gider ve filtre çalışır
  await sp.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const hrefs = await sp.$$eval('a[href*="categorie="]', (as) => as.map((a) => a.getAttribute("href")));
  assert(hrefs.length > 0, "home links to categories");
  assert(hrefs.every((h) => /categorie=(sauzen|vlees-doner|diepvries|conserven|kaas-zuivel|brood-deeg|droge-voeding|dranken|ambalaj|hijyen)$/.test(h)), `category hrefs: ${hrefs.join(",")}`);
  await sp.goto(`${BASE}/bestellen?categorie=sauzen`, { waitUntil: "networkidle" });
  await sp.waitForSelector("[data-testid=product-row], table");
  const heading = await sp.textContent("h2");
  assert(/Sauzen/i.test(heading), `filtered heading: ${heading}`);
  // Kategori görseli yeni adıyla sunuluyor
  const img = await ctx.request.get(`${BASE}/media/categories/sauzen.jpg`);
  assert(img.status() === 200, `category image → ${img.status()}`);
  // Eski Türkçe slug'lar 308 ile yeni slug'a taşınıyor (dizindeki ve blogdaki bağlantılar kırılmasın)
  for (const [oldSlug, newSlug, param, path] of [
    ["soslar", "sauzen", "categorie", "/bestellen"],
    ["icecekler", "dranken", "categorie", "/bestellen"],
    ["soslar", "sauzen", "kategori", "/tr/siparis"],
    ["et-urunleri", "vlees-doner", "category", "/en/order"],
  ]) {
    const res = await ctx.request.get(`${BASE}${path}?${param}=${oldSlug}`, { maxRedirects: 0 });
    assert(res.status() === 308, `${path}?${param}=${oldSlug} → ${res.status()}`);
    assert(res.headers().location.includes(`${param}=${newSlug}`), `redirect target ${res.headers().location}`);
  }
  await sctx.close();
});
await check("the site always opens in Dutch; only the visitor's own click changes the language", async () => {
  // Tarayıcı dili ne olursa olsun kök adres Felemenkçe açılır ve başka bir dile yönlendirilmez
  for (const header of ["tr-TR,tr;q=0.9", "fr-BE,fr;q=0.9", "en-GB,en;q=0.9", "ar-SA,ar;q=0.9", "nl-BE,nl;q=0.9"]) {
    for (const path of ["/", "/bestellen"]) {
      const res = await ctx.request.get(`${BASE}${path}`, { headers: { "Accept-Language": header }, maxRedirects: 0 });
      assert(res.status() === 200, `${path} with ${header} → ${res.status()} (no language redirect allowed)`);
      const html = await res.text();
      assert(/<html lang="nl-BE"/.test(html), `${path} with ${header} is not Dutch`);
    }
  }
  // Kullanıcı kendisi seçerse dil değişir, ama bu seçim hatırlanıp kökü ele geçirmez
  const pctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "tr-TR" });
  const pp = await pctx.newPage();
  await pp.goto(`${BASE}/`, { waitUntil: "networkidle" });
  assert((await pp.getAttribute("html", "lang")) === "nl-BE", "first visit is Dutch");
  await pp.click("[data-testid=lang-bar] [data-testid=lang-option-tr]");
  await pp.waitForURL("**/tr");
  assert((await pp.getAttribute("html", "lang")) === "tr", "switching to Turkish works");
  await pp.goto(`${BASE}/`, { waitUntil: "networkidle" });
  assert((await pp.getAttribute("html", "lang")) === "nl-BE", "the root stays Dutch after a language switch");
  const stored = await pp.evaluate(() => ({ ls: Object.keys(localStorage).filter((k) => /lang|locale/i.test(k)), cookie: document.cookie }));
  assert(stored.ls.length === 0, `no language key in localStorage: ${stored.ls.join(",")}`);
  assert(!/lang|locale|NEXT_LOCALE/i.test(stored.cookie), `no language cookie: ${stored.cookie}`);
  await pctx.close();
});
await check("WhatsApp order button sits on every page and opens a prefilled chat", async () => {
  const wctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const wp = await wctx.newPage();
  for (const [path, label, prefill] of [["/", "Bestellen via WhatsApp", "Hallo, ik wil graag een bestelling plaatsen."], ["/fr", "Commander via WhatsApp", "Bonjour, je souhaite passer une commande."], ["/en/order", "Order via WhatsApp", "Hello, I would like to place an order."], ["/tr/siparis", "WhatsApp ile sipariş", "Merhaba, sipariş vermek istiyorum."]]) {
    await wp.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
    const btn = wp.locator("[data-testid=whatsapp-order]");
    assert(await btn.isVisible(), `${path} shows the WhatsApp button`);
    assert((await btn.getAttribute("aria-label")) === label, `${path} label`);
    const href = await btn.getAttribute("href");
    assert(href.startsWith("https://wa.me/32467077164?text="), `${path} href: ${href}`);
    assert(decodeURIComponent(href.split("text=")[1]) === prefill, `${path} prefilled message`);
    assert((await btn.getAttribute("target")) === "_blank", `${path} opens in a new tab`);
  }
  const mctx = await browser.newContext({ viewport: { width: 390, height: 780 } });
  const mp = await mctx.newPage();
  await mp.goto(`${BASE}/`, { waitUntil: "networkidle" });
  // Stil uygulanmadan ölçmeyelim: düğme sabitlenene kadar bekle
  await mp.waitForFunction(() => {
    const e = document.querySelector("[data-testid=whatsapp-order]");
    return e && getComputedStyle(e).position === "fixed";
  });
  const box = await mp.locator("[data-testid=whatsapp-order]").boundingBox();
  assert(box && box.x + box.width <= 390 && box.y + box.height <= 780, `mobile button inside the viewport: ${JSON.stringify(box)}`);
  // Başlık yükseldi: sipariş sayfasının yapışkan filtre çubuğu başlığın altında durmalı, altına girmemeli
  for (const [w, h] of [[390, 800], [1280, 900]]) {
    const sctx = await browser.newContext({ viewport: { width: w, height: h } });
    const sp = await sctx.newPage();
    await sp.goto(`${BASE}/bestellen`, { waitUntil: "networkidle" });
    const m = await sp.evaluate(() => {
      const header = document.querySelector("header");
      const sticky = document.querySelector('[role="tablist"]')?.closest("div.sticky");
      return { header: Math.round(header.getBoundingClientRect().height), top: sticky ? Math.round(parseFloat(getComputedStyle(sticky).top)) : null };
    });
    assert(m.top !== null, `${w}px sticky filter bar found`);
    assert(m.top >= m.header, `${w}px sticky filter bar slides under the header (top ${m.top} < header ${m.header})`);
    assert(m.top - m.header <= 8, `${w}px gap between header and sticky bar too large (${m.top - m.header}px)`);
    await sctx.close();
  }

  // Sepet çubuğu çıktığında düğme onun üstünü kapatmamalı
  await mp.evaluate(() => localStorage.setItem("maximus-cart-v1", JSON.stringify({ lines: [{ productId: "fd-drk-023", cases: 2, units: 0 }], delivery: "adres" })));
  await mp.goto(`${BASE}/bestellen`, { waitUntil: "networkidle" });
  await mp.waitForFunction(() => {
    const e = document.querySelector("[data-testid=whatsapp-order]");
    const b = document.querySelector("div.fixed.inset-x-0.bottom-0");
    return e && b && getComputedStyle(e).position === "fixed";
  });
  const bar = await mp.locator("div.fixed.inset-x-0.bottom-0").first().boundingBox();
  const fab = await mp.locator("[data-testid=whatsapp-order]").boundingBox();
  assert(bar && fab, "cart bar and button both present");
  const overlaps = !(fab.y + fab.height <= bar.y || fab.y >= bar.y + bar.height) && !(fab.x + fab.width <= bar.x || fab.x >= bar.x + bar.width);
  assert(!overlaps, `button overlaps the sticky cart bar: button y=${Math.round(fab.y)} h=${Math.round(fab.height)}, bar y=${Math.round(bar.y)}`);
  assert(fab.y + fab.height <= 780, "button still inside the viewport once lifted");

  // Sesli asistandan geriye bir şey kalmamalı
  assert((await mp.locator("[data-testid=voice-open], [data-testid=voice-panel]").count()) === 0, "no voice assistant left");
  const gone = await ctx.request.get(`${BASE}/api/voice-agent`);
  assert(gone.status() === 404, `/api/voice-agent → ${gone.status()}, expected 404`);
  const live = await ctx.request.post(`${BASE}/api/realtime-session`, { data: { sdp: "v=0" } });
  assert(live.status() === 404, `/api/realtime-session → ${live.status()}, expected 404`);
  await mctx.close();
  await wctx.close();
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
