import { test } from "node:test";
import assert from "node:assert/strict";
import { contentLocale, folderForSlug, localeFlag, localeNames, localeShort, locales, localePath, routeSlugs } from "../src/i18n/config";
import { nl } from "../src/i18n/nl";
import { tr } from "../src/i18n/tr";
import { fr } from "../src/i18n/fr";
import { en } from "../src/i18n/en";
import { altPathFor } from "../src/components/LangSwitch";
import { buildWhatsAppMessage } from "../src/lib/whatsapp";
import { regions } from "../src/data/regions";
import { postsNl } from "../src/data/posts.nl";
import { posts } from "../src/data/posts";

function keys(o: unknown, prefix = ""): string[] {
  if (Array.isArray(o) || typeof o !== "object" || o === null) return [prefix];
  return Object.entries(o).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

test("every dictionary has exactly the Dutch keys", () => {
  const base = keys(nl).sort();
  for (const [name, d] of Object.entries({ tr, fr, en })) {
    assert.deepEqual(keys(d).sort(), base, `${name} dictionary keys`);
  }
});

test("every interface language is fully declared and has a dictionary", () => {
  assert.deepEqual([...locales], ["nl", "fr", "en", "tr"]);
  for (const l of locales) {
    assert.ok(localeNames[l], `${l} name`);
    assert.ok(localeShort[l], `${l} short code`);
    assert.match(localeFlag[l], /^[\u{1F1E6}-\u{1F1FF}]{2}$/u, `${l} flag is a regional-indicator pair`);
    assert.ok(["nl", "tr"].includes(contentLocale[l]), `${l} content locale`);
    for (const key of Object.keys(routeSlugs) as (keyof typeof routeSlugs)[]) {
      assert.match(routeSlugs[key][l], /^[a-z0-9-]+$/, `${l} ${key} slug`);
    }
  }
});

test("the site interface is Latin-script only; Kurdish and Arabic live in the voice assistant", async () => {
  const nonLatin = /[\u0600-\u06FF\u0400-\u04FF]/;
  for (const [name, d] of Object.entries({ nl, tr, fr, en })) {
    for (const path of keys(d)) {
      const value = path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], d);
      if (typeof value === "string") assert.ok(!nonLatin.test(value), `${name}.${path} has non-Latin script`);
    }
  }
  const { liveInstructions } = await import("../src/server/voice/live");
  const prompt = liveInstructions("nl");
  assert.match(prompt, /Kürtçe/, "live assistant still speaks Kurdish");
  assert.match(prompt, /Arapça/, "live assistant still speaks Arabic");
});

test("localePath builds Dutch root and Turkish prefixed URLs", () => {
  assert.equal(localePath("nl"), "/");
  assert.equal(localePath("nl", "order"), "/bestellen");
  assert.equal(localePath("tr", "order"), "/tr/siparis");
  assert.equal(localePath("tr", "regions", "leuven"), "/tr/bolgeler/leuven");
  assert.equal(localePath("nl", "order", undefined, "categorie=soslar"), "/bestellen?categorie=soslar");
  assert.equal(folderForSlug("tr", "siparis"), "bestellen");
  assert.equal(folderForSlug("tr", "hesap"), "account");
});

test("altPathFor switches between any two languages and keeps the route", () => {
  assert.equal(altPathFor("/bestellen", "nl", "tr"), "/tr/siparis");
  assert.equal(altPathFor("/bestellen", "nl", "fr"), "/fr/commander");
  assert.equal(altPathFor("/fr/commander", "fr", "en"), "/en/order");
  assert.equal(altPathFor("/tr/siparis", "tr", "nl"), "/bestellen");
  assert.equal(altPathFor("/regio/leuven", "nl", "tr"), "/tr/bolgeler/leuven");
  assert.equal(altPathFor("/en/regions/leuven", "en", "fr"), "/fr/zones/leuven");
  assert.equal(altPathFor("/tr", "tr", "nl"), "/");
  assert.equal(altPathFor("/", "nl", "fr"), "/fr");
  assert.equal(altPathFor("/blog/some-post", "nl", "tr"), "/tr/blog");
  assert.equal(altPathFor("/en/login", "en", "en"), "/en/login");
});

test("localePath and folderForSlug round-trip for every language and route", () => {
  for (const l of locales) {
    for (const key of Object.keys(routeSlugs) as (keyof typeof routeSlugs)[]) {
      assert.equal(folderForSlug(l, routeSlugs[key][l]), routeSlugs[key].nl, `${l}/${key}`);
    }
  }
  assert.equal(localePath("fr", "order"), "/fr/commander");
  assert.equal(localePath("tr", "regions", "leuven"), "/tr/bolgeler/leuven");
  assert.equal(localePath("en", "account"), "/en/account");
});

test("WhatsApp receipt is localized", () => {
  const nlMsg = buildWhatsAppMessage({ lines: [{ productId: "fd-drk-023", cases: 2, units: 0 }], delivery: "depo", lang: "nl" });
  assert.match(nlMsg, /Bestelbon/);
  assert.match(nlMsg, /Afhaling in magazijn/);
  const trMsg = buildWhatsAppMessage({ lines: [{ productId: "fd-drk-023", cases: 2, units: 0 }], delivery: "adres", lang: "tr", prices: { "fd-drk-023": 8.49 } });
  assert.match(trMsg, /Sipariş Fişi/);
  assert.match(trMsg, /Tahmini/);
});

test("WhatsApp receipt stays in a language the warehouse reads", () => {
  // Fiş depoya gider: Fransızca/İngilizce/Arapça arayüzden verilen sipariş de Hollandaca düşer
  for (const lang of ["fr", "en"] as const) {
    const msg = buildWhatsAppMessage({ lines: [{ productId: "fd-drk-023", cases: 1, units: 0 }], delivery: "depo", lang });
    assert.match(msg, /Bestelbon/, `${lang} receipt is Dutch`);
  }
});

test("regions data is complete and unique", () => {
  assert.ok(regions.length >= 20);
  const slugs = new Set(regions.map((r) => r.slug));
  assert.equal(slugs.size, regions.length);
  for (const r of regions) {
    assert.match(r.slug, /^[a-z0-9-]+$/);
    assert.ok(r.nl.metaTitle.length >= 30 && r.nl.metaTitle.length <= 70, `${r.slug} nl metaTitle length ${r.nl.metaTitle.length}`);
    assert.ok(r.nl.metaDescription.length >= 100 && r.nl.metaDescription.length <= 170, `${r.slug} nl metaDescription length`);
    assert.ok(r.nl.faq.length >= 3);
    assert.ok(r.tr.faq.length >= 3);
    assert.ok(r.deliveryDays.length >= 1);
    assert.ok(r.lat > 49 && r.lat < 52 && r.lng > 2 && r.lng < 7, `${r.slug} coords`);
  }
  const intros = new Set(regions.map((r) => r.nl.intro.slice(0, 80)));
  assert.equal(intros.size, regions.length, "intros must be unique");
});

test("blog posts exist in both languages in the same order", () => {
  assert.equal(postsNl.length, posts.length);
  for (const p of postsNl) assert.match(p.slug, /^[a-z0-9-]+$/);
});
