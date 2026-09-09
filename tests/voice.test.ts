import { test } from "node:test";
import assert from "node:assert/strict";

test("matchItem resolves a confident product and flags multi-size products as ambiguous", async () => {
  const { matchItem } = await import("../src/server/voice/order");
  const ok = matchItem({ query: "tabasco 350ml", quantity: 5, unit: "koli" });
  assert.ok(ok.product, "tabasco resolved");
  assert.equal(ok.alternatives.length, 0);
  const amb = matchItem({ query: "mayonez", quantity: 5, unit: "koli" });
  assert.equal(amb.product, undefined);
  assert.ok(amb.alternatives.length >= 2, "mayonnaise offers alternatives");
});

test("itemsFromTranscript falls back to the rule-based parser without an LLM", async () => {
  const { itemsFromTranscript } = await import("../src/server/voice/order");
  const r = await itemsFromTranscript("Bana 5 koli tabasco 350ml ve 2 adet pauwels samurai 3 liter yaz", false);
  assert.equal(r.yedek, true);
  assert.equal(r.lang, "tr");
  assert.equal(r.items.length, 2);
  assert.deepEqual(r.items[0], { query: "tabasco 350ml", quantity: 5, unit: "koli" });
  assert.equal(r.items[1].quantity, 2);
  assert.equal(r.items[1].unit, "adet");
  const nl = await itemsFromTranscript("twee dozen tabasco 350ml graag", false);
  assert.equal(nl.lang, "nl");
});

test("buildResult adds matched lines, lists missing ones and totals only with prices", async () => {
  const { buildResult, summaryText } = await import("../src/server/voice/order");
  const items = [
    { query: "tabasco 350ml", quantity: 5, unit: "koli" as const },
    { query: "mayonez", quantity: 1, unit: "koli" as const },
    { query: "uzay mekiği", quantity: 1, unit: "adet" as const },
  ];
  const noPrice = buildResult("bana 5 koli tabasco 350ml yaz", items, "tr", null, false);
  assert.equal(noPrice.eklenenler.length, 1);
  assert.equal(noPrice.eklenenler[0].koli, 5);
  assert.equal(noPrice.eklenenler[0].birimFiyat, null);
  assert.equal(noPrice.toplamTutar, null);
  assert.equal(noPrice.secenekler.length, 1, "mayonnaise becomes a variant choice");
  assert.equal(noPrice.secenekler[0].koli, 1);
  assert.ok(noPrice.secenekler[0].adaylar.length >= 3);
  assert.deepEqual(noPrice.bulunamayanlar, ["uzay mekiği"]);
  assert.match(summaryText(noPrice), /Sepete ekledim: 5 koli .*Tabasco/);
  const id = noPrice.eklenenler[0].id;
  const priced = buildResult("x", items, "nl", { [id]: 2.5 }, false);
  assert.equal(priced.eklenenler[0].birimFiyat, 2.5);
  assert.ok((priced.toplamTutar ?? 0) > 0, "total computed from case size");
  assert.match(summaryText(priced), /Toegevoegd/);
});

test("processOrderAudio runs Whisper → GPT-4o-mini → matcher with a clean Bearer token", async () => {
  process.env.OPENAI_API_KEY = 'curl https://api.openai.com/v1/audio/speech -H "Authorization: Bearer sk-proj-TESTKEY0123456789abcdefghij"';
  const seen: { url: string; auth: string | null; body?: unknown }[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    seen.push({ url, auth: headers.get("authorization") });
    if (url.includes("transcriptions")) return new Response(JSON.stringify({ text: "bana beş koli tabasco 350 ml yaz abi" }), { status: 200, headers: { "Content-Type": "application/json" } });
    if (url.includes("chat/completions")) {
      const body = JSON.parse(String(init?.body)) as { model: string; response_format: { type: string } };
      assert.equal(body.model, "gpt-4o-mini");
      assert.equal(body.response_format.type, "json_schema");
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ language: "tr", items: [{ query: "tabasco 350ml", quantity: 5, unit: "koli" }] }) } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response("nope", { status: 500 });
  }) as typeof fetch;
  try {
    const { processOrderAudio } = await import("../src/server/voice/order");
    const r = await processOrderAudio(new Blob([new Uint8Array(3000)], { type: "audio/webm" }), "order.webm", "tr", null);
    assert.equal(r.transkript, "bana beş koli tabasco 350 ml yaz abi");
    assert.equal(r.yedek, false);
    assert.equal(r.eklenenler.length, 1);
    assert.equal(r.eklenenler[0].koli, 5);
    assert.equal(seen.length, 2);
    for (const s of seen) assert.equal(s.auth, "Bearer sk-proj-TESTKEY0123456789abcdefghij");
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.OPENAI_API_KEY;
  }
});

