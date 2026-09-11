/**
 * Hızlı Sesli Sipariş yapılandırması.
 *  GET /api/voice-agent → { configured, tts, maxSeconds, live: GPT-Live canlı sohbet açık mı, liveModel }
 */
import { NextResponse } from "next/server";
import { openaiConfigured } from "@/server/voice/openai";
import { liveConfigured, LIVE_MODEL } from "@/server/voice/live";

export const runtime = "nodejs";

export async function GET() {
  const configured = openaiConfigured();
  return NextResponse.json({ configured, tts: configured && process.env.VOICE_TTS_DISABLED !== "1", maxSeconds: 30, live: liveConfigured(), liveModel: LIVE_MODEL() });
}
