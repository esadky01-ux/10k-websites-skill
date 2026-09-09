"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square, X, ShoppingCart, Volume2, RotateCcw, Loader2, Check, AlertCircle } from "lucide-react";
import { useCart } from "@/components/CartProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { describeError, logClientError } from "@/components/VoiceAgentBoundary";
import { formatEur } from "@/lib/format";

/**
 * Hızlı Sesli Sipariş (WhatsApp mantığı, bas-konuş):
 *   dokun → MediaRecorder kaydı → dokun (bitir) → POST /api/voice-agent/order-audio
 *   → sunucu: Whisper → GPT-4o-mini → deterministik katalog eşleştirme
 *   → dönen satırlar sepete eklenir, onay kartı gösterilir. Ses asla otomatik çalınmaz;
 *   "Özeti dinle" yalnızca kullanıcı dokunuşuyla çalışır.
 */

type Status = "idle" | "recording" | "processing" | "done" | "error";
type Added = { id: string; isim: string; koli: number; adet: number; adetMetni: string; ambalaj: string; birimFiyat: number | null };
type Result = { transkript: string; dil: "tr" | "nl" | "ku"; eklenenler: Added[]; bulunamayanlar: string[]; toplamTutar: number | null; yedek: boolean };
type Config = { configured: boolean; tts: boolean; maxSeconds: number };

const MAX_SECONDS = 30;
const MIN_BYTES = 1500;

function safe<T>(fn: () => T, label: string): T | undefined {
  try {
    return fn();
  } catch (err) {
    console.warn(`[voice-order] ${label}:`, err);
    return undefined;
  }
}

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", "audio/ogg"]) {
    if (safe(() => MediaRecorder.isTypeSupported(m), "isTypeSupported")) return m;
  }
  return "";
}

