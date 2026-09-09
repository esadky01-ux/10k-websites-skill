"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, X, Radio, Square, Disc, Volume2 } from "lucide-react";
import { useCart } from "@/components/CartProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { describeError, logClientError } from "@/components/VoiceAgentBoundary";

/**
 * Maximus Dijital Plasiyer – sesli sipariş asistanı (prototip).
 *
 * Tarayıcı modu (varsayılan): Web Speech API konuşmayı metne çevirir → POST /api/voice-agent (Claude araç döngüsü)
 * → dönen sepet eylemleri gerçek sepete uygulanır → yanıt sunucu TTS (OpenAI, mp3) ile seslendirilir;
 *   TTS yapılandırılmamışsa veya hata verirse tarayıcının speechSynthesis sesine düşer.
 * Barge-in: asistan konuşurken müşteri konuşmaya başlarsa seslendirme anında kesilir.
 * Canlı mod: VOICE_API_KEY tanımlıysa mikrofon sesi WebRTC ile sağlayıcıya gider (sinyalleşme /api/voice-agent/webrtc).
 */

type VoiceLang = "tr" | "nl" | "ku";
type Status = "idle" | "listening" | "thinking" | "speaking" | "error" | "unsupported";
type Action = { type: "add"; productId: string; cases: number; units: number } | { type: "remove"; productId: string } | { type: "open_cart" };
type Turn = { text: string; lang: VoiceLang; actions: Action[] };
type Config = { agent: string; greetings: Record<VoiceLang, string>; realtime: boolean; stt: boolean; tts: boolean };
type Mode = "speech" | "recorder";

type SRResultList = ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
type SREvent = { resultIndex: number; results: SRResultList };
type SR = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SREvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onsoundstart: (() => void) | null;
  onspeechstart: (() => void) | null;
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

/** Chrome Android sessizlikte/her sonuçta oturumu kapatır; yeniden başlatma gecikmeli yapılır. */
const RESTART_DELAY_MS = 300;
/** Bu süreden kısa yaşayan oturumlar "hızlı kapanma" sayılır; art arda bu kadar olursa motor bozuk kabul edilir. */
const FAST_END_MS = 1_500;
const MAX_FAST_ENDS = 5;
/** Ses algılandı ama bu süre içinde sonuç gelmediyse motor bozuk sayılır → kayıt yedeği. */
const NO_RESULT_AFTER_SOUND_MS = 10_000;
/** Hiç ses algılanmadan geçen üst sınır (kullanıcı sessiz olabilir; yalnızca motor sürekli kapanıyorsa geçilir). */
const NO_RESULT_HARD_MS = 60_000;
const WATCHDOG_MS = 2_500;
/** Asistan konuştuktan sonra bu süre içinde gelen ve söylenenle neredeyse aynı olan metin yankı sayılır. */
const ECHO_WINDOW_MS = 1_500;
/** Mobil tarayıcılarda ses çalma ve tanıma aynı anda ses odağı için yarışır: yarı çift yönlü çalışırız. */
const HALF_DUPLEX = () => isMobile();
const STT_LANG: Record<VoiceLang, string> = { tr: "tr", nl: "nl", ku: "ku" };

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", "audio/ogg"]) {
    if (safe(() => MediaRecorder.isTypeSupported(m), "isTypeSupported")) return m;
  }
  return "";
}

