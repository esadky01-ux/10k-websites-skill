import { test } from "node:test";
import assert from "node:assert/strict";
import { localePath, folderForSlug } from "../src/i18n/config";
import { nl } from "../src/i18n/nl";
import { tr } from "../src/i18n/tr";
import { altPathFor } from "../src/components/LangSwitch";
import { buildWhatsAppMessage } from "../src/lib/whatsapp";
import { regions } from "../src/data/regions";
import { postsNl } from "../src/data/posts.nl";
import { posts } from "../src/data/posts";

function keys(o: unknown, prefix = ""): string[] {
  if (Array.isArray(o) || typeof o !== "object" || o === null) return [prefix];
  return Object.entries(o).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

test("Turkish dictionary has exactly the Dutch keys", () => {
  assert.deepEqual(keys(tr).sort(), keys(nl).sort());
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

test("altPathFor switches languages and keeps route", () => {
  assert.equal(altPathFor("/bestellen", "nl"), "/tr/siparis");
  assert.equal(altPathFor("/tr/siparis", "tr"), "/bestellen");
  assert.equal(altPathFor("/regio/leuven", "nl"), "/tr/bolgeler/leuven");
  assert.equal(altPathFor("/tr", "tr"), "/");
  assert.equal(altPathFor("/", "nl"), "/tr");
  assert.equal(altPathFor("/blog/some-post", "nl"), "/tr/blog");
});

test("WhatsApp receipt is localized", () => {
  const nlMsg = buildWhatsAppMessage({ lines: [{ productId: "fd-drk-023", cases: 2, units: 0 }], delivery: "depo", lang: "nl" });
  assert.match(nlMsg, /Bestelbon/);
  assert.match(nlMsg, /Afhaling in magazijn/);
  const trMsg = buildWhatsAppMessage({ lines: [{ productId: "fd-drk-023", cases: 2, units: 0 }], delivery: "adres", lang: "tr", prices: { "fd-drk-023": 8.49 } });
  assert.match(trMsg, /Sipariş Fişi/);
  assert.match(trMsg, /Tahmini/);
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
