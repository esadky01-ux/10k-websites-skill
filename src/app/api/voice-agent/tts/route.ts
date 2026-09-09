/**
 * Metin-ses: { text } → audio/mpeg (OpenAI TTS, model tts-1, ses onyx). Tarayıcı bunu Audio nesnesiyle çalar.
 * Yapılandırma yoksa 503 { error: "tts-not-configured" }; istemci tarayıcının kendi sesine düşer.
 */
import { NextResponse } from "next/server";
import { safeDetail, synthesizeSpeech, ttsConfigured, TtsError } from "@/server/voice/realtime";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!ttsConfigured()) return NextResponse.json({ error: "tts-not-configured" }, { status: 503 });
  let body: { text?: unknown };
  try {
    body = (await req.json()) as { text?: unknown };
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 600) : "";
  if (!text) return NextResponse.json({ error: "text gerekli" }, { status: 400 });
  try {
    const audio = await synthesizeSpeech(text);
    return new NextResponse(new Uint8Array(audio), { status: 200, headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=3600", "Content-Length": String(audio.length) } });
  } catch (err) {
    console.error("[voice-agent/tts]", safeDetail(String((err as Error)?.stack ?? err)));
    const detail = safeDetail(err instanceof TtsError ? `upstream ${err.status}: ${err.detail}` : ((err as Error)?.message ?? String(err)));
    return NextResponse.json({ error: "tts-upstream", detail }, { status: 502 });
  }
}
