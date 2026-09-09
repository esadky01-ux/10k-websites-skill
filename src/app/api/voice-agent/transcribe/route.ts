/**
 * Kayıt yedeği: tarayıcı MediaRecorder ile aldığı sesi buraya gönderir, sunucu STT servisine iletir.
 *  POST multipart/form-data { audio: Blob, lang?: "tr"|"nl"|"ku" } → { text }
 *  Yapılandırma yoksa 503 { error: "stt-not-configured" }.
 */
import { NextResponse } from "next/server";
import { sttConfigured, transcribeAudio } from "@/server/voice/realtime";

export const runtime = "nodejs";

const LANG_CODES: Record<string, string> = { tr: "tr", nl: "nl", ku: "ku" };
const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(req: Request) {
  if (!sttConfigured()) return NextResponse.json({ error: "stt-not-configured" }, { status: 503 });
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "multipart/form-data bekleniyor" }, { status: 400 });
  }
  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) return NextResponse.json({ error: "audio alanı gerekli" }, { status: 400 });
  if (audio.size > MAX_BYTES) return NextResponse.json({ error: "kayıt çok büyük" }, { status: 413 });
  const lang = LANG_CODES[String(form.get("lang") ?? "")];
  const ext = audio.type.includes("mp4") ? "mp4" : audio.type.includes("ogg") ? "ogg" : audio.type.includes("wav") ? "wav" : "webm";
  try {
    const text = await transcribeAudio(audio, `voice.${ext}`, lang);
    return NextResponse.json({ text });
  } catch (err) {
    console.error("[voice-agent/transcribe]", err);
    return NextResponse.json({ error: "Ses çözümlenemedi" }, { status: 502 });
  }
}
