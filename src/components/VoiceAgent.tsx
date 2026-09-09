"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, X, Radio, Square } from "lucide-react";
import { useCart } from "@/components/CartProvider";
import { useI18n } from "@/i18n/I18nProvider";

/**
 * Maximus Dijital Plasiyer – sesli sipariş asistanı (prototip).
 *
 * Tarayıcı modu (varsayılan): Web Speech API konuşmayı metne çevirir → POST /api/voice-agent (Claude araç döngüsü)
 * → dönen sepet eylemleri gerçek sepete uygulanır → yanıt speechSynthesis ile seslendirilir.
 * Barge-in: asistan konuşurken müşteri konuşmaya başlarsa seslendirme anında kesilir.
 * Canlı mod: VOICE_API_KEY tanımlıysa mikrofon sesi WebRTC ile sağlayıcıya gider (sinyalleşme /api/voice-agent/webrtc).
 */

type VoiceLang = "tr" | "nl" | "ku";
type Status = "idle" | "listening" | "thinking" | "speaking" | "error" | "unsupported";
type Action = { type: "add"; productId: string; cases: number; units: number } | { type: "remove"; productId: string } | { type: "open_cart" };
type Turn = { text: string; lang: VoiceLang; actions: Action[] };
type Config = { agent: string; greetings: Record<VoiceLang, string>; realtime: boolean };

type SRResultList = ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
type SREvent = { resultIndex: number; results: SRResultList };
type SR = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SREvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SRCtor = new () => SR;

const RECOG_LANG: Record<VoiceLang, string> = { tr: "tr-TR", nl: "nl-BE", ku: "tr-TR" }; // Kürtçe tanıma tarayıcılarda yok; Türkçe motoruyla denenir
const TTS_LANG: Record<VoiceLang, string> = { tr: "tr-TR", nl: "nl-BE", ku: "tr-TR" };

function getRecognition(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, " ").replace(/\s+/g, " ").trim();

/** Tarayıcı API çağrılarını sarar: istisna sayfayı çökertmez, konsola yazılır ve geriye undefined döner. */
function safe<T>(fn: () => T, label: string): T | undefined {
  try {
    return fn();
  } catch (err) {
    console.warn(`[voice-agent] ${label}:`, err);
    return undefined;
  }
}

const isMobile = () => typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

/** Chrome Android sessizlikte/her sonuçta oturumu kapatır; yeniden başlatma gecikmeli ve sınırlı yapılır. */
const RESTART_DELAY_MS = 300;
const MAX_RESTARTS = 8;
const RESTART_WINDOW_MS = 20_000;