test("processOrderAudio survives an LLM failure via the rule-based fallback", async () => {
  process.env.OPENAI_API_KEY = "sk-TESTKEY0123456789abcdefghijklmnop";
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("transcriptions")) return new Response(JSON.stringify({ text: "3 koli tabasco 350ml" }), { status: 200, headers: { "Content-Type": "application/json" } });
    return new Response("rate limited", { status: 429 });
  }) as typeof fetch;
  try {
    const { processOrderAudio } = await import("../src/server/voice/order");
    const r = await processOrderAudio(new Blob([new Uint8Array(3000)], { type: "audio/webm" }), "order.webm", undefined, null);
    assert.equal(r.yedek, true);
    assert.equal(r.eklenenler.length, 1);
    assert.equal(r.eklenenler[0].koli, 3);
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.OPENAI_API_KEY;
  }
});

test("cleanApiKey extracts the token from a pasted curl example and redactSecrets masks it", async () => {
  const { cleanApiKey, redactSecrets } = await import("../src/server/voice/secrets");
  const pasted = `curl https://api.openai.com/v1/audio/speech \\\n  -H "Authorization: Bearer sk-proj-ABCdef123456789012345678_-xyz" \\\n  -H "Content-Type: application/json"`;
  assert.equal(cleanApiKey(pasted), "sk-proj-ABCdef123456789012345678_-xyz");
  assert.equal(cleanApiKey("  sk-abcdefghijklmnopqrstuvwxyz1234 \n"), "sk-abcdefghijklmnopqrstuvwxyz1234");
  assert.equal(cleanApiKey('"Bearer other-provider-token-ABCDEFGH"'), "other-provider-token-ABCDEFGH");
  assert.equal(cleanApiKey(""), undefined);
  assert.equal(cleanApiKey("curl https://example.com"), undefined);
  const msg = redactSecrets('Headers.append: "Bearer sk-proj-ABCdef123456789012345678_-xyz" is an invalid header value; Authorization: Bearer abc', "other-provider-token-ABCDEFGH");
  assert.ok(!msg.includes("sk-proj-ABCdef"), msg);
  assert.ok(!/Bearer abc/.test(msg), msg);
});

test("matcher keeps variants within the product family and uses size hints", async () => {
  const { matchItem } = await import("../src/server/voice/order");
  const ayran = matchItem({ query: "ayran 25'lik", quantity: 2, unit: "koli" });
  assert.ok(ayran.product, "25'lik resolves to the 25 cl ayran");
  assert.equal(ayran.product!.unitSize, "25 cl");
  const doner = matchItem({ query: "tavuk döner", quantity: 1, unit: "koli" });
  assert.equal(doner.product, undefined);
  assert.ok(doner.alternatives.length >= 3 && doner.alternatives.every((p) => p.category === "et-urunleri"), "only döner variants offered");
  const onluk = matchItem({ query: "onluk tavuk döner", quantity: 1, unit: "koli" });
  const onlukSizes = onluk.product ? [onluk.product.unitSize] : onluk.alternatives.map((p) => p.unitSize);
  assert.ok(onlukSizes.length > 0 && onlukSizes.every((u) => u === "10 kg"), `onluk → only 10 kg variants (${onlukSizes.join(",")})`);
  const ku = matchItem({ query: "mirîşk", quantity: 1, unit: "koli" });
  assert.ok(ku.alternatives.length > 0 && /Tavuk/.test(ku.alternatives[0].name), "Kurdish mirîşk → tavuk products");
  const rice = matchItem({ query: "pirinç", quantity: 1, unit: "koli" });
  assert.ok(rice.alternatives.length >= 3 && rice.alternatives.every((p) => /pirin/i.test(p.name)), "generic rice lists rice variants only");
});
