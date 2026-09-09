import Link from "next/link";
import { ArrowRight, FileText, MapPin } from "lucide-react";
import Hero from "@/components/Hero";
import CategoryGrid from "@/components/CategoryGrid";
import Advantages from "@/components/Advantages";
import Partners from "@/components/Partners";
import { LogoBadge } from "@/components/Logo";
import { getPosts } from "@/data/blog";
import { regions } from "@/data/regions";
import { site } from "@/lib/site";
import { fill, getDictionary, isLocale, localePath, type Locale } from "@/i18n";

type Params = Promise<{ lang: string }>;

export default async function HomePage({ params }: { params: Params }) {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : "nl";
  const t = getDictionary(lang);
  const latest = getPosts(lang).slice(0, 3);
  return (
    <>
      <Hero lang={lang} />
      <CategoryGrid lang={lang} />
      <Advantages lang={lang} />
      <Partners lang={lang} />

      <section id="over-ons" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20">
        <div className="grid gap-10 md:grid-cols-[280px_1fr] md:items-center">
          <LogoBadge className="mx-auto w-56 shadow-xl shadow-brand-900/20 md:w-full" />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-500">{t.about.eyebrow}</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-ink-900 sm:text-4xl">{t.about.title}</h2>
            <p className="mt-4 leading-relaxed text-ink-700">{fill(t.about.p1, { year: site.founded })}</p>
            <h3 className="mt-6 font-bold text-ink-900">{t.about.h3}</h3>
            <p className="mt-2 leading-relaxed text-ink-700">{t.about.p2}</p>
            <p className="mt-6 text-lg font-bold text-brand-500">{site.tagline}</p>
          </div>
        </div>
      </section>

      <section className="border-t border-cream-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20">
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-500">{t.howItWorks.eyebrow}</p>
              <h2 className="mt-2 font-display text-3xl font-bold text-ink-900 sm:text-4xl">{t.howItWorks.title}</h2>
              <p className="mt-3 text-ink-500">{t.howItWorks.text}</p>
            </div>
            <ol className="space-y-4">
              {t.howItWorks.steps.map(([title, text], i) => (
                <li key={title} className="flex gap-4 rounded-2xl border border-cream-200 bg-cream-50 p-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-900 font-display text-lg font-bold text-gold-500">{i + 1}</span>
                  <div><h3 className="font-bold text-ink-900">{title}</h3><p className="mt-1 text-sm text-ink-500">{text}</p></div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20">
        <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-500">{t.regionsHome.eyebrow}</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-ink-900 sm:text-4xl">{t.regionsHome.title}</h2>
            <p className="mt-3 max-w-2xl text-ink-500">{t.regionsHome.text}</p>
          </div>
          <Link href={localePath(lang, "regions")} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-500 hover:text-brand-600">{t.regionsHome.all} <ArrowRight className="h-4 w-4" /></Link>
        </div>
        <ul className="flex flex-wrap gap-2">
          {regions.map((r) => (
            <li key={r.slug}>
              <Link href={localePath(lang, "regions", r.slug)} className="inline-flex items-center gap-1.5 rounded-full border border-cream-200 bg-white px-4 py-2 text-sm font-semibold text-ink-700 transition hover:border-brand-500 hover:text-brand-600">
                <MapPin className="h-3.5 w-3.5 text-brand-500" />{r.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-cream-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20">
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-500">{t.blogHome.eyebrow}</p>
              <h2 className="mt-2 font-display text-3xl font-bold text-ink-900 sm:text-4xl">{t.blogHome.title}</h2>
            </div>
            <Link href={localePath(lang, "blog")} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-500 hover:text-brand-600">{t.blogHome.all} <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {latest.map((post) => (
              <Link key={post.slug} href={localePath(lang, "blog", post.slug)} className="group flex flex-col rounded-2xl border border-cream-200 bg-cream-50 p-6 transition hover:-translate-y-1 hover:shadow-lg">
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-ink-500"><FileText className="h-3.5 w-3.5" />{post.category}</span>
                <h3 className="mt-4 font-display text-xl font-bold leading-snug text-ink-900 group-hover:text-brand-500">{post.title}</h3>
                <p className="mt-2 line-clamp-3 text-sm text-ink-500">{post.excerpt}</p>
                <span className="mt-4 text-xs text-ink-500">{post.readingTime} {t.blogHome.readingTime}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
