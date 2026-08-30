#!/usr/bin/env node
/* ============================================================
   GIR Décor — statik site üretici (node build.js)
   data/i18n/*.json + data/products.json + js/config.js okur;
   fr/ ve tr/ altına statik HTML basar (SEO — runtime çeviri yok).
   ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const CFG = require("./js/config.js");
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "data/products.json"), "utf8"));
const DICTS = {
  fr: JSON.parse(fs.readFileSync(path.join(ROOT, "data/i18n/fr.json"), "utf8")),
  tr: JSON.parse(fs.readFileSync(path.join(ROOT, "data/i18n/tr.json"), "utf8"))
};
const MARK_SVG = fs.readFileSync(path.join(ROOT, CFG.BRAND.mark), "utf8")
  .replace(/<\?xml[^>]*\?>\s*/, "").trim();

const PRODUCTS = DATA.products;
const YEAR = new Date().getFullYear();

/* ---------- sayfa haritası (dil anahtarı + hreflang) ---------- */
const PAGES = {
  home:     { fr: "index.html",              tr: "index.html" },
  category: { fr: "panneaux-bambou.html",    tr: "bambu-paneller.html" },
  tiles:    { fr: "carrelages.html",         tr: "fayanslar.html" },
  awnings:  { fr: "auvents-fenetres.html",   tr: "pencere-sundurmalari.html" },
  contact:  { fr: "contact.html",            tr: "iletisim.html" }
};
const productFile = (lang, slug) => (lang === "fr" ? `produit-${slug}.html` : `urun-${slug}.html`);

