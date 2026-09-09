import type { Metadata } from "next";
import AccountPanel from "@/components/AccountPanel";
import { getDictionary, isLocale, type Locale } from "@/i18n";
import { alternatesFor } from "@/lib/seo";

type Params = Promise<{ lang: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : "nl";
  return { title: getDictionary(lang).account.metaTitle, alternates: alternatesFor(lang, "account"), robots: { index: false } };
}

export default async function AccountPage({ params }: { params: Params }) {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : "nl";
  const t = getDictionary(lang).account;
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-ink-900">{t.title}</h1>
      <div className="mt-8"><AccountPanel /></div>
    </div>
  );
}
