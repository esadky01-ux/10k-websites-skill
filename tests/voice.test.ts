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
  assert.equal(redactSecrets("token other-provider-token-ABCDEFGH leaked", "other-provider-token-ABCDEFGH"), "token *** leaked");
});

test("TTS and STT send only the clean token as Bearer even when the env holds a pasted curl example", async () => {
  process.env.OPENAI_API_KEY = 'curl https://api.openai.com/v1/audio/speech -H "Authorization: Bearer sk-proj-TESTKEY0123456789abcdefghij" -d @body.json';
  process.env.VOICE_API_KEY = "Bearer sk-VOICEKEY0123456789abcdefghijk\n";
  process.env.VOICE_TTS_URL = "https://tts.example.test/speech";
  process.env.VOICE_STT_URL = "https://stt.example.test/transcriptions";
  const seen: { url: string; auth: string | null }[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    seen.push({ url: String(input), auth: headers.get("authorization") });
    if (String(input).includes("speech")) return new Response(new Uint8Array(512), { status: 200, headers: { "Content-Type": "audio/mpeg" } });
    return new Response(JSON.stringify({ text: "beş koli tabasco" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  try {
    const { synthesizeSpeech, transcribeAudio, ttsConfigured, sttConfigured } = await import("../src/server/voice/realtime");
    assert.equal(ttsConfigured(), true);
    assert.equal(sttConfigured(), true);
    const audio = await synthesizeSpeech("merhaba abi " + Date.now());
    assert.equal(audio.length, 512);
    const text = await transcribeAudio(new Blob([new Uint8Array(2000)], { type: "audio/webm" }), "voice.webm", "tr");
    assert.equal(text, "beş koli tabasco");
    assert.equal(seen[0].auth, "Bearer sk-proj-TESTKEY0123456789abcdefghij");
    assert.equal(seen[1].auth, "Bearer sk-VOICEKEY0123456789abcdefghijk");
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.OPENAI_API_KEY;
    delete process.env.VOICE_API_KEY;
    delete process.env.VOICE_TTS_URL;
    delete process.env.VOICE_STT_URL;
  }
});
