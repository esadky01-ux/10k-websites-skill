import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowRight, MapPin, Truck, Warehouse, MessageCircle, Clock, ChevronRight } from "lucide-react";
import { regions, getRegion } from "@/data/regions";
import { categories } from "@/data/categories";
import { categoryHref } from "@/components/CategoryGrid";
import { site } from "@/lib/site";
import { fill, getDictionary, isLocale, localePath, locales, type Locale } from "@/i18n";
import { alternatesFor, jsonLd } from "@/lib/seo";

type Params = Promise<{ lang: string; slug: string }>;

export function generateStaticParams() {
  return locales.flatMap((lang) => regions.map((r) => ({ lang, slug: r.slug })));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang: raw, slug } = await params;
  const lang: Locale = isLocale(raw) ? raw : "nl";
  const region = getRegion(slug);
  if (!region) return { title: "404" };
  const c = region[lang];
  return {
    title: { absolute: c.metaTitle },
    description: c.metaDescription,
    alternates: alternatesFor(lang, "regions", region.slug),
    openGraph: { title: c.metaTitle, description: c.metaDescription, type: "website", images: [{ url: "/media/hero/hero-warehouse.jpg" }] },
    other: {
      "geo.region": `BE-${region.province === "Brussel" ? "BRU" : "VLG"}`,
      "geo.placename": region.name,
      "geo.position": `${region.lat};${region.lng}`,
      ICBM: `${region.lat}, ${region.lng}`,
    },
  };
}

