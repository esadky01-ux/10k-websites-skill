/**
 * Sesli asistan köprüsü.
 *
 *  GET  /api/voice-agent  → yapılandırma: asistan adı, karşılama cümleleri, gerçek zamanlı köprü ve sunucu STT hazır mı.
 *  POST /api/voice-agent  → bir konuşma turu: { transcript, lang, history, cart } → { text, lang, actions }
 *
 * Tarayıcı konuşmayı metne çevirir (Web Speech API) ve buraya gönderir; dönen eylemleri gerçek sepete uygular,
 * metni seslendirir. WebRTC tabanlı canlı ses için bkz. ./webrtc/route.ts.
 */
import { NextResponse } from "next/server";
import { runVoiceTurn, type VoiceCartLine, type VoiceHistoryItem } from "@/server/voice/agent";
import { AGENT_NAME, GREETINGS, type VoiceLang } from "@/server/voice/prompt";
import { realtimeConfigured, sttConfigured } from "@/server/voice/realtime";

export const runtime = "nodejs";

const LANGS: VoiceLang[] = ["tr", "nl", "ku"];

export async function GET() {
  return NextResponse.json({
    agent: AGENT_NAME,
    greetings: GREETINGS,
    brain: process.env.ANTHROPIC_API_KEY ? "claude" : "fallback",
    realtime: realtimeConfigured(),
    stt: sttConfigured(),
  });
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }
  const transcript = typeof body.transcript === "string" ? body.transcript.trim().slice(0, 500) : "";
  if (!transcript) return NextResponse.json({ error: "transcript gerekli" }, { status: 400 });
  const lang = LANGS.includes(body.lang as VoiceLang) ? (body.lang as VoiceLang) : "tr";
  const history = (Array.isArray(body.history) ? body.history : [])
    .filter((h): h is VoiceHistoryItem => !!h && typeof h === "object" && (h as VoiceHistoryItem).role !== undefined && typeof (h as VoiceHistoryItem).text === "string")
    .map((h) => ({ role: h.role === "assistant" ? ("assistant" as const) : ("user" as const), text: String(h.text).slice(0, 500) }))
    .slice(-12);
  const cart = (Array.isArray(body.cart) ? body.cart : [])
    .filter((l): l is VoiceCartLine => !!l && typeof l === "object" && typeof (l as VoiceCartLine).productId === "string")
    .map((l) => ({ productId: l.productId, cases: Math.max(0, Math.floor(Number(l.cases) || 0)), units: Math.max(0, Math.floor(Number(l.units) || 0)) }))
    .slice(0, 100);

  try {
    const result = await runVoiceTurn({ transcript, lang, history, cart });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[voice-agent]", err);
    return NextResponse.json({ error: "Asistan şu an yanıt veremiyor" }, { status: 502 });
  }
}
