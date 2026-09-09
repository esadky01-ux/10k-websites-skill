import { Suspense } from "react";
import type { Metadata } from "next";
import QuickOrderMatrix from "@/components/QuickOrderMatrix";
import { getDictionary, isLocale, type Locale } from "@/i18n";
import { alternatesFor } from "@/lib/seo";

type Params = Promise<{ lang: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : "nl";
  const t = getDictionary(lang).order;
  return { title: t.metaTitle, description: t.metaDescription, alternates: alternatesFor(lang, "order") };
}

export default async function OrderPage({ params }: { params: Params }) {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : "nl";
  const t = getDictionary(lang).order;
  return (
    <div className="mx-auto max-w-7xl px-4 pb-32 pt-8 sm:px-6">
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-500">{t.eyebrow}</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink-900 sm:text-4xl">{t.title}</h1>
        <p className="mt-2 max-w-2xl text-ink-500">{t.text}</p>
      </div>
      <Suspense fallback={<div className="py-20 text-center text-ink-500">{t.loading}</div>}>
        <QuickOrderMatrix />
      </Suspense>
    </div>
  );
}
