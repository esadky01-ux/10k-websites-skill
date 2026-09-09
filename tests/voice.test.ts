import { test } from "node:test";
import assert from "node:assert/strict";

delete process.env.ANTHROPIC_API_KEY;

const load = async () => ({ ...(await import("../src/server/voice/agent")), ...(await import("../src/server/voice/prompt")) });

test("greeting is the friendly salesman line", async () => {
  const { GREETINGS } = await load();
  assert.equal(GREETINGS.tr, "Selamünaleyküm abi, hayırlı işler! Nasıl gidiyor dükkân?");
});

test("fallback adds a confident product to the cart and confirms in Turkish", async () => {
  const { fallbackVoiceTurn } = await load();
  const r = fallbackVoiceTurn({ transcript: "Bana 5 koli tabasco 350ml yaz", lang: "nl", history: [], cart: [] });
  assert.equal(r.lang, "tr");
  assert.equal(r.actions.length, 1);
  assert.equal(r.actions[0].type, "add");
  assert.equal((r.actions[0] as { cases: number }).cases, 5);
  assert.match(r.text, /Ekledim abi, başka ne lazım\?/);
});

test("fallback asks which size when the product has several formats", async () => {
  const { fallbackVoiceTurn } = await load();
  const r = fallbackVoiceTurn({ transcript: "Bana 5 koli mayonez yaz", lang: "tr", history: [], cart: [] });
  assert.equal(r.actions.length, 0);
  assert.match(r.text, /Hangisi abi/);
  assert.match(r.text, /Mayonez/);
  const d = fallbackVoiceTurn({ transcript: "3 kutu dana döner ekle", lang: "tr", history: [], cart: [] });
  assert.match(d.text, /Hangisi abi|bulamadım/);
});

test("fallback switches to Dutch and Kurdish", async () => {
  const { fallbackVoiceTurn, detectVoiceLang } = await load();
  const nl = fallbackVoiceTurn({ transcript: "twee dozen tabasco 350ml graag", lang: "tr", history: [], cart: [] });
  assert.equal(nl.lang, "nl");
  assert.match(nl.text, /Staat erop baas/);
  assert.equal(detectVoiceLang("silav bira, ez dixwazim 2 qutî tabasco", "tr"), "ku");
  const ku = fallbackVoiceTurn({ transcript: "spas bira", lang: "tr", history: [], cart: [] });
  assert.equal(ku.lang, "ku");
});

test("fallback removes from cart and opens the cart", async () => {
  const { fallbackVoiceTurn, applyActions } = await load();
  const cart = applyActions([], [{ type: "add", productId: "fd-szn-016", cases: 2, units: 0 }]);
  const rm = fallbackVoiceTurn({ transcript: "mayonezi sepetten çıkar", lang: "tr", history: [], cart });
  assert.deepEqual(rm.actions, [{ type: "remove", productId: "fd-szn-016" }]);
  const op = fallbackVoiceTurn({ transcript: "sepeti aç", lang: "tr", history: [], cart });
  assert.deepEqual(op.actions, [{ type: "open_cart" }]);
});
