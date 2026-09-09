/**
 * WhatsApp Cloud API (Meta) istemcisi.
 * Gerekli ortam değişkenleri: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN.
 * Değişkenler yoksa "kuru mod" çalışır: mesajlar gönderilmez, konsola yazılır.
 */
const GRAPH = "https://graph.facebook.com/v21.0";

export function isConfigured(): boolean {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

export async function sendText(to: string, body: string): Promise<{ ok: boolean; id?: string }> {
  if (!isConfigured()) {
    console.info(`[whatsapp:dry] → ${to}\n${body}`);
    return { ok: true, id: "dry-run" };
  }
  const res = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { preview_url: false, body } }),
  });
  if (!res.ok) {
    console.error("[whatsapp] gönderim hatası", res.status, await res.text());
    return { ok: false };
  }
  const data = (await res.json()) as { messages?: { id: string }[] };
  return { ok: true, id: data.messages?.[0]?.id };
}

/** Gelen webhook gövdesinden metin mesajlarını ayıklar. */
export type IncomingMessage = { from: string; text: string; id: string; name?: string };

export function extractMessages(payload: unknown): IncomingMessage[] {
  const out: IncomingMessage[] = [];
  const entries = (payload as { entry?: { changes?: { value?: { messages?: unknown[]; contacts?: { profile?: { name?: string }; wa_id?: string }[] } }[] }[] })?.entry ?? [];
  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const name = value?.contacts?.[0]?.profile?.name;
      for (const m of (value?.messages ?? []) as { from: string; id: string; type: string; text?: { body: string }; button?: { text: string }; interactive?: { button_reply?: { title: string }; list_reply?: { title: string } } }[]) {
        const text = m.type === "text" ? m.text?.body : m.type === "button" ? m.button?.text : m.type === "interactive" ? m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title : undefined;
        if (text) out.push({ from: m.from, text, id: m.id, name });
      }
    }
  }
  return out;
}