export default async function RegionPage({ params }: { params: Params }) {
  const { lang: raw, slug } = await params;
  const lang: Locale = isLocale(raw) ? raw : "nl";
  const region = getRegion(slug);
  if (!region) notFound();
  const t = getDictionary(lang).regions;
  const c = region[lang];
  const days = region.deliveryDays.map((d) => t.dayNames[d as keyof typeof t.dayNames] ?? d);
  const pageUrl = `${site.url}${localePath(lang, "regions", region.slug)}`;
  const others = regions.filter((r) => r.slug !== region.slug).sort((a, b) => Math.abs(a.distanceKm - region.distanceKm) - Math.abs(b.distanceKm - region.distanceKm)).slice(0, 8);

  const serviceLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        "@id": `${pageUrl}#service`,
        name: c.h1,
        serviceType: lang === "nl" ? "Horeca groothandel en levering" : "Toptan Horeca tedariki ve teslimat",
        description: c.metaDescription,
        provider: { "@id": `${site.url}/#organization` },
        areaServed: { "@type": "City", name: region.name, address: { "@type": "PostalAddress", addressLocality: region.name, postalCode: region.postcodes[0], addressRegion: region.province, addressCountry: "BE" }, geo: { "@type": "GeoCoordinates", latitude: region.lat, longitude: region.lng } },
        availableChannel: { "@type": "ServiceChannel", serviceUrl: `${site.url}${localePath(lang, "order")}`, servicePhone: site.phone },
        hoursAvailable: region.deliveryDays.map((d) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: { ma: "Monday", di: "Tuesday", wo: "Wednesday", do: "Thursday", vr: "Friday", za: "Saturday" }[d] })),
      },
      {
        "@type": "FAQPage",
        "@id": `${pageUrl}#faq`,
        mainEntity: c.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: t.breadcrumbHome, item: `${site.url}${localePath(lang)}` },
          { "@type": "ListItem", position: 2, name: getDictionary(lang).nav.regions, item: `${site.url}${localePath(lang, "regions")}` },
          { "@type": "ListItem", position: 3, name: region.name, item: pageUrl },
        ],
      },
    ],
  };

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(serviceLd) }} />
      <header className="relative isolate overflow-hidden bg-ink-900 text-white">
        <Image src="/media/hero/hero-warehouse.jpg" alt="" fill sizes="100vw" className="object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/70 to-ink-900/40" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 md:py-20">
          <nav aria-label="breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-cream-100/70">
            <Link href={localePath(lang)} className="hover:text-white">{t.breadcrumbHome}</Link>
            <ChevronRight className="h-3 w-3" />
            <Link href={localePath(lang, "regions")} className="hover:text-white">{getDictionary(lang).nav.regions}</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-white">{region.name}</span>
          </nav>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-gold-500">{region.province} · {region.postcodes.join(", ")}</p>
          <h1 className="mt-3 max-w-3xl font-display text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">{c.h1}</h1>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cream-100/70"><Truck className="h-4 w-4 text-gold-500" />{t.deliveryDays}</p>
              <p className="mt-1 font-semibold capitalize">{days.join(", ")}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cream-100/70"><MapPin className="h-4 w-4 text-gold-500" />{t.distance}</p>
              <p className="mt-1 font-semibold">{region.distanceKm} {t.km} · {region.driveMinutes} {t.min} {t.drive}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cream-100/70"><Warehouse className="h-4 w-4 text-gold-500" />{t.pickup}</p>
              <p className="mt-1 font-semibold">-15% · {site.address.street}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_340px]">
        <div>
          <div className="prose-blog max-w-3xl" dangerouslySetInnerHTML={{ __html: c.intro }} />
          <h2 className="mt-10 font-display text-2xl font-bold text-ink-900">{fill(t.localProfileTitle, { city: region.name })}</h2>
          <div className="prose-blog mt-3 max-w-3xl" dangerouslySetInnerHTML={{ __html: c.localProfile }} />

          <h2 className="mt-10 font-display text-2xl font-bold text-ink-900">{fill(t.categoriesTitle, { city: region.name })}</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {categories.map((cat) => (
              <li key={cat.slug}>
                <Link href={categoryHref(lang, cat.slug)} className="flex items-center gap-3 rounded-xl border border-cream-200 bg-white p-3 transition hover:border-brand-500/50 hover:shadow-sm">
                  <Image src={cat.image} alt="" width={64} height={48} className="h-12 w-16 rounded-lg object-cover" />
                  <span className="text-sm font-semibold text-ink-900">{cat.name[lang]}</span>
                  <ArrowRight className="ml-auto h-4 w-4 text-ink-300" />
                </Link>
              </li>
            ))}
          </ul>

          <h2 className="mt-10 font-display text-2xl font-bold text-ink-900">{t.faq}</h2>
          <div className="mt-4 divide-y divide-cream-200 rounded-2xl border border-cream-200 bg-white">
            {c.faq.map((f) => (
              <details key={f.q} className="group p-5">
                <summary className="cursor-pointer list-none font-semibold text-ink-900 marker:hidden">{f.q}</summary>
                <p className="mt-2 text-sm leading-relaxed text-ink-700">{f.a}</p>
              </details>
            ))}
          </div>

          <h2 className="mt-10 font-display text-xl font-bold text-ink-900">{t.nearby}</h2>
          <p className="mt-2 text-ink-700">{region.nearby.join(" · ")}</p>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-2xl bg-ink-900 p-6 text-white">
            <p className="font-display text-2xl font-bold">{fill(t.cta, { city: region.name })}</p>
            <p className="mt-2 text-sm text-cream-100/80">{t.ctaText}</p>
            <div className="mt-4 flex flex-col gap-2">
              <Link href={localePath(lang, "order")} className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-500 px-5 py-2.5 text-sm font-bold hover:bg-brand-600">{t.order} <ArrowRight className="h-4 w-4" /></Link>
              <a href={`https://wa.me/${site.whatsapp}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full bg-wa px-5 py-2.5 text-sm font-bold hover:bg-wa-dark"><MessageCircle className="h-4 w-4" /> {t.whatsapp}</a>
            </div>
          </div>
          <div className="rounded-2xl border border-cream-200 bg-white p-6 text-sm text-ink-700">
            <p className="flex items-center gap-2 font-bold text-ink-900"><Warehouse className="h-4 w-4 text-brand-500" />{t.pickup}</p>
            <p className="mt-2">{t.pickupText}</p>
            <p className="mt-3 text-ink-500">{site.address.full}</p>
            <p className="mt-1 flex items-center gap-2 text-ink-500"><Clock className="h-3.5 w-3.5" />{getDictionary(lang).common.hours}</p>
          </div>
          <div className="rounded-2xl border border-cream-200 bg-white p-6">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-500">{t.otherRegions}</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {others.map((r) => (
                <li key={r.slug}><Link href={localePath(lang, "regions", r.slug)} className="rounded-full bg-cream-100 px-3 py-1 text-xs font-semibold text-ink-700 hover:bg-brand-50 hover:text-brand-600">{r.name}</Link></li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </article>
  );
}
