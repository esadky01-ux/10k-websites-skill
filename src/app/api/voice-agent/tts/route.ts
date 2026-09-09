/**
 * "Özeti dinle": { text } → audio/mpeg (OpenAI TTS). Yalnızca kullanıcı dokunuşuyla çağrılır, asla otomatik çalınmaz.
 * Yapılandırma yoksa 503 { error: "tts-not-configured" }; istemci tarayıcının kendi sesine düşer.
 */
import { NextResponse } from "next/server";
import { openaiConfigured, safeDetail, synthesizeSpeech, UpstreamError } from "@/server/voice/openai";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!openaiConfigured() || process.env.VOICE_TTS_DISABLED === "1") return NextResponse.json({ error: "tts-not-configured" }, { status: 503 });
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
    const detail = safeDetail(err instanceof UpstreamError ? `upstream ${err.status}: ${err.detail}` : ((err as Error)?.message ?? String(err)));
    return NextResponse.json({ error: "tts-upstream", detail }, { status: 502 });
  }
}
