/**
 * GPT-Live oturumu: tarayıcının WebRTC SDP teklifini alır, OpenAI Live API'de oturum açar, SDP cevabını döndürür.
 *  POST { sdp, lang? } → 201 { id, sdp, model, backendModel }
 *  Anahtar yoksa 503 { error: "live-not-configured" }.
 * Not: GPT-Live'da oturum bu HTTP isteğiyle başlar; veri kanalında ayrıca "session.start" gönderilmez.
 */
import { NextResponse } from "next/server";
import { safeDetail, UpstreamError } from "@/server/voice/openai";
import { createLiveSession, liveConfigured } from "@/server/voice/live";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!liveConfigured()) return NextResponse.json({ error: "live-not-configured" }, { status: 503 });
  let body: { sdp?: unknown; lang?: unknown };
  try {
    body = (await req.json()) as { sdp?: unknown; lang?: unknown };
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }
  // SDP'yi kırpma: son satırın CRLF'si ayrıştırıcı için zorunlu (normalizeSdp tamamlar).
  const sdp = typeof body.sdp === "string" ? body.sdp : "";
  if (!/^v=0\r?\n/.test(sdp)) return NextResponse.json({ error: "sdp alanı (WebRTC teklifi) gerekli" }, { status: 400 });
  const lang = body.lang === "nl" ? "nl" : "tr";
  try {
    const session = await createLiveSession(sdp, lang);
    return NextResponse.json(session, { status: 201 });
  } catch (err) {
    console.error("[realtime-session]", safeDetail(String((err as Error)?.stack ?? err)));
    const detail = safeDetail(err instanceof UpstreamError ? `upstream ${err.status}: ${err.detail}` : ((err as Error)?.message ?? String(err)));
    return NextResponse.json({ error: "live-upstream", detail, sdpBytes: sdp.length }, { status: 502 });
  }
}
