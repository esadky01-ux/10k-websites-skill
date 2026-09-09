/**
 * Hızlı Sesli Sipariş: POST multipart { audio, lang? } → { transkript, dil, eklenenler, bulunamayanlar, toplamTutar }
 *  - Whisper → GPT-4o-mini → deterministik katalog eşleştirme (src/server/voice/order.ts)
 *  - Fiyat ve toplam yalnızca giriş yapmış ve onaylı müşteri için döner (fiyatlar sunucuda kalır).
 */
import { NextResponse } from "next/server";
import { currentCustomer } from "@/server/auth";
import { getPricesForCustomer } from "@/server/prices";
import { openaiConfigured, safeDetail, UpstreamError } from "@/server/voice/openai";
import { processOrderAudio, type VoiceLang } from "@/server/voice/order";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(req: Request) {
  if (!openaiConfigured()) return NextResponse.json({ error: "voice-not-configured" }, { status: 503 });
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "multipart/form-data bekleniyor" }, { status: 400 });
  }
  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) return NextResponse.json({ error: "audio alanı gerekli" }, { status: 400 });
  if (audio.size > MAX_BYTES) return NextResponse.json({ error: "kayıt çok büyük" }, { status: 413 });
  const langRaw = String(form.get("lang") ?? "");
  const lang: VoiceLang | undefined = langRaw === "tr" || langRaw === "nl" || langRaw === "ku" ? langRaw : undefined;
  const ext = audio.type.includes("mp4") ? "mp4" : audio.type.includes("ogg") ? "ogg" : audio.type.includes("wav") ? "wav" : "webm";
  const customer = await currentCustomer();
  const prices = customer && customer.status === "approved" ? getPricesForCustomer() : null;
  try {
    const result = await processOrderAudio(audio, `order.${ext}`, lang, prices);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[voice-agent/order-audio]", safeDetail(String((err as Error)?.stack ?? err)));
    const detail = safeDetail(err instanceof UpstreamError ? `${err.stage} ${err.status}: ${err.detail}` : ((err as Error)?.message ?? String(err)));
    return NextResponse.json({ error: "voice-upstream", detail }, { status: 502 });
  }
}
