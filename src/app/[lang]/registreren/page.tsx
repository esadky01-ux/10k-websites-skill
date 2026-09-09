import type { Metadata } from "next";
import { RegisterForm } from "@/components/AuthForms";
import { getDictionary, isLocale, type Locale } from "@/i18n";
import { alternatesFor } from "@/lib/seo";

type Params = Promise<{ lang: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : "nl";
  return { title: getDictionary(lang).auth.metaRegister, alternates: alternatesFor(lang, "register"), robots: { index: false } };
}

export default async function RegisterPage({ params }: { params: Params }) {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : "nl";
  const t = getDictionary(lang).auth;
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-ink-900">{t.registerTitle}</h1>
      <p className="mt-2 text-ink-500">{t.registerText}</p>
      <div className="mt-8 rounded-2xl border border-cream-200 bg-white p-6 shadow-sm"><RegisterForm /></div>
    </div>
  );
}
