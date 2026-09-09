import { test } from "node:test";
import assert from "node:assert/strict";
import { parseOrderText, resolveOrder, searchProducts, normalize } from "../src/server/whatsapp/matcher";

test("normalize handles Turkish characters", () => {
  assert.equal(normalize("Şişe Kıyma Döner"), "sise kiyma doner");
});

test("parseOrderText splits lines and reads quantities", () => {
  const lines = parseOrderText("5 koli kip doner 20kg, 2 kutu samurai 3 liter\n10 adet pizzadoos 30x30");
  assert.equal(lines.length, 3);
  assert.deepEqual(lines.map((l) => [l.quantity, l.unit]), [[5, "koli"], [2, "koli"], [10, "adet"]]);
  assert.equal(lines[0].sizeHint, "20kg");
});

test("searchProducts finds döner by Turkish and Dutch words with size", () => {
  const tr = searchProducts("maximus tavuk döner 20kg")[0];
  assert.ok(tr, "no result");
  assert.match(tr.product.nameNl, /Kip Doner - 20kg/i);
  const nl = searchProducts("kip doner 20kg maximus")[0];
  assert.equal(nl.product.id, tr.product.id);
});

test("searchProducts matches sauces with size", () => {
  const hit = searchProducts("samurai 3 liter")[0];
  assert.match(hit.product.nameNl, /Samurai/);
  assert.match(hit.product.nameNl, /3 liter/);
});

test("resolveOrder flags ambiguous lines", () => {
  const res = resolveOrder("2 koli kip doner");
  assert.equal(res.length, 1);
  assert.ok(res[0].best);
  assert.equal(res[0].confident, false, "many döner sizes must not be auto-confirmed");
  assert.ok(res[0].alternatives.length >= 2);
});

test("resolveOrder is confident for unique products", () => {
  const res = resolveOrder("1 koli tabasco 350ml");
  assert.ok(res[0].best);
  assert.match(res[0].best!.product.nameNl, /Tabasco/);
  assert.equal(res[0].confident, true);
});
