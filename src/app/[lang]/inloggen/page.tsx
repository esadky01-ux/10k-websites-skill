import type { Metadata } from "next";
import { LoginForm } from "@/components/AuthForms";
import { getDictionary, isLocale, type Locale } from "@/i18n";
import { alternatesFor } from "@/lib/seo";

type Params = Promise<{ lang: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : "nl";
  return { title: getDictionary(lang).auth.metaLogin, alternates: alternatesFor(lang, "login"), robots: { index: false } };
}

export default async function LoginPage({ params }: { params: Params }) {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : "nl";
  const t = getDictionary(lang).auth;
  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-ink-900">{t.loginTitle}</h1>
      <p className="mt-2 text-ink-500">{t.loginText}</p>
      <div className="mt-8 rounded-2xl border border-cream-200 bg-white p-6 shadow-sm"><LoginForm /></div>
    </div>
  );
}
