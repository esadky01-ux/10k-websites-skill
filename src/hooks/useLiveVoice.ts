"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { searchProducts } from "@/server/whatsapp/matcher";
import { formatPackaging, getProduct, productName } from "@/data/products";
import type { CartLine } from "@/lib/cart";

/**
 * GPT-Live (gpt-live-1) canlı sesli asistan kancası — WebRTC.
 *
 *   getUserMedia → RTCPeerConnection (mikrofon → OpenAI, OpenAI sesi → <audio>)
 *   → createDataChannel("oai-events") → SDP teklifi → POST /api/realtime-session { sdp, lang }
 *   → SDP cevabı → setRemoteDescription. Ses uçtan uca WebRTC ile akar; araya girme (barge-in)
 *   modelin kendi VAD'ıyla sağlanır, biz yalnızca durumu (dinliyor/düşünüyor/konuşuyor) gösteririz.
 *
 * Veri kanalı olayları (Live API):
 *   session.started / session.updated           → hazır, dinliyor
 *   session.input_transcript.delta              → müşteri konuşuyor (altyazı)
 *   session.output_transcript.delta             → asistan konuşuyor (altyazı)
 *   response.event { event: response.output_item.done { item: function_call } }
 *                                               → araç çağrısı; tarayıcıda çalıştırılır ve
 *                                                  response.item.create + response.create ile geri gönderilir
 *   session.closed { reason }                   → oturum bitti
 * Oturum, HTTP isteğiyle başlar; kanalda ayrıca "session.start" gönderilmez.
 */

export type LiveState = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "error";
export type LiveLine = { role: "user" | "assistant"; text: string; final: boolean };
export type LiveToolLog = { name: string; summary: string };

export type LiveCartApi = {
  lines: CartLine[];
  setQuantity: (productId: string, cases: number, units: number) => void;
  open: () => void;
};

type ToolCall = { call_id: string; name: string; arguments: string };
type LiveEvent = {
  type?: string;
  delta?: string;
  text?: string;
  reason?: string;
  error?: { message?: string };
  event?: { type?: string; item?: { type?: string; call_id?: string; name?: string; arguments?: string } };
};

export type UseLiveVoiceOptions = {
  lang: "tr" | "nl";
  cart: LiveCartApi;
  /** Boşta kalma sonrası oturumu kapat (saniye). Maliyet dakika başına ücretlendirilir. */
  idleSeconds?: number;
  /** Tek oturum üst sınırı (saniye). */
  maxSeconds?: number;
  onError?: (where: string, err: unknown) => void;
};

const IDLE_DEFAULT = 90;
const MAX_DEFAULT = 10 * 60;
const CAPTION_LINES = 8;

function safe(fn: () => void, label: string) {
  try {
    fn();
  } catch (err) {
    console.warn(`[voice-live] ${label}:`, err);
  }
}

/** Araç çağrılarını tarayıcıda yürütür: katalog araması, sepet işlemleri. */
export function runTool(name: string, rawArgs: string, cart: LiveCartApi, lang: "tr" | "nl"): { output: string; summary: string } {
  let args: Record<string, unknown> = {};
  try {
    args = rawArgs ? (JSON.parse(rawArgs) as Record<string, unknown>) : {};
  } catch {
    return { output: JSON.stringify({ error: "invalid-arguments" }), summary: `${name}: geçersiz argüman` };
  }
  switch (name) {
    case "search_catalog": {
      const query = String(args.query ?? "").trim();
      const hits = query ? searchProducts(query, 6) : [];
      const results = hits.map(({ product: p }) => ({ id: p.id, name: p.name, nameNl: p.nameNlShort, brand: p.brand, packaging: formatPackaging(p), unitLabel: p.unitLabel, category: p.category }));
      return { output: JSON.stringify({ query, results }), summary: `search_catalog "${query}" → ${results.length}` };
    }
    case "add_to_cart": {
      const id = String(args.productId ?? "");
      const p = getProduct(id);
      if (!p) return { output: JSON.stringify({ ok: false, error: "product-not-found", productId: id }), summary: `add_to_cart ${id}: bulunamadı` };
      const cases = Math.max(0, Math.floor(Number(args.cases ?? 0)) || 0);
      const units = Math.max(0, Math.floor(Number(args.units ?? 0)) || 0);
      const ex = cart.lines.find((l) => l.productId === id);
      const next = { cases: (ex?.cases ?? 0) + (cases || (units ? 0 : 1)), units: (ex?.units ?? 0) + units };
      cart.setQuantity(id, next.cases, next.units);
      const name = productName(p, lang);
      return {
        output: JSON.stringify({ ok: true, productId: id, name, packaging: formatPackaging(p), added: { cases: cases || (units ? 0 : 1), units }, total: next }),
        summary: `add_to_cart ${name} +${cases || (units ? 0 : 1)} koli${units ? ` +${units} adet` : ""}`,
      };
    }
    case "show_cart": {
      const items = cart.lines.map((l) => {
        const p = getProduct(l.productId);
        return { productId: l.productId, name: p ? productName(p, lang) : l.productId, packaging: p ? formatPackaging(p) : "", cases: l.cases, units: l.units };
      });
      return { output: JSON.stringify({ items, count: items.length }), summary: `show_cart → ${items.length} satır` };
    }
    case "open_cart": {
      cart.open();
      return { output: JSON.stringify({ ok: true }), summary: "open_cart" };
    }
    default:
      return { output: JSON.stringify({ error: "unknown-tool", name }), summary: `${name}: bilinmeyen araç` };
  }
}

