import assert from "node:assert/strict";
import test from "node:test";
import { fleet } from "@/data/fleet";
import { locations } from "@/data/locations";
import { defaultLocale, locales } from "@/i18n/config";
import tr from "@/i18n/dictionaries/tr.json";
import { deepMerge, getDictionary } from "@/i18n/getDictionary";
import { resolveKey } from "@/i18n/utils";

/** U+2014 uzun tire; dosyada düz metin olarak geçmesin diye kod noktasından kurulur. */
const EM_DASH = String.fromCodePoint(0x2014);

/** Sözlük ağacındaki her yaprağı `path` bilgisiyle dolaşır. */
function forEachLeaf(value: unknown, path: string, visit: (path: string, leaf: unknown) => void): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => forEachLeaf(item, `${path}[${index}]`, visit));
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      forEachLeaf(child, path ? `${path}.${key}` : key, visit);
    }
    return;
  }
  visit(path, value);
}

/** İki ağacı birlikte dolaşır; her yaprak aynı olmalı. */
function assertSameLeaves(expected: unknown, actual: unknown, path: string): void {
  if (Array.isArray(expected)) {
    assert.ok(Array.isArray(actual), `${path} dizi olmalı`);
    assert.equal(actual.length, expected.length, `${path} dizi uzunluğu farklı`);
    expected.forEach((item, index) => assertSameLeaves(item, actual[index], `${path}[${index}]`));
    return;
  }
  if (expected !== null && typeof expected === "object") {
    assert.ok(actual !== null && typeof actual === "object", `${path} nesne olmalı`);
    const target = actual as Record<string, unknown>;
    for (const [key, child] of Object.entries(expected)) {
      const next = path ? `${path}.${key}` : key;
      assert.ok(key in target, `${next} anahtarı eksik`);
      assertSameLeaves(child, target[key], next);
    }
    return;
  }
  assert.equal(actual, expected, `${path} değeri farklı`);
}

test("deepMerge boş bir ezmeyle tüm Türkçe değerleri korur", () => {
  const merged = deepMerge(tr, {});
  assertSameLeaves(tr, merged, "");
  assert.deepEqual(merged, tr);

  let leafCount = 0;
  forEachLeaf(tr, "", () => {
    leafCount += 1;
  });
  assert.ok(leafCount > 100, `sözlük beklenenden küçük: ${leafCount} yaprak`);
});

test("kısmi iç içe ezme yalnızca kendi yapraklarını değiştirir", () => {
  const merged = deepMerge(tr, { hero: { title: "Trusted transfer partner" } });

  assert.equal(merged.hero.title, "Trusted transfer partner");
  assert.equal(merged.hero.subtitle, tr.hero.subtitle);
  assert.equal(merged.hero.eyebrow, tr.hero.eyebrow);
  assert.deepEqual(merged.hero.trust, tr.hero.trust);
  assert.deepEqual(merged.widget, tr.widget);
  assert.deepEqual(merged.validation, tr.validation);
  // Kaynak sözlük değişmemeli.
  assert.notEqual(tr.hero.title, "Trusted transfer partner");
});

test("diziler birleştirilmez, bütün olarak değiştirilir", () => {
  const merged = deepMerge(tr, { faq: { items: [{ question: "Q", answer: "A" }] } });

  assert.equal(merged.faq.items.length, 1, "SSS listesi Türkçe listeyle karışmış");
  assert.deepEqual(merged.faq.items, [{ question: "Q", answer: "A" }]);
  assert.ok(tr.faq.items.length > 1, "test verisi için Türkçe SSS listesi çok kısa");
  assert.equal(merged.faq.title, tr.faq.title);

  const numbers = deepMerge({ items: [1, 2, 3] }, { items: [9] });
  assert.deepEqual(numbers.items, [9]);
});

test('getDictionary("en") her anahtarda Türkçe değere düşer', async () => {
  const en = await getDictionary("en");
  assertSameLeaves(tr, en, "");
});

test("tr.json içinde hiçbir metinde uzun tire yok", () => {
  const offenders: string[] = [];
  forEachLeaf(tr, "", (path, leaf) => {
    if (typeof leaf === "string" && leaf.includes(EM_DASH)) offenders.push(path);
  });
  assert.deepEqual(offenders, [], `uzun tire içeren anahtarlar: ${offenders.join(", ")}`);
});

test("diller tam olarak tr, en, fr ve varsayılan tr", () => {
  assert.deepEqual(locales, ["tr", "en", "fr"]);
  assert.equal(defaultLocale, "tr");
});

test("her konumun tr.json içinde bir adı var", () => {
  const names: Record<string, unknown> = tr.locations;
  const missing = locations.filter((location) => typeof names[location.id] !== "string");
  assert.deepEqual(
    missing.map((location) => location.id),
    [],
    "tr.json locations altında karşılığı olmayan konumlar var",
  );

  for (const location of locations) {
    assert.equal(location.name, `locations.${location.id}`, `${location.id} adı anahtar biçiminde değil`);
    const resolved = resolveKey(tr, location.name);
    assert.notEqual(resolved, location.name, `${location.id} adı çözülemedi`);
    assert.ok(resolved.length > 0, `${location.id} adı boş`);
  }

  // Sözlükte fazladan konum kalmamalı (silinen konumların artıkları).
  const ids = new Set(locations.map((location) => location.id));
  const extra = Object.keys(tr.locations).filter((key) => !ids.has(key));
  assert.deepEqual(extra, [], "tr.json içinde karşılığı olmayan konum adları var");
});

test("her aracın adı, modeli ve açıklaması sözlükte çözülür", () => {
  for (const vehicle of fleet) {
    for (const key of [vehicle.name, vehicle.model, vehicle.description]) {
      const resolved = resolveKey(tr, key);
      assert.notEqual(resolved, key, `${key} anahtarı sözlükte yok`);
      assert.ok(resolved.trim().length > 0, `${key} karşılığı boş`);
    }
    for (const feature of vehicle.features) {
      assert.notEqual(resolveKey(tr, feature), feature, `${feature} anahtarı sözlükte yok`);
    }
  }
});
