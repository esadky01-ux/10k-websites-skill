#!/usr/bin/env node
/**
 * Europataxi duman testi (Playwright).
 *
 *   npm run build && npm start        # başka bir terminalde sunucu ayakta olmalı
 *   npm run e2e                       # ya da: BASE_URL=https://... node e2e/smoke.mjs
 *
 * Her kontrol tek satır PASS/FAIL basar; bir kontrol bile düşerse çıkış kodu 1 olur.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
/** Bazı ortamlarda tarayıcı ikilisi burada durur. */
const FALLBACK_CHROMIUM = "/opt/pw-browsers/chromium";

const MOBILE = { width: 360, height: 740 };
const DESKTOP = { width: 1280, height: 900 };

const dictionary = JSON.parse(readFileSync(new URL("../src/i18n/dictionaries/tr.json", import.meta.url), "utf8"));
const HERO_TITLE = dictionary.hero.title;

/** Yarının tarihi (YYYY-MM-DD); geçmiş tarih doğrulamasına takılmamak için. */
function tomorrowISO() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

const BOOKING_QUERY = `?from=bru-airport&to=paris&date=${tomorrowISO()}&time=10:00&pax=2&bags=2`;

/** Şartname bölüm 5'teki örnek rezervasyon gövdesi. */
const SAMPLE_BOOKING = {
  trip: {
    from: "bru-airport",
    to: "paris",
    date: "2026-12-02",
    time: "14:30",
    passengers: 2,
    luggage: 3,
    return: null,
  },
  vehicle: "sedan",
  customer: {
    firstName: "Ayşe",
    lastName: "Yılmaz",
    email: "ayse@example.com",
    phone: "+32470000000",
    flightNumber: "TK1937",
    note: "",
    consent: true,
  },
  locale: "tr",
};

const SAMPLE_CONTACT = {
  name: "Ayşe Yılmaz",
  email: "ayse@example.com",
  phone: "+32470000000",
  subject: "booking",
  message: "Brüksel Havalimanından Paris'e transfer için bilgi almak istiyorum.",
  consent: true,
  locale: "tr",
};

const PAGE_PATHS = [
  "/tr",
  "/tr/hizmetler",
  "/tr/havalimani-transferleri",
  "/tr/bolgeler",
  "/tr/iletisim",
  "/tr/gizlilik-politikasi",
  "/tr/kullanim-kosullari",
  `/tr/rezervasyon${BOOKING_QUERY}`,
];

let failed = 0;

function pass(label, detail) {
  console.log(`PASS ${label}${detail ? ` (${detail})` : ""}`);
}

function fail(label, detail) {
  failed += 1;
  console.log(`FAIL ${label}${detail ? ` (${detail})` : ""}`);
}

/** Bir kontrolü çalıştırır; fırlatan her hata FAIL olarak yazılır. */
async function check(label, fn) {
  try {
    const detail = await fn();
    pass(label, typeof detail === "string" ? detail : undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(label, message.split("\n")[0].slice(0, 220));
  }
}

async function launchBrowser() {
  try {
    return await chromium.launch();
  } catch (error) {
    console.log(`bilgi: varsayılan Chromium başlatılamadı (${error.message.split("\n")[0]}); ${FALLBACK_CHROMIUM} deneniyor`);
    return await chromium.launch({ executablePath: FALLBACK_CHROMIUM });
  }
}

/** React bu öğeye bağlandı mı? (hydration tamamlanmadan tıklamalar kaybolur) */
async function waitForHydration(page, selector, timeout = 20_000) {
  await page.waitForFunction(
    (sel) => {
      const element = document.querySelector(sel);
      return Boolean(element) && Object.keys(element).some((key) => key.startsWith("__react"));
    },
    selector,
    { timeout },
  );
}

/** Ana sayfa: widget saat alanını istemcide doldurduğunda hazırdır. */
async function openHome(page) {
  await page.goto(`${BASE_URL}/tr`, { waitUntil: "domcontentloaded" });
  await waitForHydration(page, "#rezervasyon-time");
  await page.waitForFunction(
    () => {
      const select = document.querySelector("#rezervasyon-time");
      return select instanceof HTMLSelectElement && select.value !== "";
    },
    null,
    { timeout: 20_000 },
  );
}

/** Konum seçici: yaz, ok tuşuyla seçeneğe in, Enter ile seç. */
async function pickLocation(page, fieldId, query) {
  const input = page.locator(`#${fieldId}`);
  await input.click();
  await input.fill("");
  await input.pressSequentially(query, { delay: 50 });
  await page.waitForFunction(
    (id) => document.querySelector(`#${id}`)?.getAttribute("aria-expanded") === "true",
    fieldId,
    { timeout: 10_000 },
  );
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    (id) => {
      const element = document.querySelector(`#${id}`);
      return element instanceof HTMLInputElement && element.value.trim() !== "";
    },
    fieldId,
    { timeout: 10_000 },
  );
  return (await input.inputValue()).trim();
}

