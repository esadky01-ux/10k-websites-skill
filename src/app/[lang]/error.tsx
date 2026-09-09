"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";

/** Rota düzeyi hata sınırı: beklenmeyen istemci hatasında beyaz sayfa yerine nazik bir mesaj ve yeniden dene. */
export default function LangError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    console.error("[maximus] sayfa hatası:", error);
  }, [error]);
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <h1 className="font-display text-2xl font-bold text-ink-900">{t.errorPage.title}</h1>
      <p className="mt-3 text-ink-500">{t.errorPage.text}</p>
      <button type="button" onClick={reset} className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand-500 px-6 py-3 font-bold text-white hover:bg-brand-600">
        <RotateCcw className="h-4 w-4" />
        {t.errorPage.retry}
      </button>
    </div>
  );
}
