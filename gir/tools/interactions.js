/* Etkileşim duman testi — tüm çekirdek özellikleri gerçek tarayıcıda dener.
   Kullanım: node tools/serve.js 8090 &  →  node tools/interactions.js */
const { chromium } = require("playwright");
const BASE = "http://127.0.0.1:8090";

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("googleapis") && !m.text().includes("ERR_CONNECTION")) {
      errors.push("console: " + m.text());
    }
  });
  await page.addInitScript(() => {
    try { localStorage.setItem("gir-cookies", JSON.stringify("accepted")); } catch (e) {}
  });
  const results = [];
  const check = (name, ok, extra) => {
    results.push(`${ok ? "✓" : "✗"} ${name}${extra ? " — " + extra : ""}`);
    if (!ok) { process.exitCode = 1; }
  };

  /* --- kategori sayfası --- */
  await page.goto(BASE + "/fr/panneaux-bambou.html", { waitUntil: "networkidle" });

  let count = await page.locator(".js-product-grid .product-card").count();
  check("sayfalama: sayfa başına 3 kart", count === 3, `görünen=${count}`);
  check("sonuç sayacı", (await page.locator(".js-result-count").innerText()).includes("3"));

  await page.locator(".js-pagination button", { hasText: "2" }).click();
  count = await page.locator(".js-product-grid .product-card").count();
  check("sayfalama: 2. sayfada 1 kart", count === 1, `görünen=${count}`);

  await page.selectOption(".js-sort", "price-desc");
  const firstPrice = await page.locator(".js-product-grid .product-card").first().getAttribute("data-price");
  check("sıralama fiyat azalan", firstPrice === "99", `ilk=${firstPrice}`);

  /* fiyat filtresi: max'ı 90'a çek → 89'luk 2 ürün kalmalı */
  await page.locator(".js-price-max").evaluate((el) => {
    el.value = "90";
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  count = await page.locator(".js-product-grid .product-card").count();
  check("fiyat filtresi ≤90 €", count === 2, `görünen=${count}`);
  check("sayaç filtreyle güncellendi", (await page.locator(".js-result-count").innerText()).includes("2"));

  await page.locator(".js-filters-reset").click();
  count = await page.locator(".js-product-grid .product-card").count();
  check("filtre sıfırlama", count === 3, `görünen=${count}`);

  /* sepete ekle → drawer + sayaç + localStorage */
  await page.locator(".js-product-grid [data-add-to-cart]").first().click();
  await page.waitForTimeout(400);
  check("sepet drawer açıldı", await page.locator(".js-cart-drawer").evaluate((el) => el.classList.contains("cart-drawer--open")));
  check("sepet satırı oluştu", (await page.locator(".cart-item").count()) === 1);
  check("sepet sayacı 1", (await page.locator(".js-cart-count").first().innerText()) === "1");
  const stored = await page.evaluate(() => localStorage.getItem("gir-cart"));
  check("localStorage sepeti", !!stored && stored.includes("qty"));
  await page.locator(".js-cart-close").click();

  /* arama */
  await page.fill(".header-search__input", "argile");
  await page.waitForTimeout(200);
  check("arama sonucu (argile)", (await page.locator(".header-search__result").count()) === 1);

  /* filtre accordion */
  await page.locator(".filter-group__toggle").first().click();
  check("filtre accordion kapandı", await page.locator(".filter-group").first().evaluate((el) => el.classList.contains("filter-group--collapsed")));

  /* tema switcher */
  await page.selectOption("#theme-select", "warm-clay");
  const theme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  check("tema switcher", theme === "warm-clay");
  const savedTheme = await page.evaluate(() => localStorage.getItem("gir-theme"));
  check("tema localStorage", savedTheme === JSON.stringify("warm-clay"));

  /* --- ürün sayfası --- */
  await page.goto(BASE + "/fr/produit-clay-bp06.html", { waitUntil: "networkidle" });
  check("tema kalıcı (warm-clay)", (await page.evaluate(() => document.documentElement.getAttribute("data-theme"))) === "warm-clay");
  check("sepet sayacı sayfalar arası", (await page.locator(".js-cart-count").first().innerText()) === "1");

  /* galeri thumb → ana görsel değişimi */
  const before = await page.locator(".js-gallery-img").getAttribute("src");
  await page.locator(".js-gallery-thumb").nth(1).click();
  const after = await page.locator(".js-gallery-img").getAttribute("src");
  check("galeri thumb geçişi", before !== after && after.includes("room"));

  /* lightbox */
  await page.locator(".js-gallery-main").click();
  check("lightbox açıldı", !(await page.locator(".js-lightbox").evaluate((el) => el.hidden)));
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Escape");
  check("lightbox Escape ile kapandı", await page.locator(".js-lightbox").evaluate((el) => el.hidden));

  /* sekmeler */
  await page.locator("#tab-specs").click();
  check("sekme: özellikler paneli", !(await page.locator("#panel-specs").evaluate((el) => el.hidden)));
  check("sekme: açıklama gizlendi", await page.locator("#panel-desc").evaluate((el) => el.hidden));

  /* adet + sepete ekle (qty=3) */
  await page.locator(".js-qty-plus").click();
  await page.locator(".js-qty-plus").click();
  await page.locator("[data-add-to-cart][data-use-qty]").click();
  await page.waitForTimeout(400);
  const subtotal = await page.locator(".js-cart-subtotal").innerText();
  check("adetli sepete ekleme (89 + 3×94 = 371)", subtotal.replace(/ /g, " ").includes("371"), subtotal);

  /* sepetten çıkarma */
  await page.locator(".cart-item__remove").first().click();
  check("sepetten çıkarma", (await page.locator(".cart-item").count()) === 1);

  /* swatch linki */
  const swatchHref = await page.locator(".swatches__item").first().getAttribute("href");
  check("swatch başka ürüne gidiyor", swatchHref === "produit-ivory-bp02.html", swatchHref);

  /* --- mobil: off-canvas + filtre drawer --- */
  const mob = await browser.newPage({ viewport: { width: 390, height: 800 } });
  await mob.addInitScript(() => { try { localStorage.setItem("gir-cookies", JSON.stringify("accepted")); } catch (e) {} });
  mob.on("pageerror", (e) => errors.push("mobil pageerror: " + e.message));
  await mob.goto(BASE + "/tr/bambu-paneller.html", { waitUntil: "networkidle" });
  await mob.locator(".js-menu-open").click();
  check("mobil off-canvas menü", await mob.locator(".js-offcanvas").evaluate((el) => el.classList.contains("offcanvas--open")));
  await mob.keyboard.press("Escape");
  check("menü Escape ile kapandı", !(await mob.locator(".js-offcanvas").evaluate((el) => el.classList.contains("offcanvas--open"))));
  await mob.locator(".js-filters-open").click();
  check("mobil filtre drawer", await mob.locator(".js-sidebar").evaluate((el) => el.classList.contains("sidebar--open")));
  await mob.close();

  /* --- dil anahtarı hedefleri --- */
  await page.goto(BASE + "/fr/produit-camel-bp10.html", { waitUntil: "load" });
  const trLink = await page.locator(".header-actions__lang-link", { hasText: "TR" }).getAttribute("href");
  check("dil anahtarı FR→TR ürün eşleşmesi", trLink === "../tr/urun-camel-bp10.html", trLink);

  console.log(results.join("\n"));
  if (errors.length) {
    console.log("\nJS HATALARI:");
    errors.forEach((e) => console.log("  " + e));
    process.exitCode = 1;
  } else {
    console.log("\nJS hatası yok ✓");
  }
  await browser.close();
})();
