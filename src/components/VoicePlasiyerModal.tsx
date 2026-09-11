"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Mic, MicOff, PhoneOff, X, ShoppingCart, Loader2, Radio, Hand } from "lucide-react";
import { useCart } from "@/components/CartProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { describeError, logClientError } from "@/components/VoiceAgentBoundary";
import { useLiveVoice, type LiveState } from "@/hooks/useLiveVoice";
import VoiceAgent from "@/components/VoiceAgent";

/**
 * Maximus Dijital Plasiyer — GPT-Live canlı sesli asistan penceresi.
 *   "Canlı görüşme" sekmesi: WebRTC ile uçtan uca ses (useLiveVoice); durumlar Dinliyor / Düşünüyor / Konuşuyor,
 *   canlı dalga formu, altyazı ve araç (sepet) işlemleri.
 *   "Bas-konuş" sekmesi: Live kapalıysa ya da tarayıcı WebRTC desteklemiyorsa Hızlı Sesli Sipariş (VoiceAgent) yedeği.
 * Tüm metinler <span> içinde ve notranslate: Google Translate DOM'u değiştirip React'i bozmasın.
 */

type Config = { configured: boolean; tts: boolean; maxSeconds: number; live: boolean; liveModel?: string };
type Tab = "live" | "push";

const BARS = [0.55, 0.85, 1, 0.75, 0.5];

