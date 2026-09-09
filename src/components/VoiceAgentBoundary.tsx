"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { MicOff, RotateCcw } from "lucide-react";

type Props = { children: ReactNode; label: string; retry: string };
type State = { error: Error | null };

/** Hata adı + mesajı (kullanıcıya küçük puntoyla gösterilir, sunucu loguna yazılır). */
export function describeError(err: unknown): string {
  const e = err as { name?: string; message?: string } | undefined;
  const name = e?.name || "Error";
  const message = e?.message || String(err ?? "");
  return `${name}: ${message}`.slice(0, 300);
}

/** İstemci hatasını sunucu loguna gönderir (Vercel Functions logunda görünür). Asla fırlatmaz. */
export function logClientError(where: string, err: unknown) {
  try {
    const e = err as { name?: string; message?: string; stack?: string } | undefined;
    void fetch("/api/voice-agent/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ where, name: e?.name ?? "Error", message: e?.message ?? String(err ?? ""), stack: e?.stack ?? "", ua: typeof navigator !== "undefined" ? navigator.userAgent : "" }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* log başarısız olsa da devam */
  }
}

/**
 * Sesli asistan için hata sınırı: bileşen içinde beklenmeyen bir istisna olursa sayfa çökmez,
 * sağ altta nazik bir uyarı, gerçek hata adı/mesajı ve "tekrar dene" butonu görünür.
 */
export default class VoiceAgentBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[voice-agent] bileşen hatası:", error, info.componentStack);
    logClientError("VoiceAgentBoundary", error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="notranslate fixed bottom-4 right-4 z-[45] w-[min(92vw,360px)] rounded-2xl border border-cream-200 bg-white px-4 py-3 text-sm text-ink-800 shadow-2xl" translate="no" role="alert" data-testid="voice-boundary">
        <div className="flex items-center gap-3">
          <MicOff className="h-5 w-5 shrink-0 text-brand-500" />
          <span className="flex-1">{this.props.label}</span>
          <button type="button" onClick={() => this.setState({ error: null })} className="inline-flex items-center gap-1 rounded-full border border-cream-200 px-3 py-1.5 text-xs font-semibold hover:bg-cream-100" data-testid="voice-boundary-retry">
            <RotateCcw className="h-3.5 w-3.5" />
            {this.props.retry}
          </button>
        </div>
        <p className="mt-2 break-words font-mono text-[10px] leading-snug text-ink-500" data-testid="voice-boundary-detail">
          {describeError(this.state.error)}
        </p>
      </div>
    );
  }
}
