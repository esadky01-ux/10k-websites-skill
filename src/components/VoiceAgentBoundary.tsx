"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { MicOff, RotateCcw } from "lucide-react";

type Props = { children: ReactNode; label: string; retry: string };
type State = { failed: boolean };

/**
 * Sesli asistan için hata sınırı: bileşen içinde beklenmeyen bir istisna olursa sayfa çökmez,
 * sağ altta nazik bir uyarı ve "tekrar dene" butonu görünür. Sitenin geri kalanı etkilenmez.
 */
export default class VoiceAgentBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[voice-agent] bileşen hatası:", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="fixed bottom-4 right-4 z-[45] flex max-w-[min(92vw,360px)] items-center gap-3 rounded-2xl border border-cream-200 bg-white px-4 py-3 text-sm text-ink-800 shadow-2xl" role="alert" data-testid="voice-boundary">
        <MicOff className="h-5 w-5 shrink-0 text-brand-500" />
        <span className="flex-1">{this.props.label}</span>
        <button type="button" onClick={() => this.setState({ failed: false })} className="inline-flex items-center gap-1 rounded-full border border-cream-200 px-3 py-1.5 text-xs font-semibold hover:bg-cream-100" data-testid="voice-boundary-retry">
          <RotateCcw className="h-3.5 w-3.5" />
          {this.props.retry}
        </button>
      </div>
    );
  }
}