/** Live API veri kanalı olayından araç çağrısını ayıklar (response.event içinde sarılı). */
export function extractToolCall(ev: LiveEvent): ToolCall | null {
  const inner = ev.type === "response.event" ? ev.event : (ev as LiveEvent["event"]);
  if (!inner || inner.type !== "response.output_item.done") return null;
  const item = inner.item;
  if (!item || item.type !== "function_call" || !item.call_id || !item.name) return null;
  return { call_id: item.call_id, name: item.name, arguments: item.arguments ?? "" };
}

export function useLiveVoice({ lang, cart, idleSeconds = IDLE_DEFAULT, maxSeconds = MAX_DEFAULT, onError }: UseLiveVoiceOptions) {
  const [state, setState] = useState<LiveState>("idle");
  const [lines, setLines] = useState<LiveLine[]>([]);
  const [tools, setTools] = useState<LiveToolLog[]>([]);
  const [muted, setMuted] = useState(false);
  const [level, setLevel] = useState(0);
  const [sessionId, setSessionId] = useState("");
  const [closeReason, setCloseReason] = useState("");

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<{ ctx: AudioContext; raf: number } | null>(null);
  const idleTimerRef = useRef<number | null>(null);
  const maxTimerRef = useRef<number | null>(null);
  const cartRef = useRef(cart);
  const langRef = useRef(lang);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    cartRef.current = cart;
    langRef.current = lang;
    onErrorRef.current = onError;
  }, [cart, lang, onError]);

  const report = useCallback((where: string, err: unknown) => {
    console.warn(`[voice-live] ${where}:`, err);
    onErrorRef.current?.(where, err);
  }, []);

  const send = useCallback((payload: Record<string, unknown>) => {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== "open") return false;
    try {
      dc.send(JSON.stringify(payload));
      return true;
    } catch (err) {
      console.warn("[voice-live] send:", err);
      return false;
    }
  }, []);

  const clearTimers = useCallback(() => {
    if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
    if (maxTimerRef.current !== null) window.clearTimeout(maxTimerRef.current);
    idleTimerRef.current = null;
    maxTimerRef.current = null;
  }, []);

  const teardown = useCallback(
    (next: LiveState = "idle") => {
      clearTimers();
      const an = analyserRef.current;
      analyserRef.current = null;
      if (an) {
        window.cancelAnimationFrame(an.raf);
        safe(() => void an.ctx.close(), "audioContext.close");
      }
      safe(() => dcRef.current?.close(), "dc.close");
      dcRef.current = null;
      safe(() => pcRef.current?.close(), "pc.close");
      pcRef.current = null;
      streamRef.current?.getTracks().forEach((tr) => safe(() => tr.stop(), "track.stop"));
      streamRef.current = null;
      const el = audioRef.current;
      if (el) safe(() => { el.pause(); el.srcObject = null; }, "audio.reset");
      setLevel(0);
      setMuted(false);
      setState(next);
    },
    [clearTimers],
  );

  /** Oturumu nazikçe kapat: sunucuya session.close, ardından yerel kaynakları bırak. */
  const stop = useCallback(
    (reason = "close_requested") => {
      if (!pcRef.current && !dcRef.current) return;
      send({ type: "session.close" });
      setCloseReason(reason);
      teardown("idle");
    },
    [send, teardown],
  );

  const bumpIdle = useCallback(() => {
    if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => stop("idle_timeout"), idleSeconds * 1000);
  }, [idleSeconds, stop]);

  const pushLine = useCallback((role: LiveLine["role"], delta: string, final = false) => {
    if (!delta && !final) return;
    setLines((prev) => {
      const last = prev[prev.length - 1];
      let next: LiveLine[];
      if (last && last.role === role && !last.final) next = [...prev.slice(0, -1), { role, text: last.text + delta, final }];
      else next = [...prev, { role, text: delta, final }];
      return next.slice(-CAPTION_LINES);
    });
  }, []);

  const finalize = useCallback((role: LiveLine["role"]) => {
    setLines((prev) => {
      const last = prev[prev.length - 1];
      if (!last || last.role !== role || last.final) return prev;
      return [...prev.slice(0, -1), { ...last, final: true }];
    });
  }, []);

  const handleEvent = useCallback(
    (raw: string) => {
      let ev: LiveEvent;
      try {
        ev = JSON.parse(raw) as LiveEvent;
      } catch {
        return;
      }
      bumpIdle();
      const call = extractToolCall(ev);
      if (call) {
        setState("thinking");
        const { output, summary } = runTool(call.name, call.arguments, cartRef.current, langRef.current);
        setTools((prev) => [...prev.slice(-5), { name: call.name, summary }]);
        send({ type: "response.item.create", item: { type: "function_call_output", call_id: call.call_id, output } });
        send({ type: "response.create" });
        return;
      }
      switch (ev.type) {
        case "session.started":
        case "session.updated":
          setState((s) => (s === "connecting" ? "listening" : s));
          break;
        case "session.input_transcript.delta":
          finalize("assistant");
          pushLine("user", ev.delta ?? ev.text ?? "");
          setState("listening");
          break;
        case "session.input_transcript.done":
        case "session.input_transcript.completed":
          finalize("user");
          setState("thinking");
          break;
        case "session.output_transcript.delta":
          finalize("user");
          pushLine("assistant", ev.delta ?? ev.text ?? "");
          setState("speaking");
          break;
        case "session.output_transcript.done":
        case "session.output_transcript.completed":
        case "session.output_audio.done":
          finalize("assistant");
          setState("listening");
          break;
        case "session.delegation.created":
          setState("thinking");
          break;
        case "session.closed":
          setCloseReason(ev.reason ?? "closed");
          teardown("idle");
          break;
        case "error":
        case "session.error":
          report("live-event", new Error(ev.error?.message ?? "live error"));
          break;
        default:
          break;
      }
    },
    [bumpIdle, finalize, pushLine, report, send, teardown],
  );

  /** Mikrofon seviyesini dalga formu için ölç (yalnızca görsel). */
  const startMeter = useCallback((stream: MediaStream) => {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    try {
      const ctx = new Ctx();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += (v - 128) * (v - 128);
        setLevel(Math.min(1, Math.sqrt(sum / data.length) / 40));
        const cur = analyserRef.current;
        if (cur) cur.raf = window.requestAnimationFrame(tick);
      };
      analyserRef.current = { ctx, raf: window.requestAnimationFrame(tick) };
    } catch (err) {
      console.warn("[voice-live] meter:", err);
    }
  }, []);

  const start = useCallback(async () => {
    if (pcRef.current) return;
    setLines([]);
    setTools([]);
    setCloseReason("");
    setSessionId("");
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      report("insecure", new Error("insecure context"));
      setState("error");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") {
      report("unsupported", new Error("WebRTC unsupported"));
      setState("error");
      return;
    }
    setState("connecting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      streamRef.current = stream;
      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      pc.ontrack = (e) => {
        const el = audioRef.current;
        if (!el) return;
        el.srcObject = e.streams[0] ?? new MediaStream([e.track]);
        el.play().catch((err) => report("audio.play", err));
      };
      pc.onconnectionstatechange = () => {
        const st = pc.connectionState;
        if ((st === "failed" || st === "disconnected" || st === "closed") && pcRef.current === pc) {
          setCloseReason(st === "closed" ? "closed" : "connection_lost");
          teardown(st === "failed" ? "error" : "idle");
        }
      };
      for (const track of stream.getAudioTracks()) pc.addTrack(track, stream);
      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      dc.onmessage = (e) => handleEvent(typeof e.data === "string" ? e.data : "");
      dc.onopen = () => {
        setState((s) => (s === "connecting" ? "listening" : s));
        bumpIdle();
      };
      dc.onerror = (e) => report("datachannel", (e as { error?: unknown }).error ?? e);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const res = await fetch("/api/realtime-session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sdp: offer.sdp, lang }) });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
        throw new Error(`${res.status} ${body.error ?? ""}${body.detail ? ` (${body.detail})` : ""}`.trim());
      }
      const data = (await res.json()) as { id?: string; sdp?: string };
      if (!data.sdp) throw new Error("SDP answer missing");
      if (pcRef.current !== pc) return; // bu arada kapatıldı
      await pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
      setSessionId(data.id ?? "");
      startMeter(stream);
      maxTimerRef.current = window.setTimeout(() => stop("max_duration"), maxSeconds * 1000);
    } catch (err) {
      report("connect", err);
      teardown("error");
    }
  }, [bumpIdle, handleEvent, lang, maxSeconds, report, startMeter, stop, teardown]);

  /** Mikrofonu sustur/aç: hem yerel parça hem sunucu tarafı (session.input_audio.mute). */
  const toggleMute = useCallback(() => {
    const next = !muted;
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
    send({ type: next ? "session.input_audio.mute" : "session.input_audio.unmute" });
    setMuted(next);
  }, [muted, send]);

  useEffect(() => () => teardown("idle"), [teardown]);

  return { state, lines, tools, muted, level, sessionId, closeReason, audioRef, start, stop, toggleMute, active: state !== "idle" && state !== "error" };
}