export default function VoiceAgent() {
  const cart = useCart();
  const { lang, t } = useI18n();
  const tv = t.voice;

  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [seconds, setSeconds] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [notice, setNotice] = useState("");
  const [detail, setDetail] = useState("");
  const [config, setConfig] = useState<Config | null>(null);
  const [listening, setListening] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const report = useCallback((where: string, err: unknown) => {
    console.warn(`[voice-order] ${where}:`, err);
    setDetail(`${where} → ${describeError(err)}`);
    logClientError(where, err);
  }, []);

  /** Panel açılınca yapılandırmayı al (anahtar var mı, özet dinleme var mı). */
  useEffect(() => {
    if (!open || config) return;
    fetch("/api/voice-agent")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((c: Config) => {
        setConfig(c);
        if (!c.configured) setNotice(tv.notConfigured);
      })
      .catch((err) => report("config", err));
  }, [open, config, report, tv.notConfigured]);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((tr) => safe(() => tr.stop(), "track.stop"));
    streamRef.current = null;
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /** Sunucudan dönen satırları gerçek sepete ekler (mevcut miktara ekler). */
  const applyToCart = useCallback(
    (lines: Added[]) => {
      for (const l of lines) {
        try {
          const ex = cart.lines.find((x) => x.productId === l.id);
          cart.setQuantity(l.id, (ex?.cases ?? 0) + l.koli, (ex?.units ?? 0) + l.adet);
        } catch (err) {
          console.warn("[voice-order] sepet:", err);
        }
      }
    },
    [cart],
  );

  const upload = useCallback(
    async (blob: Blob) => {
      if (blob.size < MIN_BYTES) {
        setStatus("idle");
        setNotice(tv.tooShort);
        return;
      }
      setStatus("processing");
      setNotice("");
      setDetail("");
      try {
        const form = new FormData();
        form.append("audio", blob, blob.type.includes("mp4") ? "order.mp4" : "order.webm");
        form.append("lang", lang);
        const res = await fetch("/api/voice-agent/order-audio", { method: "POST", body: form });
        if (res.status === 503) {
          setStatus("error");
          setNotice(tv.notConfigured);
          return;
        }
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { detail?: string; error?: string };
          throw new Error(`${res.status}${body.detail ? ` (${body.detail})` : body.error ? ` (${body.error})` : ""}`);
        }
        const r = (await res.json()) as Result;
        applyToCart(r.eklenenler ?? []);
        setResult(r);
        setStatus("done");
        if (!r.transkript) setNotice(tv.nothing);
      } catch (err) {
        report("order-audio", err);
        setStatus("error");
        setNotice(tv.error);
      }
    },
    [applyToCart, lang, report, tv.error, tv.notConfigured, tv.nothing, tv.tooShort],
  );

  const stopRecording = useCallback(() => {
    stopTimer();
    const r = recorderRef.current;
    recorderRef.current = null;
    setListening(false);
    if (r && r.state !== "inactive") safe(() => r.stop(), "recorder.stop");
    else releaseStream();
  }, [releaseStream, stopTimer]);

  const startRecording = useCallback(async () => {
    if (recorderRef.current) return;
    setNotice("");
    setDetail("");
    setResult(null);
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      setStatus("error");
      setNotice(tv.insecure);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setStatus("error");
      setNotice(tv.unsupported);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const mime = pickMime();
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onerror = (e) => {
        report("recorder", (e as { error?: unknown }).error ?? e);
        stopRecording();
        setStatus("error");
        setNotice(tv.error);
      };
      rec.onstop = () => {
        releaseStream();
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || mime || "audio/webm" });
        chunksRef.current = [];
        void upload(blob);
      };
      recorderRef.current = rec;
      rec.start(250);
      startedAtRef.current = Date.now();
      setSeconds(0);
      setListening(true);
      setStatus("recording");
      const max = config?.maxSeconds ?? MAX_SECONDS;
      timerRef.current = window.setInterval(() => {
        const s = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setSeconds(s);
        if (s >= max && recorderRef.current === rec) stopRecording();
      }, 250);
    } catch (err) {
      report("getUserMedia", err);
      const name = (err as { name?: string })?.name ?? "";
      setStatus("error");
      setNotice(name === "NotAllowedError" || name === "SecurityError" ? tv.micDenied : name === "NotFoundError" || name === "OverconstrainedError" ? tv.noMic : tv.error);
    }
  }, [config, releaseStream, report, stopRecording, tv.error, tv.insecure, tv.micDenied, tv.noMic, tv.unsupported, upload]);

  const toggleRecording = () => {
    if (status === "processing") return;
    if (recorderRef.current) stopRecording();
    else void startRecording();
  };

  /** "Özeti dinle": yalnızca dokunuşla; sunucu TTS, yoksa tarayıcı sesi. Asla otomatik çalınmaz. */
  const listenSummary = useCallback(async () => {
    if (!result) return;
    const text = summaryFor(result, tv);
    const el = audioRef.current;
    try {
      if (config?.tts && el) {
        const res = await fetch("/api/voice-agent/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
        if (res.ok) {
          const blob = await res.blob();
          if (audioUrlRef.current) safe(() => URL.revokeObjectURL(audioUrlRef.current as string), "revoke");
          const url = URL.createObjectURL(blob);
          audioUrlRef.current = url;
          el.src = url;
          await el.play();
          return;
        }
        const body = (await res.json().catch(() => ({}))) as { detail?: string };
        report("tts", new Error(`tts ${res.status}${body.detail ? ` (${body.detail})` : ""}`));
      }
      if ("speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined") {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = result.dil === "nl" ? "nl-BE" : "tr-TR";
        window.speechSynthesis.speak(u);
      } else setNotice(tv.noAudio);
    } catch (err) {
      report("listen", err);
      setNotice(tv.noAudio);
    }
  }, [config, report, result, tv]);

  const goToCart = () => {
    setOpen(false);
    cart.open();
  };

  const reset = () => {
    setResult(null);
    setNotice(config && !config.configured ? tv.notConfigured : "");
    setDetail("");
    setStatus("idle");
  };

  const closePanel = useCallback(() => {
    stopRecording();
    safe(() => audioRef.current?.pause(), "audio.pause");
    safe(() => window.speechSynthesis?.cancel(), "cancel");
    setOpen(false);
  }, [stopRecording]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closePanel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closePanel]);

  // Bileşen kaldırılırken mikrofon ve sesi bırak
  useEffect(
    () => () => {
      stopTimer();
      safe(() => recorderRef.current?.stop(), "recorder.stop");
      recorderRef.current = null;
      streamRef.current?.getTracks().forEach((tr) => safe(() => tr.stop(), "track.stop"));
      streamRef.current = null;
      if (audioUrlRef.current) safe(() => URL.revokeObjectURL(audioUrlRef.current as string), "revoke");
    },
    [stopTimer],
  );

  const statusLabel = { idle: tv.hint, recording: `${tv.recording} ${seconds}s`, processing: tv.processing, done: tv.done, error: tv.hint }[status];

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="notranslate fixed bottom-5 right-5 z-[45] flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-xl shadow-brand-900/30 transition hover:scale-105 hover:bg-brand-600 sm:h-16 sm:w-16"
          translate="no"
          aria-label={tv.open}
          title={tv.name}
          data-testid="voice-open"
        >
          <Mic className="h-6 w-6 sm:h-7 sm:w-7" />
          <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-brand-500/40" aria-hidden />
        </button>
      )}

      {open && (
        <section
          className="notranslate fixed bottom-4 right-4 z-[45] w-[min(92vw,380px)] overflow-hidden rounded-3xl border border-cream-200 bg-white shadow-2xl"
          translate="no"
          role="dialog"
          aria-label={tv.name}
          data-testid="voice-panel"
        >
          <header className="notranslate flex items-center justify-between bg-ink-900 px-4 py-3 text-white" translate="no">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500"><Mic className="h-4 w-4" /></span>
              <div>
                <p className="text-sm font-bold leading-tight"><span>{tv.name}</span></p>
                <p className="text-[11px] text-cream-100/70" data-testid="voice-status"><span>{statusLabel}</span></p>
              </div>
            </div>
            <button type="button" onClick={closePanel} className="rounded-full p-1.5 text-cream-100/80 hover:bg-white/10 hover:text-white" aria-label={tv.close} data-testid="voice-close">
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="notranslate px-4 pb-4 pt-3" translate="no">
            {status !== "done" && (
              <>
                <div className={`voice-wave voice-wave--${listening ? "listening" : status === "processing" ? "thinking" : "idle"}`} aria-hidden>
                  {[0, 1, 2, 3, 4].map((i) => <span key={i} style={{ animationDelay: `${i * 0.12}s` }} />)}
                </div>
                {status === "processing" ? (
                  <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-cream-100 px-4 py-4 text-sm font-semibold text-ink-800" data-testid="voice-processing">
                    <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
                    <span>{tv.processing}</span>
                  </div>
                ) : (
                  <p className="mt-3 min-h-[40px] text-center text-xs text-ink-500"><span>{status === "recording" ? tv.recordingHint : tv.example}</span></p>
                )}
              </>
            )}

            {status === "done" && result && (
              <div className="rounded-2xl border border-cream-200 bg-cream-50 p-3 text-sm" data-testid="voice-summary">
                <p className="text-[11px] font-bold uppercase tracking-wider text-brand-500"><span>{tv.summary}</span></p>
                {result.transkript && (
                  <p className="mt-1 italic text-ink-500" data-testid="voice-transcript">
                    <span>“{result.transkript}”</span>
                  </p>
                )}
                {result.eklenenler.length > 0 && (
                  <ul className="mt-2 space-y-1.5" data-testid="voice-added">
                    {result.eklenenler.map((l) => (
                      <li key={l.id} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                        <span className="flex-1">
                          <span className="font-semibold text-ink-900">{l.adetMetni}</span> <span>{l.isim}</span> <span className="text-ink-500">({l.ambalaj})</span>
                          {l.birimFiyat !== null && <span className="block text-xs text-ink-500">{formatEur(l.birimFiyat, lang)} / {tv.unit}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {result.bulunamayanlar.length > 0 && (
                  <ul className="mt-2 space-y-1" data-testid="voice-missing">
                    {result.bulunamayanlar.map((m, i) => (
                      <li key={i} className="flex items-start gap-2 text-ink-700">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                        <span>{tv.notFound}: {m}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {result.eklenenler.length === 0 && result.bulunamayanlar.length === 0 && <p className="mt-2 text-ink-700"><span>{tv.nothing}</span></p>}
                <p className="mt-2 border-t border-cream-200 pt-2 text-xs text-ink-500">
                  <span>{result.toplamTutar !== null ? `${tv.total}: ${formatEur(result.toplamTutar, lang)} ${tv.exclVat}` : tv.priceNote}</span>
                </p>
              </div>
            )}

            {notice && <p className="mt-2 text-xs font-semibold text-brand-600" role="alert"><span>{notice}</span></p>}
            {detail && <p className="mt-1 break-words font-mono text-[10px] leading-snug text-ink-500" data-testid="voice-detail"><span>{detail}</span></p>}

            {status === "done" ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={goToCart} className="col-span-2 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand-500 text-base font-bold text-white shadow-lg shadow-brand-900/30 hover:bg-brand-600" data-testid="voice-go-cart">
                  <ShoppingCart className="h-5 w-5" />
                  <span>{tv.goCart}</span>
                </button>
                <button type="button" onClick={() => void listenSummary()} className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-cream-200 text-sm font-semibold text-ink-800 hover:bg-cream-100" data-testid="voice-listen">
                  <Volume2 className="h-4 w-4" />
                  <span>{tv.listen}</span>
                </button>
                <button type="button" onClick={reset} className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-cream-200 text-sm font-semibold text-ink-800 hover:bg-cream-100" data-testid="voice-again">
                  <RotateCcw className="h-4 w-4" />
                  <span>{tv.again}</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={toggleRecording}
                disabled={status === "processing" || (config !== null && !config.configured)}
                className={`mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-full text-base font-bold text-white shadow-lg transition select-none disabled:opacity-60 ${listening ? "bg-red-600 shadow-red-900/30" : "bg-brand-500 shadow-brand-900/30 hover:bg-brand-600"}`}
                aria-pressed={listening}
                data-testid="voice-mic"
              >
                {listening ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                <span>{listening ? tv.stop : tv.start}</span>
              </button>
            )}
            <audio ref={audioRef} playsInline preload="none" hidden data-testid="voice-tts-audio" />
          </div>
        </section>
      )}
    </>
  );
}

/** Onay kartı için okunacak özet (istemci tarafı, sözlükten). */
function summaryFor(r: Result, tv: { spokenAdded: string; spokenMissing: string; spokenNothing: string; spokenMore: string }): string {
  if (!r.eklenenler.length) return tv.spokenNothing;
  const list = r.eklenenler.map((l) => `${l.adetMetni} ${l.isim}`).join(", ");
  const missing = r.bulunamayanlar.length ? ` ${tv.spokenMissing} ${r.bulunamayanlar.join(", ")}.` : "";
  return `${tv.spokenAdded} ${list}.${missing} ${tv.spokenMore}`;
}