export default function VoicePlasiyerModal() {
  const cart = useCart();
  const { lang, t } = useI18n();
  const tl = t.live;
  const tv = t.voice;

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [notice, setNotice] = useState("");
  const [detail, setDetail] = useState("");

  const onError = useCallback(
    (where: string, err: unknown) => {
      const name = (err as { name?: string })?.name ?? "";
      setDetail(`${where} → ${describeError(err)}`);
      logClientError(`live:${where}`, err);
      if (where === "unsupported") setNotice(tl.unsupported);
      else if (where === "insecure") setNotice(tv.insecure);
      else if (name === "NotAllowedError" || name === "SecurityError") setNotice(tl.micDenied);
      else if (name === "NotFoundError" || name === "OverconstrainedError") setNotice(tv.noMic);
      else if (where === "connect" && /503|live-not-configured/.test(String((err as Error)?.message ?? ""))) setNotice(tl.notConfigured);
      else if (where === "connect" || where === "datachannel") setNotice(tl.error);
    },
    [tl.error, tl.micDenied, tl.notConfigured, tl.unsupported, tv.insecure, tv.noMic],
  );

  const cartApi = useMemo(() => ({ lines: cart.lines, setQuantity: cart.setQuantity, open: cart.open }), [cart.lines, cart.setQuantity, cart.open]);
  const live = useLiveVoice({ lang, cart: cartApi, onError });
  const { state, lines, tools, muted, level, closeReason, audioRef, start, stop, toggleMute, active } = live;

  /** Pencere açılınca yapılandırmayı al ve varsayılan sekmeyi seç (Live açıksa canlı görüşme). */
  useEffect(() => {
    if (!open || config) return;
    fetch("/api/voice-agent")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((c: Config) => {
        setConfig(c);
        setTab((cur) => cur ?? (c.live ? "live" : "push"));
        if (!c.live) setNotice(tl.notConfigured);
      })
      .catch((err) => {
        setConfig({ configured: false, tts: false, maxSeconds: 30, live: false });
        setTab((cur) => cur ?? "push");
        setDetail(`config → ${describeError(err)}`);
      });
  }, [open, config, tl.notConfigured]);

  const closeModal = useCallback(() => {
    stop("close_requested");
    setOpen(false);
  }, [stop]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeModal();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeModal]);

  const begin = () => {
    setNotice(config && !config.live ? tl.notConfigured : "");
    setDetail("");
    if (config && !config.live) return;
    void start();
  };

  const goToCart = () => {
    closeModal();
    cart.open();
  };

  const stateLabel: Record<LiveState, string> = {
    idle: tl.idle,
    connecting: tl.connecting,
    listening: muted ? tl.muted : tl.listening,
    thinking: tl.thinking,
    speaking: tl.speaking,
    error: tl.error,
  };
  const endedText = !active && closeReason ? ({ idle_timeout: tl.endedIdle, max_duration: tl.endedMax, connection_lost: tl.endedLost, expired: tl.endedMax } as Record<string, string>)[closeReason] ?? tl.ended : "";
  const waveClass = state === "speaking" ? "voice-wave--speaking" : state === "thinking" || state === "connecting" ? "voice-wave--thinking" : state === "listening" && !muted ? "voice-wave--listening" : "";

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="notranslate fixed bottom-5 right-5 z-[45] flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-xl shadow-brand-900/30 transition hover:scale-105 hover:bg-brand-600 sm:h-16 sm:w-16"
          translate="no"
          aria-label={tl.open}
          title={tl.name}
          data-testid="voice-open"
        >
          <Mic className="h-6 w-6 sm:h-7 sm:w-7" />
          <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-brand-500/40" aria-hidden />
        </button>
      )}

      {open && (
        <section
          className="notranslate fixed bottom-4 right-4 z-[45] w-[min(92vw,400px)] overflow-hidden rounded-3xl border border-cream-200 bg-white shadow-2xl"
          translate="no"
          role="dialog"
          aria-label={tl.name}
          data-testid="voice-panel"
        >
          <header className="notranslate flex items-center justify-between bg-ink-900 px-4 py-3 text-white" translate="no">
            <div className="flex items-center gap-2">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full ${active ? "bg-green-600" : "bg-brand-500"}`}>
                {state === "connecting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
              </span>
              <div>
                <p className="text-sm font-bold leading-tight"><span>{tl.name}</span></p>
                <p className="text-[11px] text-cream-100/70" data-testid="live-status"><span>{tab === "live" ? stateLabel[state] : tv.name}</span></p>
              </div>
            </div>
            <button type="button" onClick={closeModal} className="rounded-full p-1.5 text-cream-100/80 hover:bg-white/10 hover:text-white" aria-label={tv.close} data-testid="voice-close">
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="notranslate grid grid-cols-2 border-b border-cream-200 bg-cream-50 text-xs font-bold" translate="no" role="tablist">
            {(["live", "push"] as Tab[]).map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={tab === k}
                onClick={() => {
                  if (k !== "live") stop("close_requested");
                  setTab(k);
                }}
                className={`flex items-center justify-center gap-1.5 py-2.5 ${tab === k ? "border-b-2 border-brand-500 text-brand-600" : "text-ink-500 hover:text-ink-800"}`}
                data-testid={`voice-tab-${k}`}
              >
                {k === "live" ? <Radio className="h-3.5 w-3.5" /> : <Hand className="h-3.5 w-3.5" />}
                <span>{k === "live" ? tl.tabLive : tl.tabPush}</span>
              </button>
            ))}
          </div>

          {tab === null && (
            <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-ink-500" data-testid="voice-loading">
              <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
              <span>{tl.connecting}</span>
            </div>
          )}

          {tab === "push" && <VoiceAgent embedded onClose={() => setOpen(false)} />}

          {tab === "live" && (
            <div className="notranslate px-4 pb-4 pt-3" translate="no" data-testid="live-panel">
              <div className={`voice-wave ${waveClass}`} aria-hidden data-testid="live-wave">
                {BARS.map((b, i) => (
                  <span key={i} style={state === "listening" && !muted ? { height: `${8 + Math.round(level * 30 * b)}px`, animation: "none" } : { animationDelay: `${i * 0.12}s` }} />
                ))}
              </div>

              <div className="mt-2 max-h-44 space-y-1.5 overflow-y-auto rounded-2xl border border-cream-200 bg-cream-50 p-3 text-sm" data-testid="live-captions" aria-live="polite">
                {lines.length === 0 ? (
                  <p className="text-center text-xs text-ink-500">
                    <span>{active ? stateLabel[state] : endedText || tl.idle}</span>
                    {!active && <span className="mt-1 block">{tl.example}</span>}
                  </p>
                ) : (
                  lines.map((l, i) => (
                    <p key={i} className={l.role === "user" ? "text-ink-700" : "font-semibold text-ink-900"}>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-500">{l.role === "user" ? tl.you : tl.assistant}</span>{" "}
                      <span>{l.text}</span>
                    </p>
                  ))
                )}
              </div>

              {endedText && lines.length > 0 && <p className="mt-2 text-center text-xs text-ink-500" data-testid="live-ended"><span>{endedText}</span></p>}

              {tools.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5" data-testid="live-tools">
                  {tools.map((x, i) => (
                    <span key={i} className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                      <span>{x.summary}</span>
                    </span>
                  ))}
                </div>
              )}

              {notice && <p className="mt-2 text-xs font-semibold text-brand-600" role="alert"><span>{notice}</span></p>}
              {detail && <p className="mt-1 break-words font-mono text-[10px] leading-snug text-ink-500" data-testid="live-detail"><span>{detail}</span></p>}

              {!active ? (
                <button
                  type="button"
                  onClick={begin}
                  disabled={config !== null && !config.live}
                  className="mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-brand-500 text-base font-bold text-white shadow-lg shadow-brand-900/30 transition select-none hover:bg-brand-600 disabled:opacity-60"
                  data-testid="live-start"
                >
                  <Mic className="h-5 w-5" />
                  <span>{tl.start}</span>
                </button>
              ) : (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={toggleMute}
                    className={`flex h-12 items-center justify-center gap-1.5 rounded-full text-sm font-bold ${muted ? "bg-ink-900 text-white" : "border border-cream-200 text-ink-800 hover:bg-cream-100"}`}
                    aria-pressed={muted}
                    aria-label={muted ? tl.unmute : tl.mute}
                    data-testid="live-mute"
                  >
                    {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </button>
                  <button type="button" onClick={goToCart} className="flex h-12 items-center justify-center gap-1.5 rounded-full border border-cream-200 text-sm font-bold text-ink-800 hover:bg-cream-100" aria-label={tl.goCart} data-testid="live-go-cart">
                    <ShoppingCart className="h-4 w-4" />
                    {cart.lines.length > 0 && <span className="rounded-full bg-brand-500 px-1.5 text-[10px] text-white">{cart.lines.length}</span>}
                  </button>
                  <button type="button" onClick={() => stop("close_requested")} className="flex h-12 items-center justify-center gap-1.5 rounded-full bg-red-600 text-sm font-bold text-white shadow-lg shadow-red-900/30 hover:bg-red-700" aria-label={tl.end} data-testid="live-end">
                    <PhoneOff className="h-4 w-4" />
                  </button>
                </div>
              )}
              <audio ref={audioRef} autoPlay playsInline hidden data-testid="live-audio" />
            </div>
          )}
        </section>
      )}
    </>
  );
}