/** Kullanıcı dokunuşunda ses kilidini açmak için 0,1 sn sessiz WAV. */
const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";

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
  const lastReplyRef = useRef("");
  const [notice, setNotice] = useState("");
  const [config, setConfig] = useState<Config | null>(null);
  const [live, setLive] = useState(false);
  const [detail, setDetail] = useState("");
  const [mode, setMode] = useState<Mode>("speech");
  const [recording, setRecording] = useState(false);

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
  const restartTimerRef = useRef<number | null>(null);
  const noResultTimerRef = useRef<number | null>(null);
  const gotResultRef = useRef(false);
  const heardAtRef = useRef(0);
  const sessionStartRef = useRef(0);
  const fastEndsRef = useRef(0);
  const firstStartRef = useRef(0);
  const speechEndedAtRef = useRef(0);
  const audioUnlockedRef = useRef(false);
  const pendingAudioRef = useRef<{ url: string; text: string; lang: VoiceLang } | null>(null);
  const pausedForSpeechRef = useRef(false);
  const startListeningRef = useRef<() => void>(() => undefined);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const configRef = useRef<Config | null>(null);
  const modeRef = useRef<Mode>("speech");
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsUrlRef = useRef<string | null>(null);

  /** Yakalanan hatayı kullanıcıya küçük puntoyla gösterir ve sunucu loguna yazar. */
  const report = useCallback((where: string, err: unknown) => {
    console.warn(`[voice-agent] ${where}:`, err);
    setDetail(`${where} → ${describeError(err)}`);
    logClientError(where, err);
  }, []);

  const setLang = useCallback((l: VoiceLang) => {
    langRef.current = l;
    setVoiceLang(l);
  }, []);

  /**
   * Mobil otomatik oynatma kilidi: kullanıcı dokunuşu içinde ses öğesini sessiz bir WAV ile bir kez çalıştırırız;
   * sonrasında fetch ile gelen mp3'ler aynı öğe üzerinden gesture olmadan çalabilir. speechSynthesis de ısıtılır.
   */
  const unlockAudio = useCallback(() => {
    if (audioUnlockedRef.current) return;
    const el = ttsAudioRef.current;
    if (el) {
      safe(() => {
        el.muted = false;
        el.volume = 1;
        el.src = SILENT_WAV;
        const pr = el.play();
        if (pr && typeof pr.then === "function") {
          pr.then(() => {
            audioUnlockedRef.current = true;
            el.pause();
          }).catch((err: unknown) => report("audio.unlock", err));
        } else audioUnlockedRef.current = true;
      }, "audio.unlock");
    }
    safe(() => {
      const synth = window.speechSynthesis;
      if (synth) {
        synth.resume();
        synth.getVoices();
      }
    }, "synth.warmup");
  }, [report]);

  /** Mobilde konuşma sırasında tanımayı duraklat (ses odağı çatışması); konuşma bitince geri başlat. */
  const pauseListeningForSpeech = useCallback(() => {
    if (!HALF_DUPLEX() || !activeRef.current || !recRef.current) return;
    pausedForSpeechRef.current = true;
    const r = recRef.current;
    recRef.current = null;
    r.onresult = null;
    r.onend = null;
    r.onerror = null;
    safe(() => r.abort(), "abort");
    if (noResultTimerRef.current !== null) {
      window.clearInterval(noResultTimerRef.current);
      noResultTimerRef.current = null;
    }
  }, []);
  const resumeListeningAfterSpeech = useCallback(() => {
    if (!pausedForSpeechRef.current) return;
    pausedForSpeechRef.current = false;
    if (!activeRef.current) return;
    activeRef.current = false; // startListening yeniden true yapar
    window.setTimeout(() => startListeningRef.current(), 150);
  }, []);

  /** Konuşmayı durdurur (barge-in, kapatma): sunucu sesi ve tarayıcı sesi. */
  const stopSpeaking = useCallback(() => {
    safe(() => {
      const a = ttsAudioRef.current;
      if (a) {
        a.pause();
        a.removeAttribute("src");
        a.load();
      }
    }, "audio.pause");
    if (ttsUrlRef.current) {
      safe(() => URL.revokeObjectURL(ttsUrlRef.current as string), "revokeObjectURL");
      ttsUrlRef.current = null;
    }
    safe(() => window.speechSynthesis?.cancel(), "cancel");
    speakingRef.current = false;
  }, []);

  /** Tarayıcının kendi sesi (yedek). */
  const speakBrowser = useCallback(
    (text: string, l: VoiceLang) =>
      new Promise<void>((resolve) => {
        const startedAt = Date.now();
        let started = false;
        const done = () => {
          speakingRef.current = false;
          speechEndedAtRef.current = Date.now();
          // Android Chrome bazen hiç konuşmadan anında "bitti" der; kullanıcıya belli et
          if (!started || (text.length > 20 && Date.now() - startedAt < 300)) setAudioBlocked(true);
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
          u.onstart = () => {
            started = true;
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

  /** mp3 URL'sini panel içindeki <audio> ile çalar; oynatma reddedilirse "Sesi aç" düğmesi için bekletir. */
  const playUrl = useCallback(
    (url: string, text: string, l: VoiceLang) =>
      new Promise<boolean>((resolve) => {
        const el = ttsAudioRef.current;
        if (!el) return resolve(false);
        let settled = false;
        let playedOk = false;
        const done = () => {
          if (settled) return;
          settled = true;
          speakingRef.current = false;
          speechEndedAtRef.current = Date.now();
          if (ttsUrlRef.current === url) {
            safe(() => URL.revokeObjectURL(url), "revokeObjectURL");
            ttsUrlRef.current = null;
          }
          setStatus(activeRef.current ? "listening" : "idle");
          resolve(playedOk);
        };
        el.onplay = () => {
          playedOk = true;
          speakingRef.current = true;
          setAudioBlocked(false);
          setStatus("speaking");
        };
        el.onended = done;
        el.onerror = done;
        el.onpause = () => {
          if (el.ended || !el.src) done();
        };
        ttsUrlRef.current = url;
        el.muted = false;
        el.volume = 1;
        el.src = url;
        el.play().catch((err: unknown) => {
          // Otomatik oynatma engeli: sesi bekletip kullanıcıya "Sesi aç" düğmesi göster
          report("audio.play", err);
          pendingAudioRef.current = { url, text, lang: l };
          ttsUrlRef.current = null;
          setAudioBlocked(true);
          settled = true;
          speakingRef.current = false;
          setStatus(activeRef.current ? "listening" : "idle");
          resolve(false);
        });
        window.setTimeout(done, Math.min(45_000, 3_000 + text.length * 120));
      }),
    [report],
  );

  /** Sunucu TTS (OpenAI mp3) ile seslendirir; başarısızsa tarayıcı sesine düşer. Bitince dinlemeye döner. */
  const speak = useCallback(
    async (text: string, l: VoiceLang) => {
      lastSpokenRef.current = norm(text);
      stopSpeaking();
      pauseListeningForSpeech();
      try {
        const el = ttsAudioRef.current;
        if (!configRef.current?.tts || !el) {
          await speakBrowser(text, l);
          return;
        }
        try {
          const res = await fetch("/api/voice-agent/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, lang: l }) });
          if (!res.ok) {
            const body = (await res.json().catch(() => ({}))) as { detail?: string };
            throw new Error(`tts ${res.status}${body.detail ? ` (${body.detail})` : ""}`);
          }
          const blob = await res.blob();
          if (blob.size < 200) throw new Error(`tts empty audio (${blob.size} bytes)`);
          const url = URL.createObjectURL(blob);
          const ok = await playUrl(url, text, l);
          if (!ok && !pendingAudioRef.current) await speakBrowser(text, l);
        } catch (err) {
          report("tts", err);
          await speakBrowser(text, l);
        }
      } finally {
        resumeListeningAfterSpeech();
      }
    },
    [pauseListeningForSpeech, playUrl, report, resumeListeningAfterSpeech, speakBrowser, stopSpeaking],
  );

  /** "Sesi aç": kullanıcı dokunuşu içinde bekleyen sesi çalar (otomatik oynatma engeli aşılır). */
  const unmute = useCallback(() => {
    audioUnlockedRef.current = true;
    setAudioBlocked(false);
    const pending = pendingAudioRef.current;
    pendingAudioRef.current = null;
    if (pending) {
      void playUrl(pending.url, pending.text, pending.lang).then((ok) => {
        if (!ok) void speakBrowser(pending.text, pending.lang);
      });
    } else if (lastReplyRef.current) {
      void speak(lastReplyRef.current, langRef.current);
    }
  }, [playUrl, speak, speakBrowser]);

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
        lastReplyRef.current = turn.text;
        busyRef.current = false;
        await speak(turn.text, turn.lang ?? langRef.current);
      } catch (err) {
        busyRef.current = false;
        report("api", err);
        setNotice(tv.error);
        setStatus(activeRef.current ? "listening" : "error");
      }
    },
    [applyActions, cart.lines, report, setLang, speak, tv.error],
  );

  const stopListening = useCallback(() => {
    activeRef.current = false;
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (noResultTimerRef.current !== null) {
      window.clearInterval(noResultTimerRef.current);
      noResultTimerRef.current = null;
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

  /** Kayıt yedeği: MediaRecorder ile ses al, sunucudaki STT servisine gönder, metni aynı tura sok. */
  const stopRecording = useCallback(() => {
    const r = recorderRef.current;
    recorderRef.current = null;
    if (r && r.state !== "inactive") safe(() => r.stop(), "recorder.stop");
    else {
      streamRef.current?.getTracks().forEach((t) => safe(() => t.stop(), "track.stop"));
      streamRef.current = null;
    }
    setRecording(false);
  }, []);

  const uploadRecording = useCallback(
    async (blob: Blob) => {
      if (blob.size < 1000) {
        setNotice(tv.noSpeech);
        setStatus("idle");
        return;
      }
      setStatus("thinking");
      setNotice(tv.uploading);
      try {
        const form = new FormData();
        form.append("audio", blob, "voice.webm");
        form.append("lang", STT_LANG[langRef.current]);
        const res = await fetch("/api/voice-agent/transcribe", { method: "POST", body: form });
        if (res.status === 503) {
          setNotice(tv.sttMissing);
          setStatus("error");
          return;
        }
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
          throw new Error(`transcribe ${res.status}${body.detail ? ` (${body.detail})` : ""}`);
        }
        const { text } = (await res.json()) as { text?: string };
        setNotice("");
        if (!text?.trim()) {
          setNotice(tv.noSpeech);
          setStatus("idle");
          return;
        }
        await handleUtterance(text.trim());
      } catch (err) {
        report("transcribe", err);
        setNotice(tv.error);
        setStatus("error");
      }
    },
    [handleUtterance, report, tv.error, tv.noSpeech, tv.sttMissing, tv.uploading],
  );

  const startRecording = useCallback(async () => {
    if (recorderRef.current) return;
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      setNotice(tv.insecure);
      setStatus("error");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setNotice(tv.unsupported);
      setStatus("unsupported");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
        setNotice(tv.error);
        setStatus("error");
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => safe(() => t.stop(), "track.stop"));
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || mime || "audio/webm" });
        chunksRef.current = [];
        void uploadRecording(blob);
      };
      recorderRef.current = rec;
      rec.start(250);
      stopSpeaking();
      setRecording(true);
      setNotice("");
      setStatus("listening");
      // Güvenlik: 30 sn'den uzun kayıt otomatik biter
      window.setTimeout(() => recorderRef.current === rec && stopRecording(), 30_000);
    } catch (err) {
      report("getUserMedia", err);
      const name = (err as { name?: string })?.name ?? "";
      setNotice(name === "NotAllowedError" || name === "SecurityError" ? tv.micDenied : name === "NotFoundError" || name === "OverconstrainedError" ? tv.noMic : tv.error);
      setStatus("error");
    }
  }, [report, stopRecording, stopSpeaking, tv.error, tv.insecure, tv.micDenied, tv.noMic, tv.unsupported, uploadRecording]);

  /** Web Speech API takıldığında kayıt moduna geç (otomatik). */
  const switchToRecorder = useCallback(
    (why: string, err?: unknown) => {
      if (modeRef.current === "recorder") return;
      if (err !== undefined) report(why, err);
      modeRef.current = "recorder";
      setMode("recorder");
      setNotice(configRef.current && !configRef.current.stt ? tv.sttMissing : tv.recorderHint);
      setStatus("idle");
    },
    [report, tv.recorderHint, tv.sttMissing],
  );

  const startListening = useCallback(() => {
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      setNotice(tv.insecure);
      setStatus("error");
      return;
    }
    const Ctor = getRecognition();
    if (!Ctor) {
      switchToRecorder("SpeechRecognition yok");
      return;
    }
    if (recRef.current) return;
    let r: SR | null = null;
    try {
      r = new Ctor();
    } catch (err) {
      switchToRecorder("SpeechRecognition oluşturma", err);
      return;
    }
    gotResultRef.current = false;
    heardAtRef.current = 0;
    sessionStartRef.current = Date.now();
    firstStartRef.current = Date.now();
    const mobile = isMobile();
    safe(() => {
      r.lang = RECOG_LANG[langRef.current];
      // Chrome Android'de continuous modu kararsız: kısa oturumlar açıp aktifken yeniden başlatıyoruz
      r.continuous = !mobile;
      r.interimResults = true;
    }, "SpeechRecognition ayarları");

    r.onresult = (e) => {
      try {
        gotResultRef.current = true;
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
          stopSpeaking();
          setStatus("listening");
        }
        if (interimText) setInterim(interimText);
        const clean = finalText.trim();
        if (!clean) return;
        // Yankı koruması: yalnızca asistan konuşurken/konuştuktan hemen sonra gelen ve söylenenin neredeyse tamamı olan metin.
        // (Kısa bir "selamünaleyküm" karşılamanın içinde geçse bile müşterinin sözüdür, yok sayılmaz.)
        const n = norm(clean);
        const spoken = lastSpokenRef.current;
        const recentlySpoke = speakingRef.current || Date.now() - speechEndedAtRef.current < ECHO_WINDOW_MS;
        const nearlyWhole = spoken.length > 0 && n.length >= spoken.length * 0.7 && (spoken.includes(n) || n.includes(spoken));
        if (recentlySpoke && nearlyWhole) {
          setInterim("");
          return;
        }
        void handleUtterance(clean);
      } catch (err) {
        report("onresult", err);
      }
    };

    r.onsoundstart = () => {
      if (!heardAtRef.current) heardAtRef.current = Date.now();
    };
    r.onspeechstart = r.onsoundstart;

    r.onerror = (e) => {
      const code = e?.error ?? "";
      if (code === "not-allowed" || code === "service-not-allowed") {
        stopListening();
        setNotice(tv.micDenied);
        setStatus("error");
      } else if (code === "audio-capture" || code === "network") {
        // Motor bu cihazda çalışmıyor → kayıt yedeği
        stopListening();
        switchToRecorder(`SpeechRecognition ${code}`, new Error(code));
      } else if (code === "language-not-supported") {
        safe(() => {
          r.lang = "tr-TR";
        }, "lang fallback");
      }
      // "no-speech" ve "aborted": onend ile yeniden başlatılır
    };

    r.onend = () => {
      if (!activeRef.current || recRef.current !== r) return;
      const lived = Date.now() - sessionStartRef.current;
      fastEndsRef.current = lived < FAST_END_MS ? fastEndsRef.current + 1 : 0;
      if (fastEndsRef.current >= MAX_FAST_ENDS) {
        // Motor açılır açılmaz kapanıyor (izin/donanım/ses odağı sorunu); döngüye girmeden kayıt yedeğine geç
        stopListening();
        switchToRecorder("SpeechRecognition sürekli kapanıyor", new Error(`${MAX_FAST_ENDS} sessions ended within ${FAST_END_MS} ms`));
        return;
      }
      restartTimerRef.current = window.setTimeout(() => {
        restartTimerRef.current = null;
        if (!activeRef.current || recRef.current !== r) return;
        sessionStartRef.current = Date.now();
        try {
          r.start();
        } catch (err) {
          stopListening();
          switchToRecorder("yeniden başlatma", err);
        }
      }, RESTART_DELAY_MS);
    };

    recRef.current = r;
    activeRef.current = true;
    fastEndsRef.current = 0;
    setNotice("");
    setDetail("");
    setStatus("listening");
    try {
      r.start();
    } catch (err) {
      stopListening();
      switchToRecorder("start", err);
      return;
    }
    // Bekçi: ses algılandı ama sonuç gelmiyorsa (Android'de sık görülür) kayıt yedeğine geç.
    // Kullanıcı sadece sessizse beklemeye devam eder; motor uzun süre hiç sonuç vermeden sürekli kapanıyorsa yine geçer.
    noResultTimerRef.current = window.setInterval(() => {
      if (!activeRef.current || recRef.current !== r || gotResultRef.current || busyRef.current) return;
      const now = Date.now();
      const heardTooLong = heardAtRef.current > 0 && now - heardAtRef.current > NO_RESULT_AFTER_SOUND_MS;
      const stuck = now - firstStartRef.current > NO_RESULT_HARD_MS && fastEndsRef.current >= 3;
      if (heardTooLong || stuck) {
        stopListening();
        switchToRecorder("SpeechRecognition sonuç vermedi", new Error(heardTooLong ? `sound heard, no result in ${NO_RESULT_AFTER_SOUND_MS / 1000}s` : `no result in ${NO_RESULT_HARD_MS / 1000}s`));
      }
    }, WATCHDOG_MS);
  }, [handleUtterance, report, stopListening, stopSpeaking, switchToRecorder, tv.insecure, tv.micDenied]);

  /** Panel açılınca yapılandırmayı al ve karşılama cümlesini söyle. */
  useEffect(() => {
    if (!open || greetedRef.current) return;
    greetedRef.current = true;
    langRef.current = siteLang;
    setVoiceLang(siteLang);
    fetch("/api/voice-agent")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((c: Config) => {
        setConfig(c);
        configRef.current = c;
        const g = c?.greetings?.[langRef.current] ?? c?.greetings?.tr;
        if (g) {
          setLastReply(g);
          lastReplyRef.current = g;
          historyRef.current = [{ role: "assistant", text: g }];
          void speak(g, langRef.current);
        }
      })
      .catch((err) => {
        report("config", err);
        setNotice(tv.error);
      });
  }, [open, report, siteLang, speak, tv.error]);

  // Site dili değişince (dil değiştirici) asistan da o dile geçer: tanıma dili, geçmiş ve karşılama sıfırlanır
  const prevSiteLangRef = useRef(siteLang);
  useEffect(() => {
    if (prevSiteLangRef.current === siteLang) return;
    prevSiteLangRef.current = siteLang;
    langRef.current = siteLang;
    setVoiceLang(siteLang);
    historyRef.current = [];
    safe(() => {
      if (recRef.current) recRef.current.lang = RECOG_LANG[siteLang];
    }, "lang değişimi");
    const g = configRef.current?.greetings?.[siteLang];
    if (g) {
      setLastReply(g);
      lastReplyRef.current = g;
      historyRef.current = [{ role: "assistant", text: g }];
      if (open) void speak(g, siteLang);
    }
  }, [open, siteLang, speak]);

  // startListening'i konuşma sonrası devam ettirmek için ref'te tut
  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  // Escape ile kapat; kapanınca dinlemeyi ve konuşmayı durdur
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const closePanel = useCallback(() => {
    pausedForSpeechRef.current = false;
    pendingAudioRef.current = null;
    setAudioBlocked(false);
    stopListening();
    stopRecording();
    stopSpeaking();
    safe(() => pcRef.current?.close(), "pc.close");
    pcRef.current = null;
    setLive(false);
    setOpen(false);
  }, [stopListening, stopRecording, stopSpeaking]);

  // Bileşen kaldırılırken (sayfa geçişi) mikrofon, seslendirme ve WebRTC bağlantısını bırak
  useEffect(
    () => () => {
      activeRef.current = false;
      if (restartTimerRef.current !== null) window.clearTimeout(restartTimerRef.current);
      safe(() => recRef.current?.abort(), "abort");
      recRef.current = null;
      safe(() => window.speechSynthesis?.cancel(), "cancel");
      safe(() => ttsAudioRef.current?.pause(), "audio.pause");
      safe(() => pcRef.current?.close(), "pc.close");
      pcRef.current = null;
      safe(() => recorderRef.current?.stop(), "recorder.stop");
      recorderRef.current = null;
      streamRef.current?.getTracks().forEach((t) => safe(() => t.stop(), "track.stop"));
      streamRef.current = null;
    },
    [],
  );

  // Bas-konuş (uzun basış) veya tıkla-dinle (kısa dokunuş)
  const onPressStart = () => {
    unlockAudio();
    if (modeRef.current === "recorder") {
      pressRef.current = { at: Date.now(), wasActive: !!recorderRef.current };
      if (!recorderRef.current) void startRecording().catch((err) => report("startRecording", err));
      return;
    }
    pressRef.current = { at: Date.now(), wasActive: activeRef.current };
    if (!activeRef.current) {
      try {
        startListening();
      } catch (err) {
        report("startListening", err);
        setNotice(tv.error);
      }
    }
  };
  const onPressEnd = () => {
    const p = pressRef.current;
    pressRef.current = null;
    if (!p) return;
    const held = Date.now() - p.at > 450;
    if (modeRef.current === "recorder") {
      if (held || p.wasActive) stopRecording();
      return;
    }
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

  const statusLabel = { idle: mode === "recorder" ? tv.tapRecord : tv.idle, listening: mode === "recorder" ? tv.recording : tv.listening, thinking: tv.thinking, speaking: tv.speaking, error: tv.idle, unsupported: tv.idle }[status];
  const listening = mode === "recorder" ? recording : status === "listening";

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            // Panel bir sonraki render'da oluşur; ses öğesi hazır olunca kilidi aç
            window.setTimeout(unlockAudio, 0);
          }}
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
          className="notranslate fixed bottom-4 right-4 z-[45] w-[min(92vw,360px)] overflow-hidden rounded-3xl border border-cream-200 bg-white shadow-2xl"
          translate="no"
          role="dialog"
          aria-label={tv.name}
          data-testid="voice-panel"
        >
          <header className="notranslate flex items-center justify-between bg-ink-900 px-4 py-3 text-white" translate="no">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500"><Mic className="h-4 w-4" /></span>
              <div>
                <p className="text-sm font-bold leading-tight"><span>{config?.agent ?? tv.name}</span></p>
                <p className="text-[11px] text-cream-100/70" data-testid="voice-status">
                  <span>{statusLabel}</span> · <span className="uppercase" data-testid="voice-lang">{voiceLang}</span>
                  {mode === "recorder" && <span className="ml-1 rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold" data-testid="voice-mode"><span>{tv.recorder}</span></span>}
                </p>
              </div>
            </div>
            <button type="button" onClick={closePanel} className="rounded-full p-1.5 text-cream-100/80 hover:bg-white/10 hover:text-white" aria-label={tv.close} data-testid="voice-close">
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="notranslate px-4 pb-4 pt-3" translate="no">
            <div className={`voice-wave voice-wave--${status}`} aria-hidden>
              {[0, 1, 2, 3, 4].map((i) => <span key={i} style={{ animationDelay: `${i * 0.12}s` }} />)}
            </div>

            <div className="notranslate mt-3 min-h-[72px] space-y-2 text-sm" translate="no">
              {lastReply && (
                <p className="rounded-2xl rounded-tl-sm bg-cream-100 px-3 py-2 text-ink-900" data-testid="voice-reply"><span>{lastReply}</span></p>
              )}
              {(interim || lastUser) && (
                <p className={`ml-8 rounded-2xl rounded-tr-sm px-3 py-2 ${interim ? "bg-brand-50 text-ink-500 italic" : "bg-brand-500 text-white"}`} data-testid="voice-user"><span>{interim || lastUser}</span></p>
              )}
              {!lastReply && !lastUser && <p className="text-xs text-ink-500"><span>{tv.hint}</span></p>}
            </div>

            {audioBlocked && (
              <button type="button" onClick={unmute} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full border border-brand-500 bg-brand-50 px-3 py-2 text-sm font-bold text-brand-600" data-testid="voice-unmute">
                <Volume2 className="h-4 w-4" />
                <span>{tv.unmute}</span>
              </button>
            )}
            {notice && <p className="mt-2 text-xs font-semibold text-brand-600" role="alert"><span>{notice}</span></p>}
            {detail && <p className="mt-1 break-words font-mono text-[10px] leading-snug text-ink-500" data-testid="voice-detail"><span>{detail}</span></p>}

            <div className="notranslate mt-3 flex items-center gap-3" translate="no">
              <button
                type="button"
                onPointerDown={onPressStart}
                onPointerUp={onPressEnd}
                onPointerCancel={onPressEnd}
                onPointerLeave={() => pressRef.current && onPressEnd()}
                className={`flex h-14 flex-1 items-center justify-center gap-2 rounded-full text-base font-bold text-white shadow-lg transition select-none ${listening ? "bg-red-600 shadow-red-900/30" : "bg-brand-500 shadow-brand-900/30 hover:bg-brand-600"}`}
                aria-pressed={listening}
                aria-label={mode === "recorder" ? (listening ? tv.stopRecord : tv.tapRecord) : listening ? tv.stop : tv.tap}
                data-testid="voice-mic"
                data-mode={mode}
                disabled={live}
              >
                {listening ? <MicOff className="h-5 w-5" /> : mode === "recorder" ? <Disc className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                <span>{mode === "recorder" ? (listening ? tv.stopRecord : tv.tapRecord) : listening ? tv.stop : tv.tap}</span>
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
                  <span>{tv.live}</span>
                </button>
              )}
            </div>
            <p className="mt-2 text-center text-[11px] text-ink-500"><span>{tv.hold}</span> · <span>{tv.tap}</span></p>
            <audio ref={audioRef} autoPlay hidden />
            <audio ref={ttsAudioRef} playsInline preload="auto" hidden data-testid="voice-tts-audio" />
          </div>
        </section>
      )}
    </>
  );
}
