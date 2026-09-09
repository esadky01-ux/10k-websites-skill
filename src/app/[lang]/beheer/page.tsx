import type { Metadata } from "next";
import AdminPanel from "@/components/AdminPanel";
import { getDictionary, isLocale, type Locale } from "@/i18n";

type Params = Promise<{ lang: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : "nl";
  return { title: getDictionary(lang).admin.metaTitle, robots: { index: false, follow: false } };
}

export default async function AdminPage({ params }: { params: Params }) {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : "nl";
  const t = getDictionary(lang).admin;
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-ink-900">{t.title}</h1>
      <div className="mt-8"><AdminPanel /></div>
    </div>
  );
}