export default function VoiceAgent() {
  const cart = useCart();
  const { lang: siteLang, t } = useI18n();
  const tv = t.voice;

  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [voiceLang, setVoiceLang] = useState<VoiceLang>(siteLang);
  const [interim, setInterim] = useState("");
  const [lastUser, setLastUser] = useState("");
  const [lastReply, setLastReply] = useState("");
  const [notice, setNotice] = useState("");
  const [config, setConfig] = useState<Config | null>(null);
  const [live, setLive] = useState(false);

  const recRef = useRef<SR | null>(null);
  const activeRef = useRef(false);
  const speakingRef = useRef(false);
  const busyRef = useRef(false);
  const lastSpokenRef = useRef("");
  const historyRef = useRef<{ role: "user" | "assistant"; text: string }[]>([]);
  const langRef = useRef<VoiceLang>(siteLang);
  const pressRef = useRef<{ at: number; wasActive: boolean } | null>(null);
  const greetedRef = useRef(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const restartsRef = useRef<number[]>([]);
  const restartTimerRef = useRef<number | null>(null);

  const setLang = useCallback((l: VoiceLang) => {
    langRef.current = l;
    setVoiceLang(l);
  }, []);

  /** Yanıtı seslendirir; bitince dinlemeye döner. */
  const speak = useCallback(
    (text: string, l: VoiceLang) =>
      new Promise<void>((resolve) => {
        const done = () => {
          speakingRef.current = false;
          setStatus(activeRef.current ? "listening" : "idle");
          resolve();
        };
        try {
          if (typeof window === "undefined" || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") return done();
          const synth = window.speechSynthesis;
          synth.cancel();
          const u = new SpeechSynthesisUtterance(text);
          u.lang = TTS_LANG[l];
          const voices = safe(() => synth.getVoices(), "getVoices") ?? [];
          const v = voices.find((x) => x.lang?.toLowerCase().startsWith(TTS_LANG[l].toLowerCase())) ?? voices.find((x) => x.lang?.toLowerCase().startsWith(TTS_LANG[l].slice(0, 2)));
          if (v) u.voice = v;
          u.rate = 1.02;
          lastSpokenRef.current = norm(text);
          u.onstart = () => {
            speakingRef.current = true;
            setStatus("speaking");
          };
          u.onend = done;
          u.onerror = done;
          synth.speak(u);
          // Bazı mobil tarayıcılar onend göndermez; güvenlik zamanlayıcısı
          window.setTimeout(() => speakingRef.current && done(), Math.min(20_000, 2_000 + text.length * 90));
        } catch (err) {
          console.warn("[voice-agent] seslendirme:", err);
          done();
        }
      }),
    [],
  );

  /** Sunucudan gelen sepet eylemlerini gerçek sepete uygular (addToCart). */
  const applyActions = useCallback(
    (actions: Action[]) => {
      for (const a of actions) {
        try {
          if (a.type === "add") {
            const ex = cart.lines.find((l) => l.productId === a.productId);
            cart.setQuantity(a.productId, (ex?.cases ?? 0) + a.cases, (ex?.units ?? 0) + a.units);
          } else if (a.type === "remove") cart.remove(a.productId);
          else if (a.type === "open_cart") cart.open();
        } catch (err) {
          console.warn("[voice-agent] sepet eylemi:", err);
        }
      }
    },
    [cart],
  );

  const handleUtterance = useCallback(
    async (text: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setLastUser(text);
      setInterim("");
      setStatus("thinking");
      setNotice("");
      try {
        const res = await fetch("/api/voice-agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: text, lang: langRef.current, history: historyRef.current.slice(-10), cart: cart.lines }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const turn = (await res.json()) as Turn;
        historyRef.current = [...historyRef.current, { role: "user" as const, text }, { role: "assistant" as const, text: turn.text }].slice(-12);
        applyActions(turn.actions ?? []);
        if (turn.lang && turn.lang !== langRef.current) {
          setLang(turn.lang);
          safe(() => {
            if (recRef.current) recRef.current.lang = RECOG_LANG[turn.lang];
          }, "lang değişimi");
        }
        setLastReply(turn.text);
        busyRef.current = false;
        await speak(turn.text, turn.lang ?? langRef.current);
      } catch {
        busyRef.current = false;
        setNotice(tv.error);
        setStatus(activeRef.current ? "listening" : "error");
      }
    },
    [applyActions, cart.lines, setLang, speak, tv.error],
  );

  const stopListening = useCallback(() => {
    activeRef.current = false;
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    const r = recRef.current;
    recRef.current = null;
    if (r) {
      r.onresult = null;
      r.onend = null;
      r.onerror = null;
      safe(() => r.abort(), "abort");
    }
    setInterim("");
    if (!speakingRef.current) setStatus("idle");
  }, []);

  const startListening = useCallback(() => {
    const Ctor = getRecognition();
    if (!Ctor) {
      setStatus("unsupported");
      setNotice(tv.unsupported);
      return;
    }
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      setNotice(tv.insecure);
      setStatus("error");
      return;
    }
    if (recRef.current) return;
    const r = safe(() => new Ctor(), "SpeechRecognition oluşturma");
    if (!r) {
      setNotice(tv.unavailable);
      setStatus("error");
      return;
    }
    const mobile = isMobile();
    safe(() => {
      r.lang = RECOG_LANG[langRef.current];
      // Chrome Android'de continuous modu kararsız: kısa oturumlar açıp aktifken yeniden başlatıyoruz
      r.continuous = !mobile;
      r.interimResults = true;
    }, "SpeechRecognition ayarları");

    r.onresult = (e) => {
      try {
        let finalText = "";
        let interimText = "";
        const results = e?.results;
        const start = typeof e?.resultIndex === "number" ? e.resultIndex : 0;
        for (let i = start; results && i < results.length; i++) {
          const res = results[i];
          const tr = res?.[0]?.transcript ?? "";
          if (res?.isFinal) finalText += tr;
          else interimText += tr;
        }
        // Barge-in: müşteri konuşmaya başladı, asistanı sustur
        if ((finalText || interimText) && speakingRef.current) {
          safe(() => window.speechSynthesis?.cancel(), "cancel");
          speakingRef.current = false;
          setStatus("listening");
        }
        if (interimText) setInterim(interimText);
        const clean = finalText.trim();
        if (!clean) return;
        // Yankı koruması: kendi söylediğimizi mikrofondan geri duymuş olabiliriz
        const n = norm(clean);
        if (n.length > 6 && lastSpokenRef.current && (lastSpokenRef.current.includes(n) || n.includes(lastSpokenRef.current))) return;
        void handleUtterance(clean);
      } catch (err) {
        console.warn("[voice-agent] onresult:", err);
      }
    };

    r.onerror = (e) => {
      const code = e?.error ?? "";
      if (code === "not-allowed" || code === "service-not-allowed") {
        stopListening();
        setNotice(tv.micDenied);
        setStatus("error");
      } else if (code === "audio-capture") {
        stopListening();
        setNotice(tv.noMic);
        setStatus("error");
      } else if (code === "network") {
        stopListening();
        setNotice(tv.error);
        setStatus("error");
      } else if (code === "language-not-supported") {
        safe(() => {
          r.lang = "tr-TR";
        }, "lang fallback");
      }
      // "no-speech" ve "aborted": onend ile yeniden başlatılır
    };

    r.onend = () => {
      if (!activeRef.current || recRef.current !== r) return;
      const now = Date.now();
      restartsRef.current = restartsRef.current.filter((t) => now - t < RESTART_WINDOW_MS);
      if (restartsRef.current.length >= MAX_RESTARTS) {
        // Motor sürekli kapanıyor (izin/donanım sorunu); döngüye girmeden nazikçe dur
        stopListening();
        setNotice(tv.restartFailed);
        setStatus("error");
        return;
      }
      restartsRef.current.push(now);
      restartTimerRef.current = window.setTimeout(() => {
        restartTimerRef.current = null;
        if (!activeRef.current || recRef.current !== r) return;
        const ok = safe(() => {
          r.start();
          return true;
        }, "yeniden başlatma");
        if (!ok) {
          stopListening();
          setNotice(tv.restartFailed);
          setStatus("error");
        }
      }, RESTART_DELAY_MS);
    };

    recRef.current = r;
    activeRef.current = true;
    restartsRef.current = [];
    setNotice("");
    setStatus("listening");
    const started = safe(() => {
      r.start();
      return true;
    }, "start");
    if (!started) {
      stopListening();
      setNotice(tv.unavailable);
      setStatus("error");
    }
  }, [handleUtterance, stopListening, tv.error, tv.insecure, tv.micDenied, tv.noMic, tv.restartFailed, tv.unavailable, tv.unsupported]);

  /** Panel açılınca yapılandırmayı al ve karşılama cümlesini söyle. */
  useEffect(() => {
    if (!open || greetedRef.current) return;
    greetedRef.current = true;
    fetch("/api/voice-agent")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((c: Config) => {
        setConfig(c);
        const g = c?.greetings?.[langRef.current] ?? c?.greetings?.tr;
        if (g) {
          setLastReply(g);
          historyRef.current = [{ role: "assistant", text: g }];
          void speak(g, langRef.current);
        }
      })
      .catch(() => setNotice(tv.error));
  }, [open, speak, tv.error]);

  // Escape ile kapat; kapanınca dinlemeyi ve konuşmayı durdur
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const closePanel = useCallback(() => {
    stopListening();
    safe(() => window.speechSynthesis?.cancel(), "cancel");
    speakingRef.current = false;
    safe(() => pcRef.current?.close(), "pc.close");
    pcRef.current = null;
    setLive(false);
    setOpen(false);
  }, [stopListening]);

  // Bileşen kaldırılırken (sayfa geçişi) mikrofon, seslendirme ve WebRTC bağlantısını bırak
  useEffect(
    () => () => {
      activeRef.current = false;
      if (restartTimerRef.current !== null) window.clearTimeout(restartTimerRef.current);
      safe(() => recRef.current?.abort(), "abort");
      recRef.current = null;
      safe(() => window.speechSynthesis?.cancel(), "cancel");
      safe(() => pcRef.current?.close(), "pc.close");
      pcRef.current = null;
    },
    [],
  );

  // Bas-konuş (uzun basış) veya tıkla-dinle (kısa dokunuş)
  const onPressStart = () => {
    pressRef.current = { at: Date.now(), wasActive: activeRef.current };
    if (!activeRef.current) safe(startListening, "startListening");
  };
  const onPressEnd = () => {
    const p = pressRef.current;
    pressRef.current = null;
    if (!p) return;
    const held = Date.now() - p.at > 450;
    if (held || p.wasActive) safe(stopListening, "stopListening");
  };

  /** Canlı ses: WebRTC ile sağlayıcıya bağlan (VOICE_API_KEY tanımlıysa). */
  const startLive = useCallback(async () => {
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      setNotice(tv.insecure);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") {
      setNotice(tv.unsupported);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      stream.getTracks().forEach((tr) => pc.addTrack(tr, stream));
      pc.ontrack = (e) => {
        safe(() => {
          if (audioRef.current) {
            audioRef.current.srcObject = e.streams[0];
            void audioRef.current.play?.().catch(() => undefined);
          }
        }, "ontrack");
      };
      const dc = pc.createDataChannel("events");
      dc.onmessage = (m) => {
        // Sağlayıcı olay uyarlayıcısı: transkript ve araç çağrılarını ortak biçime çevirir
        try {
          const ev = JSON.parse(m.data as string) as { type?: string; transcript?: string; text?: string; name?: string; arguments?: string };
          if (ev.type && /transcript/.test(ev.type) && (ev.transcript || ev.text)) setLastUser(ev.transcript ?? ev.text ?? "");
          if (ev.type && /function_call|tool_call/.test(ev.type) && ev.name === "add_to_cart" && ev.arguments) {
            const a = JSON.parse(ev.arguments) as { productId: string; cases?: number; units?: number };
            applyActions([{ type: "add", productId: a.productId, cases: a.cases ?? 0, units: a.units ?? 0 }]);
          }
        } catch {
          /* metin olay */
        }
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const res = await fetch("/api/voice-agent/webrtc", { method: "POST", headers: { "Content-Type": "application/sdp" }, body: offer.sdp });
      if (!res.ok) throw new Error(String(res.status));
      await pc.setRemoteDescription({ type: "answer", sdp: await res.text() });
      setLive(true);
      setStatus("listening");
    } catch (err) {
      console.warn("[voice-agent] canlı ses:", err);
      safe(() => pcRef.current?.close(), "pc.close");
      pcRef.current = null;
      setLive(false);
      const name = (err as { name?: string })?.name ?? "";
      setNotice(name === "NotAllowedError" || name === "SecurityError" ? tv.micDenied : name === "NotFoundError" || name === "OverconstrainedError" ? tv.noMic : tv.error);
    }
  }, [applyActions, tv.error, tv.insecure, tv.micDenied, tv.noMic, tv.unsupported]);

  const stopLive = useCallback(() => {
    safe(() => pcRef.current?.close(), "pc.close");
    pcRef.current = null;
    setLive(false);
    setStatus("idle");
  }, []);

  const statusLabel = { idle: tv.idle, listening: tv.listening, thinking: tv.thinking, speaking: tv.speaking, error: tv.idle, unsupported: tv.idle }[status];
  const listening = status === "listening";

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-[45] flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-xl shadow-brand-900/30 transition hover:scale-105 hover:bg-brand-600 sm:h-16 sm:w-16"
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
          className="fixed bottom-4 right-4 z-[45] w-[min(92vw,360px)] overflow-hidden rounded-3xl border border-cream-200 bg-white shadow-2xl"
          role="dialog"
          aria-label={tv.name}
          data-testid="voice-panel"
        >
          <header className="flex items-center justify-between bg-ink-900 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500"><Mic className="h-4 w-4" /></span>
              <div>
                <p className="text-sm font-bold leading-tight">{config?.agent ?? tv.name}</p>
                <p className="text-[11px] text-cream-100/70" data-testid="voice-status">
                  {statusLabel} · <span className="uppercase" data-testid="voice-lang">{voiceLang}</span>
                </p>
              </div>
            </div>
            <button type="button" onClick={closePanel} className="rounded-full p-1.5 text-cream-100/80 hover:bg-white/10 hover:text-white" aria-label={tv.close} data-testid="voice-close">
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="px-4 pb-4 pt-3">
            <div className={`voice-wave voice-wave--${status}`} aria-hidden>
              {[0, 1, 2, 3, 4].map((i) => <span key={i} style={{ animationDelay: `${i * 0.12}s` }} />)}
            </div>

            <div className="mt-3 min-h-[72px] space-y-2 text-sm">
              {lastReply && (
                <p className="rounded-2xl rounded-tl-sm bg-cream-100 px-3 py-2 text-ink-900" data-testid="voice-reply">{lastReply}</p>
              )}
              {(interim || lastUser) && (
                <p className={`ml-8 rounded-2xl rounded-tr-sm px-3 py-2 ${interim ? "bg-brand-50 text-ink-500 italic" : "bg-brand-500 text-white"}`} data-testid="voice-user">{interim || lastUser}</p>
              )}
              {!lastReply && !lastUser && <p className="text-xs text-ink-500">{tv.hint}</p>}
            </div>

            {notice && <p className="mt-2 text-xs font-semibold text-brand-600" role="alert">{notice}</p>}

            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onPointerDown={onPressStart}
                onPointerUp={onPressEnd}
                onPointerCancel={onPressEnd}
                onPointerLeave={() => pressRef.current && onPressEnd()}
                className={`flex h-14 flex-1 items-center justify-center gap-2 rounded-full text-base font-bold text-white shadow-lg transition select-none ${listening ? "bg-red-600 shadow-red-900/30" : "bg-brand-500 shadow-brand-900/30 hover:bg-brand-600"}`}
                aria-pressed={listening}
                aria-label={listening ? tv.stop : tv.tap}
                data-testid="voice-mic"
                disabled={live}
              >
                {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                {listening ? tv.stop : tv.tap}
              </button>
              {config?.realtime && (
                <button
                  type="button"
                  onClick={live ? stopLive : startLive}
                  className={`flex h-14 items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${live ? "border-red-600 text-red-600" : "border-cream-200 text-ink-800 hover:border-ink-300"}`}
                  aria-pressed={live}
                  title={tv.live}
                >
                  {live ? <Square className="h-4 w-4" /> : <Radio className="h-4 w-4" />}
                  {tv.live}
                </button>
              )}
            </div>
            <p className="mt-2 text-center text-[11px] text-ink-500">{tv.hold} · {tv.tap}</p>
            <audio ref={audioRef} autoPlay hidden />
          </div>
        </section>
      )}
    </>
  );
}