/* ---------- yardımcılar ---------- */
const phoneHtml = () => esc(CFG.CONTACT.phone).split(" ").join("&nbsp;");
const esc = (s) => String(s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

function t(dict, key, params) {
  let v = key.split(".").reduce((acc, p) => (acc && acc[p] != null ? acc[p] : null), dict);
  if (typeof v !== "string") { throw new Error(`i18n anahtarı eksik [${dict.lang}]: ${key}`); }
  if (params) { for (const [k, val] of Object.entries(params)) { v = v.split(`{${k}}`).join(String(val)); } }
  return v;
}

const fmtCache = {};
function money(lang, n) {
  const loc = lang === "tr" ? "tr-TR" : "fr-BE";
  fmtCache[loc] = fmtCache[loc] || new Intl.NumberFormat(loc, { style: "currency", currency: CFG.currency });
  return fmtCache[loc].format(n);
}
function num(lang, n) {
  const loc = lang === "tr" ? "tr-TR" : "fr-BE";
  return new Intl.NumberFormat(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}
const perM2 = (lang, p) => money(lang, p.price / CFG.panelArea);

/* webp varyant srcset'i: assets/…/name.jpg → name-400/800/1600.webp */
function srcset(rel, widths) {
  const base = rel.replace(/\.(jpg|png)$/i, "");
  return widths.map((w) => `../${base}-${w}.webp ${w}w`).join(", ");
}
const A = (rel) => `../${rel}`; // fr|tr klasöründen site köküne

/* ---------- ikonlar (inline SVG, stroke=currentColor) ---------- */
const IC = {
  check: '<path d="M4 12.5 9.5 18 20 6"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.5-6.5 8-6.5s8 2.5 8 6.5"/>',
  cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/><path d="M3 4h2l2.5 11h10L20 8H6.6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  leaf: '<path d="M5 19C5 9 12 4 20 4c0 8-5 15-15 15Z"/><path d="M5 19c3-6 7-9 11-11"/>',
  panel: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 3v18M15 3v18"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
  bed: '<path d="M3 18v-8m0 4h18v4m0-4v-2a3 3 0 0 0-3-3H10v5"/><circle cx="6.5" cy="11.5" r="1.5"/>',
  sofa: '<path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3"/><path d="M3 18v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4M5 18v2M19 18v2"/>',
  pot: '<path d="M4 10h16v4a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6Z"/><path d="M2 10h20M9 6c0-2 6-2 6 0"/>',
  desk: '<rect x="3" y="4" width="18" height="11" rx="1"/><path d="M12 15v5M8 20h8"/>',
  truck: '<path d="M2 6h12v11H2zM14 10h4l3 3v4h-7z"/><circle cx="6" cy="18" r="1.6"/><circle cx="17.5" cy="18" r="1.6"/>',
  shield: '<path d="M12 3 5 6v6c0 4.4 3 7.5 7 9 4-1.5 7-4.6 7-9V6Z"/><path d="m9 12 2 2 4-4.5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  pin: '<path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
  zoom: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8M8 11h6M11 8v6"/>'
};
const icon = (name, cls) =>
  `<svg class="icon${cls ? " " + cls : ""}" viewBox="0 0 24 24" aria-hidden="true">${IC[name]}</svg>`;

/* ---------- ortak parçalar ---------- */
function head(lang, { title, description, pageKey, slug }) {
  const other = lang === "fr" ? "tr" : "fr";
  const file = (l) => (slug ? productFile(l, slug) : PAGES[pageKey][l]);
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="alternate" hreflang="fr" href="../fr/${file("fr")}">
<link rel="alternate" hreflang="tr" href="../tr/${file("tr")}">
<link rel="alternate" hreflang="x-default" href="../fr/${file("fr")}">
<link rel="icon" type="image/svg+xml" href="${A(CFG.BRAND.mark)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" media="print" onload="this.media='all'">
<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap"></noscript>
<link rel="stylesheet" href="../css/tokens.css">
<link rel="stylesheet" href="../css/main.css">
<script>try{var girTheme=JSON.parse(localStorage.getItem("gir-theme"));if(girTheme){document.documentElement.setAttribute("data-theme",girTheme);}}catch(e){}</script>
</head>`;
}

function runtimePayload(lang, dict) {
  const products = {};
  for (const p of PRODUCTS) {
    products[p.slug] = {
      name: p.name[lang],
      sku: p.sku,
      price: p.price,
      image: A(p.images[0].replace(/\.(jpg|png)$/i, "") + "-400.webp"),
      url: productFile(lang, p.slug)
    };
  }
  const i18n = {
    product: { addedToCart: t(dict, "product.addedToCart") },
    cart: dict.cart,
    search: { noResults: t(dict, "search.noResults") },
    category: {
      resultsCount: t(dict, "category.resultsCount"),
      resultsCountAll: t(dict, "category.resultsCountAll"),
      paginationPrev: t(dict, "category.paginationPrev"),
      paginationNext: t(dict, "category.paginationNext"),
      paginationPage: t(dict, "category.paginationPage")
    }
  };
  const payload = {
    lang,
    root: "../",
    categoryUrl: PAGES.category[lang],
    contactEmail: CFG.CONTACT.email,
    products,
    i18n
  };
  return `<script>window.__GIR_PAGE__=${JSON.stringify(payload).replace(/</g, "\\u003c")};</script>`;
}

function topbar(lang, dict) {
  const T = (k) => esc(t(dict, k));
  return `
<div class="topbar">
  <div class="container topbar__inner">
    <ul class="topbar__usps">
      <li class="topbar__usp">${icon("check")}<span>${T("topbar.usp1")}</span></li>
      <li class="topbar__usp">${icon("check")}<span>${T("topbar.usp2")}</span></li>
      <li class="topbar__usp topbar__usp--optional">${icon("check")}<span>${T("topbar.usp3")}</span></li>
    </ul>
    <span class="topbar__phone">${icon("phone")}<span>${T("topbar.phoneLabel")}</span> <a class="topbar__phone-link" href="tel:${CFG.CONTACT.phone.replace(/\s/g, "")}">${phoneHtml()}</a></span>
  </div>
</div>`;
}

function navLinks(lang, dict, active) {
  return [
    { key: "home", label: t(dict, "nav.home"), href: PAGES.home[lang] },
    { key: "category", label: t(dict, "nav.wallPanels"), href: PAGES.category[lang], sub: [{ label: t(dict, "nav.bambooPanels"), href: PAGES.category[lang] }] },
    { key: "tiles", label: t(dict, "nav.tiles"), href: PAGES.tiles[lang] },
    { key: "awnings", label: t(dict, "nav.awnings"), href: PAGES.awnings[lang] },
    { key: "contact", label: t(dict, "nav.contact"), href: PAGES.contact[lang] }
  ].map((l) => ({ ...l, active: l.key === active }));
}

function header(lang, dict, active, { slug } = {}) {
  const T = (k) => esc(t(dict, k));
  const other = lang === "fr" ? "tr" : "fr";
  const switchHref = `../${other}/${slug ? productFile(other, slug) : PAGES[Object.keys(PAGES).includes(active) ? active : "home"][other]}`;
  const links = navLinks(lang, dict, active);

  const navItems = links.map((l) => {
    if (l.sub) {
      return `<li class="main-nav__item main-nav__item--has-sub">
        <a class="main-nav__link${l.active ? " main-nav__link--active" : ""}" href="${l.href}">${esc(l.label)}</a>
        <button class="main-nav__toggle js-submenu-toggle" type="button" aria-expanded="false" aria-label="${T("nav.submenuOpen")}">${icon("chevronDown", "main-nav__caret")}</button>
        <ul class="main-nav__submenu">
          ${l.sub.map((s) => `<li><a class="main-nav__sublink" href="${s.href}">${esc(s.label)}</a></li>`).join("\n")}
        </ul>
      </li>`;
    }
    return `<li class="main-nav__item"><a class="main-nav__link${l.active ? " main-nav__link--active" : ""}" href="${l.href}">${esc(l.label)}</a></li>`;
  }).join("\n");

  const offcanvasItems = links.map((l) => {
    const sub = l.sub ? l.sub.map((s) => `<li><a class="offcanvas__link offcanvas__link--sub" href="${s.href}">${esc(s.label)}</a></li>`).join("") : "";
    return `<li><a class="offcanvas__link" href="${l.href}">${esc(l.label)}</a></li>${sub}`;
  }).join("\n");

  return `
<a class="skip-link" href="#main-content">${T("skipToContent")}</a>
${topbar(lang, dict)}
<header class="site-header">
  <div class="container site-header__main">
    <button class="site-header__burger js-menu-open" type="button" aria-label="${T("header.menuOpen")}">${icon("menu", "icon--lg")}</button>
    <a class="site-header__logo" href="${PAGES.home[lang]}">
      <img class="site-header__logo-img" src="${A(CFG.BRAND.logo.replace(/\.png$/, "-320.png"))}" srcset="${A(CFG.BRAND.logo.replace(/\.png$/, "-320.webp"))}" alt="${T("header.logoAlt")}" width="320" height="226">
    </a>
    <div class="header-search">
      <form class="header-search__form js-search-form" role="search" action="#" aria-label="${T("header.searchLabel")}">
        <input class="header-search__input" type="search" name="q" placeholder="${T("header.searchPlaceholder")}" aria-label="${T("header.searchLabel")}" autocomplete="off">
        <button class="header-search__btn" type="submit" aria-label="${T("header.searchButton")}">${icon("search")}</button>
      </form>
      <div class="header-search__results js-search-results" hidden></div>
    </div>
    <div class="header-actions">
      <a class="header-actions__item header-actions__item--optional" href="${PAGES.contact[lang]}">${icon("user", "icon--lg")}<span>${T("header.account")}</span></a>
      <button class="header-actions__item js-cart-open" type="button" aria-label="${T("header.cartOpen")}">
        ${icon("cart", "icon--lg")}<span>${T("header.cart")}</span>
        <span class="header-actions__count js-cart-count" hidden>0</span>
      </button>
      <nav class="header-actions__lang" aria-label="${T("header.langSwitch")}">
        <a class="header-actions__lang-link${lang === "fr" ? " header-actions__lang-link--active" : ""}" href="${lang === "fr" ? "#main-content" : switchHref}"${lang === "fr" ? ' aria-current="true"' : ' hreflang="fr" lang="fr"'}>FR</a>
        <span class="header-actions__lang-sep" aria-hidden="true">|</span>
        <a class="header-actions__lang-link${lang === "tr" ? " header-actions__lang-link--active" : ""}" href="${lang === "tr" ? "#main-content" : switchHref}"${lang === "tr" ? ' aria-current="true"' : ' hreflang="tr" lang="tr"'}>TR</a>
      </nav>
    </div>
  </div>
  <nav class="main-nav" aria-label="${T("a11y.mainNav")}">
    <div class="container">
      <ul class="main-nav__list">
${navItems}
      </ul>
    </div>
  </nav>
</header>

<aside class="offcanvas js-offcanvas" inert aria-label="${T("a11y.mobileMenu")}">
  <div class="offcanvas__head">
    <span class="offcanvas__title">${esc(CFG.BRAND.name)}</span>
    <button class="offcanvas__close js-menu-close" type="button" aria-label="${T("header.menuClose")}">${icon("x", "icon--lg")}</button>
  </div>
  <div class="offcanvas__body">
    <ul>
${offcanvasItems}
    </ul>
  </div>
  <div class="offcanvas__footer">
    <a class="offcanvas__phone" href="tel:${CFG.CONTACT.phone.replace(/\s/g, "")}">${icon("phone")}<span>${phoneHtml()}</span></a>
  </div>
</aside>`;
}

function cartDrawer(lang, dict) {
  const T = (k) => esc(t(dict, k));
  return `
<aside class="cart-drawer js-cart-drawer" inert aria-label="${T("cart.title")}">
  <div class="cart-drawer__head">
    <h2 class="cart-drawer__title">${T("cart.title")}</h2>
    <button class="cart-drawer__close js-cart-close" type="button" aria-label="${T("cart.close")}">${icon("x", "icon--lg")}</button>
  </div>
  <div class="cart-drawer__body js-cart-body"></div>
  <div class="cart-drawer__foot">
    <p class="cart-drawer__subtotal"><span>${T("cart.subtotal")}</span><span class="js-cart-subtotal">–</span></p>
    <p class="cart-drawer__vat">${T("cart.vatNote")}</p>
    <a class="btn btn--accent btn--block js-cart-quote" href="mailto:${esc(CFG.CONTACT.email)}">${T("cart.quoteCta")}</a>
    <p class="cart-drawer__note">${T("cart.note")}</p>
  </div>
</aside>
<div class="overlay js-overlay"></div>`;
}

function footer(lang, dict) {
  const T = (k) => esc(t(dict, k));
  const address = lang === "tr" ? CFG.CONTACT.addressTr : CFG.CONTACT.address;
  return `
<footer class="site-footer">
  <div class="container site-footer__grid">
    <div>
      <div class="site-footer__mark" role="img" aria-label="${T("footer.markAlt")}">${MARK_SVG}</div>
      <p class="site-footer__about">${T("footer.aboutText")}</p>
      <p class="trust-badge">${icon("shield")}<span>${T("footer.trustText")}</span></p>
    </div>
    <nav aria-label="${T("footer.menuTitle")}">
      <h2 class="site-footer__title">${T("footer.menuTitle")}</h2>
      <ul>
        <li><a class="site-footer__link" href="${PAGES.home[lang]}">${esc(t(dict, "nav.home"))}</a></li>
        <li><a class="site-footer__link" href="${PAGES.category[lang]}">${esc(t(dict, "nav.bambooPanels"))}</a></li>
        <li><a class="site-footer__link" href="${PAGES.tiles[lang]}">${esc(t(dict, "nav.tiles"))}</a></li>
        <li><a class="site-footer__link" href="${PAGES.awnings[lang]}">${esc(t(dict, "nav.awnings"))}</a></li>
      </ul>
    </nav>
    <nav aria-label="${T("footer.serviceTitle")}">
      <h2 class="site-footer__title">${T("footer.serviceTitle")}</h2>
      <ul>
        <li><a class="site-footer__link" href="${PAGES.contact[lang]}">${T("footer.serviceQuote")}</a></li>
        <li><a class="site-footer__link" href="${PAGES.contact[lang]}">${T("footer.serviceShipping")}</a></li>
        <li><a class="site-footer__link" href="${PAGES.contact[lang]}">${T("footer.serviceReturns")}</a></li>
        <li><a class="site-footer__link" href="${PAGES.contact[lang]}">${T("footer.serviceFaq")}</a></li>
      </ul>
    </nav>
    <div>
      <h2 class="site-footer__title">${T("footer.contactTitle")}</h2>
      <address class="site-footer__contact">
        <p>${icon("pin")}<span>${esc(address)}</span></p>
        <p>${icon("phone")}<a href="tel:${CFG.CONTACT.phone.replace(/\s/g, "")}">${phoneHtml()}</a></p>
        <p>${icon("mail")}<a href="mailto:${esc(CFG.CONTACT.email)}">${esc(CFG.CONTACT.email)}</a></p>
        <p>${icon("clock")}<span>${esc(CFG.CONTACT.hours[lang])}</span></p>
      </address>
    </div>
  </div>
  <div class="site-footer__bar">
    <div class="container site-footer__bar-inner">
      <span>${esc(t(dict, "footer.rights", { year: YEAR }))} · ${T("footer.demoNote")}</span>
      <div class="payments" role="group" aria-label="${T("footer.paymentTitle")}">
        <span class="payments__badge">Bancontact</span>
        <span class="payments__badge">Visa</span>
        <span class="payments__badge">Mastercard</span>
        <span class="payments__badge">PayPal</span>
        <span class="payments__badge">SEPA</span>
      </div>
    </div>
  </div>
</footer>`;
}

function commonFoot(lang, dict) {
  const T = (k) => esc(t(dict, k));
  const themeNames = {
    "navy-gold": t(dict, "themeSwitcher.navyGold"),
    "warm-clay": t(dict, "themeSwitcher.warmClay"),
    "charcoal-brass": t(dict, "themeSwitcher.charcoalBrass"),
    "sage-linen": t(dict, "themeSwitcher.sageLinen")
  };
  return `
<section class="cookie-bar js-cookie-bar" aria-label="Cookies" hidden>
  <p class="cookie-bar__text">${T("cookie.text")}</p>
  <div class="cookie-bar__actions">
    <button class="btn btn--sm btn--primary js-cookie-choice" type="button" data-choice="accepted">${T("cookie.accept")}</button>
    <button class="btn btn--sm btn--light js-cookie-choice" type="button" data-choice="declined">${T("cookie.decline")}</button>
  </div>
</section>

<!-- dev tema switcher — yayında bu bloğu silin -->
<div id="dev-theme-switcher">
  <label for="theme-select">${T("themeSwitcher.label")}</label>
  <select id="theme-select">
    ${CFG.themes.map((th) => `<option value="${th}">${esc(themeNames[th])}</option>`).join("\n    ")}
  </select>
</div>

${runtimePayload(lang, dict)}
<script src="../js/config.js" defer></script>
<script src="../js/i18n.js" defer></script>
<script src="../js/main.js" defer></script>`;
}

function breadcrumb(lang, dict, trail) {
  const T = (k) => esc(t(dict, k));
  const items = [{ label: t(dict, "breadcrumb.home"), href: PAGES.home[lang] }, ...trail];
  return `
<nav class="breadcrumb" aria-label="${T("breadcrumb.ariaLabel")}">
  <div class="container">
    <ol class="breadcrumb__list">
      ${items.map((it, i) => i === items.length - 1
        ? `<li class="breadcrumb__item"><span class="breadcrumb__current" aria-current="page">${esc(it.label)}</span></li>`
        : `<li class="breadcrumb__item"><a class="breadcrumb__link" href="${it.href}">${esc(it.label)}</a></li>`).join("\n      ")}
    </ol>
  </div>
</nav>`;
}

/* ---------- ürün kartı ---------- */
function productCard(lang, dict, p, idx, { homeGrid = false, headingLevel = 3 } = {}) {
  const T = (k) => esc(t(dict, k));
  const sizes = homeGrid
    ? "(max-width: 480px) 92vw, (max-width: 992px) 46vw, 280px"
    : "(max-width: 480px) 92vw, (max-width: 992px) 46vw, 300px";
  const badge = p.badge ? `<span class="product-card__badge">${esc(t(dict, "badge." + p.badge))}</span>` : "";
  const old = p.oldPrice ? `<span class="product-card__price-old">${money(lang, p.oldPrice)}</span>` : "";
  return `
<li class="product-card" data-price="${p.price}" data-name="${esc(p.name[lang].toLowerCase())}" data-index="${idx}" data-new="${p.badge === "new" ? 1 : 0}" data-finish="mat-premium" data-thickness="5mm">
  ${badge}
  <div class="product-card__media">
    <img class="product-card__img" src="${A(p.images[0])}" srcset="${srcset(p.images[0], [400, 800])}" sizes="${sizes}" alt="${esc(p.name[lang])} — ${T("product.imageAltProduct")}" width="800" height="800" loading="lazy">
    <img class="product-card__img product-card__img--hover" src="${A(p.images[1])}" srcset="${srcset(p.images[1], [400, 800])}" sizes="${sizes}" alt="${esc(p.name[lang])} — ${T("card.hoverAlt")}" width="800" height="800" loading="lazy">
  </div>
  <div class="product-card__body">
    <h${headingLevel} class="product-card__title"><a class="product-card__link" href="${productFile(lang, p.slug)}">${esc(p.name[lang])}</a></h${headingLevel}>
    <p class="product-card__sku">${T("product.sku")} ${esc(p.sku)} · 122 × 280 cm · 5 mm</p>
    <div class="product-card__price-row">
      <span class="product-card__price">${money(lang, p.price)}</span>
      ${old}
      <span class="product-card__unit">${esc(p.unit[lang])}</span>
    </div>
    <p class="product-card__meta">${esc(t(dict, "card.perM2", { price: perM2(lang, p) }))} · ${T("card.vat")}</p>
    <span class="product-card__stock">${icon("check")}${T("card.inStock")}</span>
    <div class="product-card__actions">
      <button class="btn btn--primary btn--sm btn--block" type="button" data-add-to-cart="${p.slug}">${T("card.addToCart")}</button>
    </div>
  </div>
</li>`;
}

/* ============================================================
   SAYFALAR
   ============================================================ */
function renderHome(lang) {
  const dict = DICTS[lang];
  const T = (k) => esc(t(dict, k));
  const hero = "assets/img/products/linen-bp03/linen-bp03-room.jpg";
  return `${head(lang, { title: t(dict, "meta.home.title"), description: t(dict, "meta.home.description"), pageKey: "home" })}
<body class="page page--home">
${header(lang, dict, "home")}
<main class="page__main" id="main-content">

  <section class="hero">
    <div class="hero__media">
      <img class="hero__img" src="${A(hero)}" srcset="${srcset(hero, [800, 1600])}" sizes="100vw" alt="${T("home.heroImageAlt")}" width="1536" height="1536" fetchpriority="high">
    </div>
    <div class="container">
      <div class="hero__inner">
        <p class="hero__eyebrow">${esc(CFG.BRAND.fullName)} · ${esc(CFG.BRAND.country)}</p>
        <h1 class="hero__title">${T("home.heroTitle")}</h1>
        <p class="hero__subtitle">${T("home.heroSubtitle")}</p>
        <div class="hero__actions">
          <a class="btn btn--accent" href="${PAGES.category[lang]}">${T("home.heroCta")}</a>
          <a class="btn btn--light" href="${PAGES.contact[lang]}">${T("home.heroSecondary")}</a>
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="section__head">
        <h2 class="section__title">${T("home.featuredTitle")}</h2>
        <p class="section__subtitle">${T("home.featuredSubtitle")}</p>
      </div>
      <ul class="product-grid product-grid--home">
${PRODUCTS.map((p, i) => productCard(lang, dict, p, i, { homeGrid: true })).join("\n")}
      </ul>
      <div class="section__foot">
        <a class="btn btn--ghost" href="${PAGES.category[lang]}">${T("home.viewAll")}</a>
      </div>
    </div>
  </section>

  <section class="section section--alt">
    <div class="container">
      <div class="section__head">
        <h2 class="section__title">${T("home.whyTitle")}</h2>
      </div>
      <div class="features">
        <div class="feature">
          <div class="feature__icon">${icon("leaf", "icon--xl")}</div>
          <h3 class="feature__title">${T("home.why1Title")}</h3>
          <p class="feature__text">${T("home.why1Text")}</p>
        </div>
        <div class="feature">
          <div class="feature__icon">${icon("panel", "icon--xl")}</div>
          <h3 class="feature__title">${T("home.why2Title")}</h3>
          <p class="feature__text">${T("home.why2Text")}</p>
        </div>
        <div class="feature">
          <div class="feature__icon">${icon("sparkle", "icon--xl")}</div>
          <h3 class="feature__title">${T("home.why3Title")}</h3>
          <p class="feature__text">${T("home.why3Text")}</p>
        </div>
      </div>
    </div>
  </section>

  <section class="cta-band">
    <div class="container cta-band__inner">
      <div>
        <h2 class="cta-band__title">${T("home.ctaTitle")}</h2>
        <p class="cta-band__text">${T("home.ctaText")}</p>
      </div>
      <a class="btn btn--accent" href="${PAGES.contact[lang]}">${T("home.ctaButton")}</a>
    </div>
  </section>

</main>
${footer(lang, dict)}
${cartDrawer(lang, dict)}
${commonFoot(lang, dict)}
</body>
</html>`;
}

function renderCategory(lang) {
  const dict = DICTS[lang];
  const T = (k) => esc(t(dict, k));
  const prices = PRODUCTS.map((p) => p.price);
  const lo = Math.floor(Math.min(...prices) / 10) * 10;
  const hi = Math.ceil(Math.max(...prices) / 10) * 10;
  const finishLabel = PRODUCTS[0].specs.finish[lang];

  return `${head(lang, { title: t(dict, "meta.category.title"), description: t(dict, "meta.category.description"), pageKey: "category" })}
<body class="page page--category">
${header(lang, dict, "category")}
<main class="page__main" id="main-content">
${breadcrumb(lang, dict, [
    { label: t(dict, "nav.wallPanels"), href: PAGES.category[lang] },
    { label: t(dict, "category.h1") }
  ])}

  <div class="container page-head">
    <h1>${T("category.h1")}</h1>
    <p class="page-head__desc">${T("category.description")}</p>
  </div>

  <div class="container shop-layout">
    <aside class="sidebar js-sidebar" aria-label="${T("category.filtersTitle")}">
      <div class="sidebar__mobile-head">
        <span class="sidebar__mobile-title">${T("category.filtersTitle")}</span>
        <button class="sidebar__mobile-close js-filters-close" type="button" aria-label="${T("category.filtersClose")}">${icon("x", "icon--lg")}</button>
      </div>

      <div class="filter-group">
        <button class="filter-group__toggle" type="button" aria-expanded="true">${T("category.categoriesTitle")}${icon("chevronDown")}</button>
        <div class="filter-group__body">
          <ul class="cat-list">
            <li class="cat-list__item"><a class="cat-list__link" href="${PAGES.category[lang]}">${esc(t(dict, "nav.wallPanels"))}<span class="cat-list__count">(4)</span></a></li>
            <li class="cat-list__item"><a class="cat-list__link cat-list__link--sub cat-list__link--active" href="${PAGES.category[lang]}" aria-current="page">${esc(t(dict, "nav.bambooPanels"))}<span class="cat-list__count">(4)</span></a></li>
            <li class="cat-list__item"><a class="cat-list__link" href="${PAGES.tiles[lang]}">${esc(t(dict, "nav.tiles"))}<span class="cat-list__count">(0)</span></a></li>
            <li class="cat-list__item"><a class="cat-list__link" href="${PAGES.awnings[lang]}">${esc(t(dict, "nav.awnings"))}<span class="cat-list__count">(0)</span></a></li>
          </ul>
        </div>
      </div>

      <div class="filter-group">
        <button class="filter-group__toggle" type="button" aria-expanded="true">${T("category.priceTitle")}${icon("chevronDown")}</button>
        <div class="filter-group__body price-filter">
          <div class="price-filter__slider">
            <div class="price-filter__track"></div>
            <div class="price-filter__range js-price-range"></div>
            <input class="price-filter__input js-price-min" type="range" min="${lo}" max="${hi}" step="1" value="${lo}" aria-label="${T("category.priceFrom")}">
            <input class="price-filter__input js-price-max" type="range" min="${lo}" max="${hi}" step="1" value="${hi}" aria-label="${T("category.priceTo")}">
          </div>
          <div class="price-filter__values">
            <span class="js-price-min-label">${money(lang, lo)}</span>
            <span class="js-price-max-label">${money(lang, hi)}</span>
          </div>
          <button class="btn btn--sm btn--light js-filters-reset" type="button">${T("category.filtersReset")}</button>
        </div>
      </div>

      <div class="filter-group">
        <button class="filter-group__toggle" type="button" aria-expanded="true">${T("category.finishTitle")}${icon("chevronDown")}</button>
        <div class="filter-group__body">
          <ul class="check-list">
            <li class="check-list__item">
              <input class="check-list__input" type="checkbox" id="filter-finish-mat" value="mat-premium" data-filter="finish">
              <label class="check-list__label" for="filter-finish-mat">${esc(finishLabel)}</label>
              <span class="check-list__count">(4)</span>
            </li>
          </ul>
        </div>
      </div>

      <div class="filter-group">
        <button class="filter-group__toggle" type="button" aria-expanded="true">${T("category.thicknessTitle")}${icon("chevronDown")}</button>
        <div class="filter-group__body">
          <ul class="check-list">
            <li class="check-list__item">
              <input class="check-list__input" type="checkbox" id="filter-thickness-5" value="5mm" data-filter="thickness">
              <label class="check-list__label" for="filter-thickness-5">5 mm</label>
              <span class="check-list__count">(4)</span>
            </li>
          </ul>
        </div>
      </div>
    </aside>

    <section class="shop-main">
      <div class="shop-toolbar">
        <p class="shop-toolbar__count js-result-count">${esc(t(dict, "category.resultsCountAll", { total: PRODUCTS.length }))}</p>
        <div class="shop-toolbar__right">
          <button class="btn btn--sm btn--light shop-toolbar__filters-btn js-filters-open" type="button">${icon("menu")}${T("category.filtersOpen")}</button>
          <label class="visually-hidden" for="sort-select">${T("category.sortLabel")}</label>
          <select class="shop-toolbar__sort js-sort" id="sort-select">
            <option value="default">${T("category.sortDefault")}</option>
            <option value="price-asc">${T("category.sortPriceAsc")}</option>
            <option value="price-desc">${T("category.sortPriceDesc")}</option>
            <option value="name-asc">${T("category.sortNameAsc")}</option>
            <option value="newest">${T("category.sortNewest")}</option>
          </select>
        </div>
      </div>

      <ul class="product-grid js-product-grid" data-page-size="3">
${PRODUCTS.map((p, i) => productCard(lang, dict, p, i, { headingLevel: 2 })).join("\n")}
      </ul>
      <div class="shop-empty js-shop-empty" hidden>${T("category.noResults")}</div>
      <nav class="pagination js-pagination" aria-label="${T("category.paginationLabel")}"></nav>
    </section>
  </div>

</main>
${footer(lang, dict)}
${cartDrawer(lang, dict)}
${commonFoot(lang, dict)}
</body>
</html>`;
}

function renderProduct(lang, p) {
  const dict = DICTS[lang];
  const T = (k) => esc(t(dict, k));
  const name = p.name[lang];
  const altFor = (img) => {
    if (img.includes("-room")) { return t(dict, "product.imageAltRoom"); }
    if (img.includes("-infographic")) { return t(dict, "product.imageAltInfographic"); }
    if (img.includes("-texture")) { return t(dict, "product.imageAltTexture"); }
    return t(dict, "product.imageAltProduct");
  };
  const first = p.images[0];
  const hasInfographic = p.images.some((im) => im.includes("-infographic"));

  const thumbs = p.images.map((img, i) => {
    const full = A(img.replace(/\.(jpg|png)$/i, "") + "-1600.webp");
    const ss = srcset(img, [400, 800, 1600]);
    return `<button class="gallery__thumb js-gallery-thumb${i === 0 ? " gallery__thumb--active" : ""}" type="button" aria-pressed="${i === 0 ? "true" : "false"}" aria-label="${esc(t(dict, "product.galleryThumbLabel", { n: i + 1 }))}" data-full="${full}" data-srcset="${ss}" data-alt="${esc(name)} — ${esc(altFor(img))}">
      <img src="${A(img.replace(/\.(jpg|png)$/i, "") + "-400.webp")}" alt="" width="400" height="400" loading="lazy">
    </button>`;
  }).join("\n");

  const swatches = PRODUCTS.map((sp) => {
    const active = sp.slug === p.slug;
    return `<a class="swatches__item${active ? " swatches__item--active" : ""}" href="${productFile(lang, sp.slug)}" title="${esc(sp.name[lang])}"${active ? ' aria-current="page"' : ""}>
      <img src="${A(sp.swatch)}" alt="${esc(sp.name[lang])}" width="44" height="44" loading="lazy">
    </a>`;
  }).join("\n");

  const related = PRODUCTS.filter((sp) => sp.slug !== p.slug);
  const rooms = [
    ["bedroom", "bed", "product.roomBedroom"],
    ["living", "sofa", "product.roomLiving"],
    ["kitchen", "pot", "product.roomKitchen"],
    ["office", "desk", "product.roomOffice"]
  ].filter(([key]) => p.specs.rooms.includes(key));

  const quoteHref = `mailto:${CFG.CONTACT.email}` +
    `?subject=${encodeURIComponent(t(dict, "product.quoteMailSubject", { name, sku: p.sku }))}` +
    `&body=${t(dict, "product.quoteMailBody", { name: encodeURIComponent(name), sku: p.sku })}`;

  return `${head(lang, { title: name + t(dict, "meta.product.titleSuffix"), description: p.shortDesc[lang], pageKey: "category", slug: p.slug })}
<body class="page page--product">
${header(lang, dict, "category", { slug: p.slug })}
<main class="page__main" id="main-content">
${breadcrumb(lang, dict, [
    { label: t(dict, "nav.wallPanels"), href: PAGES.category[lang] },
    { label: t(dict, "nav.bambooPanels"), href: PAGES.category[lang] },
    { label: name }
  ])}

  <div class="container product-page">
    <section class="gallery" aria-label="${T("product.galleryLabel")}">
      <button class="gallery__main js-gallery-main" type="button" aria-label="${T("lightbox.label")}">
        ${p.badge ? `<span class="gallery__badge">${esc(t(dict, "badge." + p.badge))}</span>` : ""}
        <img class="gallery__main-img js-gallery-img" src="${A(first)}" srcset="${srcset(first, [400, 800, 1600])}" sizes="(max-width: 992px) 96vw, 660px" alt="${esc(name)} — ${esc(altFor(first))}" width="1600" height="1600">
      </button>
      <div class="gallery__thumbs">
${thumbs}
      </div>
      ${hasInfographic ? `<p class="gallery__note">${T("product.infographicNote")}</p>` : ""}
    </section>

    <section class="pinfo">
      <h1 class="pinfo__title">${esc(name)}</h1>
      <p class="pinfo__sku">${T("product.sku")} ${esc(p.sku)}</p>
      <div class="pinfo__price-row">
        <span class="pinfo__price">${money(lang, p.price)}</span>
        ${p.oldPrice ? `<span class="pinfo__price-old">${money(lang, p.oldPrice)}</span>` : ""}
        <span class="pinfo__unit">${esc(p.unit[lang])}</span>
      </div>
      <p class="pinfo__vat">${esc(t(dict, "product.perM2", { price: perM2(lang, p) }))} · ${T("product.vat")}</p>
      <p class="pinfo__stock">${icon("check")}${T("product.inStock")}</p>
      <p class="pinfo__short">${esc(p.shortDesc[lang])}</p>

      <div class="swatches">
        <span class="swatches__label" id="swatch-label">${T("product.colorTitle")}<span class="swatches__label-value">${esc(name.split("–").pop().trim())}</span></span>
        <div class="swatches__list" role="group" aria-labelledby="swatch-label">
${swatches}
        </div>
      </div>

      <div class="buy-row">
        <div class="qty">
          <button class="qty__btn js-qty-minus" type="button" aria-label="${T("product.quantityMinus")}">−</button>
          <input class="qty__input js-qty-input" type="number" value="1" min="1" max="99" inputmode="numeric" aria-label="${T("product.quantity")}">
          <button class="qty__btn js-qty-plus" type="button" aria-label="${T("product.quantityPlus")}">+</button>
        </div>
        <button class="btn btn--accent" type="button" data-add-to-cart="${p.slug}" data-use-qty>${icon("cart")}${T("product.addToCart")}</button>
      </div>
      <p class="pinfo__quote"><a class="btn btn--ghost btn--block" href="${esc(quoteHref)}">${T("product.requestQuote")}</a></p>

      <div class="rooms">
        <h2 class="rooms__title">${T("product.roomsTitle")}</h2>
        <ul class="rooms__list">
${rooms.map(([, ic2, key]) => `          <li class="rooms__item">${icon(ic2, "icon--lg")}<span>${esc(t(dict, key))}</span></li>`).join("\n")}
        </ul>
      </div>
    </section>

    <section class="tabs">
      <div class="tabs__nav js-tabs" role="tablist" aria-label="${T("product.tabDescription")}">
        <button class="tabs__btn tabs__btn--active" type="button" role="tab" id="tab-desc" aria-controls="panel-desc" aria-selected="true">${T("product.tabDescription")}</button>
        <button class="tabs__btn" type="button" role="tab" id="tab-specs" aria-controls="panel-specs" aria-selected="false" tabindex="-1">${T("product.tabSpecs")}</button>
        <button class="tabs__btn" type="button" role="tab" id="tab-delivery" aria-controls="panel-delivery" aria-selected="false" tabindex="-1">${T("product.tabDelivery")}</button>
      </div>
      <div class="tabs__panel" id="panel-desc" role="tabpanel" aria-labelledby="tab-desc">
        <p>${esc(p.description[lang])}</p>
      </div>
      <div class="tabs__panel" id="panel-specs" role="tabpanel" aria-labelledby="tab-specs" hidden>
        <table class="spec-table">
          <tbody>
            <tr><th scope="row">${T("product.sku")}</th><td>${esc(p.sku)}</td></tr>
            <tr><th scope="row">${T("product.specFinish")}</th><td>${esc(p.specs.finish[lang])}</td></tr>
            <tr><th scope="row">${T("product.specMaterial")}</th><td>${esc(p.specs.material[lang])}</td></tr>
            <tr><th scope="row">${T("product.specDimensions")}</th><td>122 × 280 cm</td></tr>
            <tr><th scope="row">${T("product.specThickness")}</th><td>${esc(p.specs.thickness)}</td></tr>
            <tr><th scope="row">${T("product.specArea")}</th><td>${num(lang, CFG.panelArea)} m²</td></tr>
          </tbody>
        </table>
      </div>
      <div class="tabs__panel" id="panel-delivery" role="tabpanel" aria-labelledby="tab-delivery" hidden>
        <p>${T("product.deliveryText")}</p>
      </div>
    </section>
  </div>

  <section class="container related">
    <h2 class="related__title">${T("product.relatedTitle")}</h2>
    <ul class="product-grid">
${related.map((sp, i) => productCard(lang, dict, sp, i)).join("\n")}
    </ul>
  </section>

  <div class="lightbox js-lightbox" role="dialog" aria-modal="true" aria-label="${T("lightbox.label")}" hidden>
    <img class="lightbox__img js-lightbox-img" src="${A(first)}" alt="">
    <button class="lightbox__close js-lightbox-close" type="button" aria-label="${T("lightbox.close")}">${icon("x", "icon--lg")}</button>
    <button class="lightbox__nav lightbox__nav--prev js-lightbox-prev" type="button" aria-label="${T("lightbox.prev")}"><span aria-hidden="true">‹</span></button>
    <button class="lightbox__nav lightbox__nav--next js-lightbox-next" type="button" aria-label="${T("lightbox.next")}"><span aria-hidden="true">›</span></button>
  </div>

</main>
${footer(lang, dict)}
${cartDrawer(lang, dict)}
${commonFoot(lang, dict)}
</body>
</html>`;
}

function renderSoon(lang, pageKey) {
  const dict = DICTS[lang];
  const T = (k) => esc(t(dict, k));
  const titleKey = pageKey === "tiles" ? "soon.tilesTitle" : "soon.awningsTitle";
  const title = t(dict, titleKey);
  return `${head(lang, { title: title + t(dict, "meta.soon.titleSuffix"), description: t(dict, "soon.text"), pageKey })}
<body class="page page--soon">
${header(lang, dict, pageKey)}
<main class="page__main" id="main-content">
${breadcrumb(lang, dict, [{ label: title }])}
  <div class="container">
    <div class="soon">
      <span class="soon__icon">${icon(pageKey === "tiles" ? "panel" : "shield", "icon--xl")}</span>
      <p class="soon__badge">${T("soon.title")}</p>
      <h1>${esc(title)}</h1>
      <p class="soon__text">${T("soon.text")}</p>
      <div class="soon__actions">
        <a class="btn btn--primary" href="${PAGES.home[lang]}">${T("soon.backHome")}</a>
        <a class="btn btn--ghost" href="${PAGES.contact[lang]}">${T("soon.contactCta")}</a>
      </div>
    </div>
  </div>
</main>
${footer(lang, dict)}
${cartDrawer(lang, dict)}
${commonFoot(lang, dict)}
</body>
</html>`;
}

function renderContact(lang) {
  const dict = DICTS[lang];
  const T = (k) => esc(t(dict, k));
  const address = lang === "tr" ? CFG.CONTACT.addressTr : CFG.CONTACT.address;
  return `${head(lang, { title: t(dict, "meta.contact.title"), description: t(dict, "meta.contact.description"), pageKey: "contact" })}
<body class="page page--contact">
${header(lang, dict, "contact")}
<main class="page__main" id="main-content">
${breadcrumb(lang, dict, [{ label: t(dict, "contact.h1") }])}
  <div class="container page-head">
    <h1>${T("contact.h1")}</h1>
    <p class="page-head__desc">${T("contact.intro")}</p>
  </div>
  <div class="container contact-layout">
    <form class="contact-form js-contact-form" data-email="${esc(CFG.CONTACT.email)}">
      <h2>${T("contact.formTitle")}</h2>
      <div class="contact-form__row">
        <label class="contact-form__label" for="cf-name">${T("contact.formName")}</label>
        <input class="contact-form__input" id="cf-name" name="name" type="text" required autocomplete="name">
      </div>
      <div class="contact-form__row">
        <label class="contact-form__label" for="cf-email">${T("contact.formEmail")}</label>
        <input class="contact-form__input" id="cf-email" name="email" type="email" required autocomplete="email">
      </div>
      <div class="contact-form__row">
        <label class="contact-form__label" for="cf-subject">${T("contact.formSubject")}</label>
        <input class="contact-form__input" id="cf-subject" name="subject" type="text" required>
      </div>
      <div class="contact-form__row">
        <label class="contact-form__label" for="cf-message">${T("contact.formMessage")}</label>
        <textarea class="contact-form__textarea" id="cf-message" name="message" required></textarea>
      </div>
      <button class="btn btn--accent" type="submit">${T("contact.formSend")}</button>
      <p class="contact-form__note">${T("contact.formNote")}</p>
    </form>
    <aside class="contact-info" aria-label="${T("contact.infoTitle")}">
      <h2 class="contact-info__title">${T("contact.infoTitle")}</h2>
      <p>${icon("pin")}<span>${esc(address)}</span></p>
      <p>${icon("phone")}<a href="tel:${CFG.CONTACT.phone.replace(/\s/g, "")}">${phoneHtml()}</a></p>
      <p>${icon("mail")}<a href="mailto:${esc(CFG.CONTACT.email)}">${esc(CFG.CONTACT.email)}</a></p>
      <p>${icon("clock")}<span>${esc(CFG.CONTACT.hours[lang])}</span></p>
    </aside>
  </div>
</main>
${footer(lang, dict)}
${cartDrawer(lang, dict)}
${commonFoot(lang, dict)}
</body>
</html>`;
}

function renderRootRedirect() {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GIR Décor — Redirection</title>
<meta name="robots" content="noindex">
<link rel="icon" type="image/svg+xml" href="assets/img/logo/gir-decor-mark.svg">
<link rel="alternate" hreflang="fr" href="fr/index.html">
<link rel="alternate" hreflang="tr" href="tr/index.html">
<meta http-equiv="refresh" content="0; url=fr/index.html">
<script>
(function () {
  var lang = (navigator.language || "fr").toLowerCase().indexOf("tr") === 0 ? "tr" : "fr";
  window.location.replace(lang + "/index.html");
})();
</script>
</head>
<body>
<p><a href="fr/index.html">Français</a> · <a href="tr/index.html">Türkçe</a></p>
</body>
</html>`;
}

/* ---------- yaz ---------- */
const out = [];
function write(rel, html) {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html.split("\n").map((l) => l.replace(/[ \t]+$/, "")).join("\n"));
  out.push(rel);
}

for (const lang of ["fr", "tr"]) {
  write(`${lang}/${PAGES.home[lang]}`, renderHome(lang));
  write(`${lang}/${PAGES.category[lang]}`, renderCategory(lang));
  write(`${lang}/${PAGES.tiles[lang]}`, renderSoon(lang, "tiles"));
  write(`${lang}/${PAGES.awnings[lang]}`, renderSoon(lang, "awnings"));
  write(`${lang}/${PAGES.contact[lang]}`, renderContact(lang));
  for (const p of PRODUCTS) {
    write(`${lang}/${productFile(lang, p.slug)}`, renderProduct(lang, p));
  }
}
write("index.html", renderRootRedirect());

/* ---------- dist/ — yayın (deploy) klasörü ----------
   Netlify/statik hosting için yalnızca çalışma zamanı dosyaları:
   sayfalar + css + js + assets. (data/, tools/, analysis/ build-time.) */
const DIST = path.join(ROOT, "dist");
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
for (const entry of ["index.html", "fr", "tr", "css", "js", "assets"]) {
  fs.cpSync(path.join(ROOT, entry), path.join(DIST, entry), { recursive: true });
}

console.log(`build tamam: ${out.length} sayfa + dist/ yayın klasörü`);
out.forEach((f) => console.log("  " + f));
