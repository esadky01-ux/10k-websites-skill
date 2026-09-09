/**
 * Gerçek zamanlı ses köprüsü yapılandırması.
 *
 * Tarayıcı, mikrofon sesini WebRTC ile doğrudan ses sağlayıcısına gönderir; sağlayıcının API anahtarı
 * tarayıcıya hiç inmez: SDP teklifi /api/voice-agent/webrtc üzerinden sunucuda imzalanıp iletilir.
 *
 *   VOICE_API_KEY       sağlayıcı anahtarı (zorunlu)
 *   VOICE_REALTIME_URL  sağlayıcının SDP uç noktası, örn. https://api.<saglayici>.com/v1/realtime
 *   VOICE_MODEL         isteğe bağlı model/ses kimliği; sorgu parametresi olarak eklenir
 */
export function realtimeConfigured(): boolean {
  return !!(process.env.VOICE_API_KEY && process.env.VOICE_REALTIME_URL);
}

export async function forwardOffer(offerSdp: string): Promise<{ status: number; body: string; contentType: string }> {
  const url = new URL(process.env.VOICE_REALTIME_URL as string);
  if (process.env.VOICE_MODEL) url.searchParams.set("model", process.env.VOICE_MODEL);
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.VOICE_API_KEY}`, "Content-Type": "application/sdp" },
    body: offerSdp,
    signal: AbortSignal.timeout(15_000),
  });
  return { status: res.status, body: await res.text(), contentType: res.headers.get("content-type") ?? "application/sdp" };
}
