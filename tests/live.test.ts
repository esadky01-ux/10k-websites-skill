import { test } from "node:test";
import assert from "node:assert/strict";

test("createLiveSession posts the SDP offer to /v1/live/sessions with delegation tools and a clean Bearer", async () => {
  process.env.OPENAI_API_KEY = 'curl -H "Authorization: Bearer sk-proj-LIVEKEY0123456789abcdefghij" https://api.openai.com/v1/live/sessions';
  const seen: { url: string; auth: string | null; body: Record<string, unknown> }[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.push({ url: String(input), auth: new Headers(init?.headers).get("authorization"), body: JSON.parse(String(init?.body)) as Record<string, unknown> });
    return new Response(JSON.stringify({ session: { id: "sess_123" }, transport: { type: "webrtc", sdp: "v=0\r\nanswer" } }), { status: 201, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  try {
    const { createLiveSession, liveConfigured } = await import("../src/server/voice/live");
    assert.equal(liveConfigured(), true);
    const s = await createLiveSession("v=0\r\no=- 1 1 IN IP4 0.0.0.0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111", "tr");
    assert.equal(s.id, "sess_123");
    assert.equal(s.sdp, "v=0\r\nanswer");
    assert.equal(s.model, "gpt-live-1");
    assert.equal(seen.length, 1);
    assert.equal(seen[0].url, "https://api.openai.com/v1/live/sessions");
    assert.equal(seen[0].auth, "Bearer sk-proj-LIVEKEY0123456789abcdefghij");
    const body = seen[0].body as { session: { model: string; instructions: string; delegation: { type: string; responses: { model: string; tools: { name: string }[]; tool_choice: string } } }; transport: { type: string; sdp: string } };
    assert.equal(body.session.model, "gpt-live-1");
    assert.equal(body.transport.type, "webrtc");
    assert.equal(body.transport.sdp, "v=0\r\no=- 1 1 IN IP4 0.0.0.0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n", "every line CRLF-terminated, including the last");
    assert.equal(body.session.delegation.type, "responses");
    assert.equal(body.session.delegation.responses.tool_choice, "auto");
    assert.deepEqual(body.session.delegation.responses.tools.map((t) => t.name), ["search_catalog", "add_to_cart", "show_cart", "open_cart"]);
    assert.match(body.session.instructions, /Maximus Food Dijital Plasiyeri/);
    assert.match(body.session.instructions, /mirîşk/);
    assert.match(body.session.instructions, /Selamünaleyküm/);
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.OPENAI_API_KEY;
  }
});

test("createLiveSession surfaces upstream failures without leaking the key", async () => {
  process.env.OPENAI_API_KEY = "sk-proj-LIVEKEY0123456789abcdefghij";
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response("invalid_api_key sk-proj-LIVEKEY0123456789abcdefghij", { status: 401 })) as typeof fetch;
  try {
    const { createLiveSession } = await import("../src/server/voice/live");
    await assert.rejects(createLiveSession("v=0", "nl"), (err: { status: number; detail: string }) => {
      assert.equal(err.status, 401);
      assert.doesNotMatch(err.detail, /LIVEKEY/);
      return true;
    });
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.OPENAI_API_KEY;
  }
});

test("liveConfigured is false without a key or when disabled", async () => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.VOICE_API_KEY;
  const { liveConfigured } = await import("../src/server/voice/live");
  assert.equal(liveConfigured(), false);
  process.env.OPENAI_API_KEY = "sk-proj-LIVEKEY0123456789abcdefghij";
  process.env.VOICE_LIVE_DISABLED = "1";
  assert.equal(liveConfigured(), false);
  delete process.env.VOICE_LIVE_DISABLED;
  delete process.env.OPENAI_API_KEY;
});

test("runTool: search_catalog finds products, add_to_cart adds to existing quantities, show_cart/open_cart", async () => {
  const { runTool, extractToolCall } = await import("../src/hooks/useLiveVoice");
  const calls: [string, number, number][] = [];
  let opened = 0;
  const cart = { lines: [{ productId: "fd-szn-020", cases: 2, units: 0 }], setQuantity: (id: string, c: number, u: number) => void calls.push([id, c, u]), open: () => void opened++ };
  const search = runTool("search_catalog", JSON.stringify({ query: "tabasco 350 ml" }), cart, "tr");
  const hits = JSON.parse(search.output) as { results: { id: string; name: string; packaging: string }[] };
  assert.ok(hits.results.some((r) => r.id === "fd-szn-020"), "tabasco found");
  assert.match(search.summary, /search_catalog/);
  const add = runTool("add_to_cart", JSON.stringify({ productId: "fd-szn-020", cases: 3, units: 0 }), cart, "tr");
  assert.deepEqual(calls, [["fd-szn-020", 5, 0]]);
  assert.equal((JSON.parse(add.output) as { ok: boolean }).ok, true);
  const missing = runTool("add_to_cart", JSON.stringify({ productId: "nope", cases: 1, units: 0 }), cart, "tr");
  assert.equal((JSON.parse(missing.output) as { error: string }).error, "product-not-found");
  const show = runTool("show_cart", "{}", cart, "nl");
  assert.equal((JSON.parse(show.output) as { count: number }).count, 1);
  runTool("open_cart", "", cart, "tr");
  assert.equal(opened, 1);
  assert.equal(extractToolCall({ type: "response.event", event: { type: "response.output_item.done", item: { type: "function_call", call_id: "c1", name: "add_to_cart", arguments: "{}" } } })?.call_id, "c1");
  assert.equal(extractToolCall({ type: "session.started" }), null);
});

test("normalizeSdp restores CRLF line endings and the trailing newline the parser needs", async () => {
  const { normalizeSdp } = await import("../src/server/voice/live");
  assert.equal(normalizeSdp("v=0\r\na=x"), "v=0\r\na=x\r\n");
  assert.equal(normalizeSdp("v=0\na=x\n"), "v=0\r\na=x\r\n");
  assert.equal(normalizeSdp("v=0\r\na=x\r\n"), "v=0\r\na=x\r\n");
});
