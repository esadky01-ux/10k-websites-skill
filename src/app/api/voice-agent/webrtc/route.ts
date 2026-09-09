/**
 * WebRTC sinyalleşme köprüsü: tarayıcıdan gelen SDP teklifini VOICE_API_KEY ile ses sağlayıcısına iletir,
 * SDP cevabını geri döndürür. Anahtar sunucuda kalır. Yapılandırma yoksa 503 döner ve arayüz tarayıcı
 * moduna (Web Speech + Claude) düşer.
 *
 * Not: Vercel benzeri sunucusuz ortamlarda kalıcı WebSocket sunucusu çalışmaz; bu yüzden ses akışı
 * WebRTC ile eşler arası gider, sunucu yalnızca sinyalleşmeyi yapar.
 */
import { NextResponse } from "next/server";
import { forwardOffer, realtimeConfigured, safeDetail } from "@/server/voice/realtime";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!realtimeConfigured()) return NextResponse.json({ error: "Gerçek zamanlı ses yapılandırılmamış (VOICE_API_KEY / VOICE_REALTIME_URL)" }, { status: 503 });
  const offer = (await req.text()).trim();
  if (!offer.startsWith("v=0")) return NextResponse.json({ error: "SDP teklifi bekleniyor (Content-Type: application/sdp)" }, { status: 400 });
  try {
    const { status, body, contentType } = await forwardOffer(offer);
    return new NextResponse(body, { status, headers: { "Content-Type": contentType } });
  } catch (err) {
    console.error("[voice-agent/webrtc]", safeDetail(String((err as Error)?.stack ?? err)));
    return NextResponse.json({ error: "Ses sağlayıcısına ulaşılamadı" }, { status: 502 });
  }
}
