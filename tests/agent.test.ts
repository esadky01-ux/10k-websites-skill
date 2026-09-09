import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

process.env.MAXIMUS_DATA_DIR = mkdtempSync(path.join(tmpdir(), "mx-agent-"));
delete process.env.ANTHROPIC_API_KEY;

const load = async () => ({
  ...(await import("../src/server/whatsapp/agent")),
  ...(await import("../src/server/store")),
  ...(await import("../src/server/whatsapp/cloudapi")),
});

test("fallback agent builds a draft and confirms an order", async () => {
  const { handleIncoming, getStore } = await load();
  const first = await handleIncoming("32470000001", "1 koli tabasco 350ml, 2 koli pauwels samurai 3 liter", "Test");
  assert.match(first.text, /Taslak|Concept/);
  assert.match(first.text, /Tabasco/);
  const second = await handleIncoming("32470000001", "ok depo");
  assert.ok(second.text.length > 10);
  const conv = await getStore().getConversation("32470000001");
  assert.ok(conv);
  assert.equal(conv!.draft.length, 0, "draft cleared after confirmation");
  assert.equal(conv!.history.length, 4);
});

test("fallback agent asks when ambiguous", async () => {
  const { handleIncoming } = await load();
  const r = await handleIncoming("32470000002", "3 koli kip doner");
  assert.match(r.text, /Welke bedoelt u|hangisi/);
});

test("extractMessages parses Meta webhook payload", async () => {
  const { extractMessages } = await load();
  const payload = { entry: [{ changes: [{ value: { contacts: [{ profile: { name: "Ali" }, wa_id: "324" }], messages: [{ from: "324", id: "m1", type: "text", text: { body: "hallo" } }] } }] }] };
  const msgs = extractMessages(payload);
  assert.deepEqual(msgs, [{ from: "324", text: "hallo", id: "m1", name: "Ali" }]);
});