const browser = await launchBrowser();
const context = await browser.newContext({ viewport: DESKTOP });
const page = await context.newPage();

try {
  await check("1. / adresi /tr'ye yönleniyor", async () => {
    const response = await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    assert.ok(response, "yanıt alınamadı");
    const pathname = new URL(page.url()).pathname;
    assert.equal(pathname, "/tr", `beklenen /tr, gelen ${pathname}`);
    return page.url();
  });

  await check("2. 360 px genişlikte yatay kaydırma yok", async () => {
    await page.setViewportSize(MOBILE);
    const offenders = [];
    for (const path of PAGE_PATHS) {
      await page.goto(`${BASE_URL}${path}`, { waitUntil: "load" });
      const size = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      if (size.scrollWidth > size.innerWidth) {
        offenders.push(`${path}: ${size.scrollWidth} > ${size.innerWidth}`);
      }
    }
    assert.deepEqual(offenders, [], `yatay kaydırma: ${offenders.join(" | ")}`);
    return `${PAGE_PATHS.length} sayfa`;
  });

  await check("3. /tr sayfasında mavi renk yok", async () => {
    await page.setViewportSize(DESKTOP);
    await page.goto(`${BASE_URL}/tr`, { waitUntil: "load" });
    const offenders = await page.evaluate(() => {
      const parse = (value) => {
        const match = /^rgba?\(([^)]+)\)$/.exec(value ?? "");
        if (!match) return null;
        const parts = match[1].split(/[,/]/).map((part) => Number.parseFloat(part.trim()));
        const [r, g, b] = parts;
        const a = parts.length > 3 ? parts[3] : 1;
        if ([r, g, b].some((n) => Number.isNaN(n))) return null;
        return { r, g, b, a: Number.isNaN(a) ? 1 : a };
      };
      const props = ["color", "backgroundColor", "borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor"];
      const found = [];
      for (const element of document.querySelectorAll("*")) {
        const style = getComputedStyle(element);
        for (const prop of props) {
          const color = parse(style[prop]);
          if (!color || color.a === 0) continue;
          if (color.b > color.r + 40 && color.b > color.g + 40) {
            const cls = element.getAttribute("class") ?? "";
            found.push(`${element.tagName.toLowerCase()}[${cls.slice(0, 40)}] ${prop}=${style[prop]}`);
          }
        }
        if (found.length >= 10) break;
      }
      return found;
    });
    assert.deepEqual(offenders, [], `mavi baskın renkler: ${offenders.join(" | ")}`);
  });

  await check("4. Mobil menü aria-expanded ve ESC", async () => {
    await page.setViewportSize(MOBILE);
    await openHome(page);
    const toggle = page.locator('button[aria-controls="mobile-menu"]');
    await toggle.waitFor({ state: "visible", timeout: 10_000 });
    assert.equal(await toggle.getAttribute("aria-expanded"), "false", "menü başta açık görünüyor");

    await toggle.click();
    await page.waitForFunction(
      () => document.querySelector('button[aria-controls="mobile-menu"]')?.getAttribute("aria-expanded") === "true",
      null,
      { timeout: 10_000 },
    );
    await page.locator("#mobile-menu").waitFor({ state: "visible", timeout: 10_000 });

    await page.keyboard.press("Escape");
    await page.waitForFunction(
      () => document.querySelector('button[aria-controls="mobile-menu"]')?.getAttribute("aria-expanded") === "false",
      null,
      { timeout: 10_000 },
    );
    await page.locator("#mobile-menu").waitFor({ state: "detached", timeout: 10_000 });
  });

  await check("5. Boş widget gönderimi hata gösteriyor", async () => {
    await page.setViewportSize(DESKTOP);
    await openHome(page);
    await page.locator('form#rezervasyon button[type="submit"]').click();
    const error = page.locator('form#rezervasyon p[id$="-error"]').first();
    await error.waitFor({ state: "visible", timeout: 10_000 });
    const text = ((await error.textContent()) ?? "").trim();
    assert.ok(text.length > 0, "hata metni boş");
    assert.equal(new URL(page.url()).pathname, "/tr", "geçersiz formda yönlendirme yapılmış");
    return text;
  });

  await check("6. Widget doldurulup rezervasyon sayfasına gidiyor", async () => {
    await openHome(page);
    const from = await pickLocation(page, "rezervasyon-from", "Brük");
    const to = await pickLocation(page, "rezervasyon-to", "Paris");
    await page.fill("#rezervasyon-date", tomorrowISO());
    await page.locator('form#rezervasyon button[type="submit"]').click();
    await page.waitForURL((url) => url.pathname === "/tr/rezervasyon" && url.searchParams.has("from"), { timeout: 20_000 });
    assert.ok(page.url().includes("/tr/rezervasyon?from="), `beklenmeyen adres: ${page.url()}`);
    return `${from} -> ${to}`;
  });

  await check("7. Rezervasyon tamamlanıyor ve numara görünüyor", async () => {
    await page.goto(`${BASE_URL}/tr/rezervasyon${BOOKING_QUERY}`, { waitUntil: "domcontentloaded" });
    await waitForHydration(page, "#booking-vehicle-sedan");

    await page.locator('label[for="booking-vehicle-sedan"]').click();
    await page.waitForFunction(() => document.querySelector("#booking-vehicle-sedan")?.checked === true, null, {
      timeout: 10_000,
    });

    await page.fill("#booking-firstName", "Ayşe");
    await page.fill("#booking-lastName", "Yılmaz");
    await page.fill("#booking-email", "ayse@example.com");
    await page.fill("#booking-phone", "+32 470 00 00 00");
    await page.check("#booking-consent");
    await page.locator('form[aria-labelledby="booking-step-passenger"] button[type="submit"]').click();

    await page.waitForFunction(() => /EPT-[A-Z0-9]{6}/.test(document.body.innerText), null, { timeout: 30_000 });
    const reference = await page.evaluate(() => document.body.innerText.match(/EPT-[A-Z0-9]{6}/)?.[0] ?? "");
    assert.match(reference, /^EPT-[A-Z0-9]{6}$/);
    return reference;
  });

  await check("8. POST /api/booking 400 ve 201 yanıtları", async () => {
    const invalid = await context.request.post(`${BASE_URL}/api/booking`, {
      headers: { "content-type": "application/json" },
      data: "{bozuk",
    });
    assert.equal(invalid.status(), 400, `bozuk JSON için beklenen 400, gelen ${invalid.status()}`);

    const valid = await context.request.post(`${BASE_URL}/api/booking`, { data: SAMPLE_BOOKING });
    assert.equal(valid.status(), 201, `örnek gövde için beklenen 201, gelen ${valid.status()}`);
    const body = await valid.json();
    assert.equal(body.ok, true, "ok alanı true değil");
    assert.match(body.reference ?? "", /^EPT-[A-Z0-9]{6}$/);
    return body.reference;
  });

  await check("9. POST /api/contact 201 yanıtı", async () => {
    const response = await context.request.post(`${BASE_URL}/api/contact`, { data: SAMPLE_CONTACT });
    assert.equal(response.status(), 201, `beklenen 201, gelen ${response.status()}`);
    const body = await response.json();
    assert.equal(body.ok, true, "ok alanı true değil");
  });

  await check("10. SSS akordeonu klavyeyle açılıp kapanıyor", async () => {
    await openHome(page);
    const button = page.locator('section[aria-labelledby="faq-title"] button[aria-expanded]').first();
    await button.waitFor({ state: "visible", timeout: 10_000 });
    const before = await button.getAttribute("aria-expanded");
    await button.focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      (previous) => {
        const element = document.querySelector('section[aria-labelledby="faq-title"] button[aria-expanded]');
        return element?.getAttribute("aria-expanded") !== previous;
      },
      before,
      { timeout: 10_000 },
    );
    const after = await button.getAttribute("aria-expanded");
    assert.notEqual(after, before, "aria-expanded değişmedi");
    return `${before} -> ${after}`;
  });

  await check("11. /en ve /fr Türkçe yedeğe düşüyor", async () => {
    for (const locale of ["en", "fr"]) {
      const response = await page.goto(`${BASE_URL}/${locale}`, { waitUntil: "domcontentloaded" });
      assert.ok(response, `${locale}: yanıt alınamadı`);
      assert.equal(response.status(), 200, `${locale}: beklenen 200, gelen ${response.status()}`);
      const heading = ((await page.locator("h1#hero-title").first().textContent()) ?? "").replace(/\s+/g, " ").trim();
      assert.ok(
        heading.includes(HERO_TITLE.replace(/\s+/g, " ").trim()),
        `${locale}: Türkçe başlık bulunamadı, gelen "${heading.slice(0, 80)}"`,
      );
    }
  });
} finally {
  await context.close();
  await browser.close();
}

console.log(failed === 0 ? "\nTüm kontroller geçti." : `\n${failed} kontrol başarısız.`);
process.exit(failed === 0 ? 0 : 1);
