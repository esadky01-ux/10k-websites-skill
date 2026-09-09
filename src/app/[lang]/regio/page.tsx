import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MapPin, Truck } from "lucide-react";
import { regions } from "@/data/regions";
import { getDictionary, isLocale, localePath, type Locale } from "@/i18n";
import { alternatesFor, jsonLd } from "@/lib/seo";
import { site } from "@/lib/site";

type Params = Promise<{ lang: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : "nl";
  const t = getDictionary(lang).regions;
  return { title: t.metaTitle, description: t.metaDescription, alternates: alternatesFor(lang, "regions") };
}

export default async function RegionsIndex({ params }: { params: Params }) {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : "nl";
  const t = getDictionary(lang).regions;
  const provinces = [...new Set(regions.map((r) => r.province))];
  const listLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: t.title,
    itemListElement: regions.map((r, i) => ({ "@type": "ListItem", position: i + 1, name: r.name, url: `${site.url}${localePath(lang, "regions", r.slug)}` })),
  };
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(listLd) }} />
      <div className="max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-500">{getDictionary(lang).nav.regions}</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink-900 sm:text-4xl">{t.title}</h1>
        <p className="mt-3 text-ink-500">{t.text}</p>
      </div>
      {provinces.map((prov) => (
        <section key={prov} className="mt-10">
          <h2 className="font-display text-xl font-bold text-ink-900">{prov}</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {regions.filter((r) => r.province === prov).map((r) => (
              <li key={r.slug}>
                <Link href={localePath(lang, "regions", r.slug)} className="group flex h-full flex-col justify-between rounded-2xl border border-cream-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-brand-500/50 hover:shadow-md">
                  <div>
                    <p className="flex items-center gap-2 font-bold text-ink-900"><MapPin className="h-4 w-4 text-brand-500" />{r.name}</p>
                    <p className="mt-1 text-sm text-ink-500">{r.postcodes.slice(0, 3).join(", ")} · {r.distanceKm} {t.km}</p>
                  </div>
                  <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-ink-700"><Truck className="h-3.5 w-3.5 text-brand-500" />{r.deliveryDays.map((d) => t.dayNames[d as keyof typeof t.dayNames] ?? d).join(", ")}<ArrowRight className="ml-auto h-4 w-4 text-ink-300 transition group-hover:text-brand-500" /></p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
