import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { extractMessages, sendText } from "@/server/whatsapp/cloudapi";
import { handleIncoming } from "@/server/whatsapp/agent";

export const dynamic = "force-dynamic";

/** Meta webhook doğrulaması (hub.challenge). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN && challenge) {
    return new Response(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

function verifySignature(raw: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true; // imza gizli anahtarı tanımlı değilse doğrulama atlanır (geliştirme)
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const given = header.slice(7);
  return expected.length === given.length && timingSafeEqual(Buffer.from(expected), Buffer.from(given));
}

/** Gelen mesajlar: her mesaj için ajanı çalıştır ve yanıtı gönder. */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const messages = extractMessages(payload);
  const results: { to: string; ok: boolean }[] = [];
  for (const m of messages) {
    try {
      const reply = await handleIncoming(m.from, m.text, m.name);
      const sent = await sendText(m.from, reply.text);
      results.push({ to: m.from, ok: sent.ok });
    } catch (err) {
      console.error("[whatsapp] ajan hatası", err);
      results.push({ to: m.from, ok: false });
    }
  }
  return NextResponse.json({ received: messages.length, results });
}
