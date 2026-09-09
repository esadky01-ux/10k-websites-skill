/**
 * Hızlı Sesli Sipariş yapılandırması.
 *  GET /api/voice-agent → { configured: OpenAI anahtarı var mı, tts: özet dinleme var mı, maxSeconds }
 */
import { NextResponse } from "next/server";
import { openaiConfigured } from "@/server/voice/openai";

export const runtime = "nodejs";

export async function GET() {
  const configured = openaiConfigured();
  return NextResponse.json({ configured, tts: configured && process.env.VOICE_TTS_DISABLED !== "1", maxSeconds: 30 });
}
