import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, Clock } from "lucide-react";
import { getPosts } from "@/data/blog";
import { getDictionary, isLocale, localePath, type Locale } from "@/i18n";
import { alternatesFor } from "@/lib/seo";
import { formatDate } from "@/lib/format";

type Params = Promise<{ lang: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : "nl";
  const t = getDictionary(lang).blog;
  return { title: t.metaTitle, description: t.metaDescription, alternates: alternatesFor(lang, "blog") };
}

export default async function BlogPage({ params }: { params: Params }) {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : "nl";
  const t = getDictionary(lang);
  const [featured, ...rest] = getPosts(lang);
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-16">
      <div className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-500">{t.nav.blog}</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink-900 sm:text-4xl">{t.blog.title}</h1>
        <p className="mt-3 text-ink-500">{t.blog.text}</p>
      </div>
      <Link href={localePath(lang, "blog", featured.slug)} className="group mt-10 grid gap-6 overflow-hidden rounded-3xl bg-ink-900 text-white transition hover:shadow-xl md:grid-cols-2">
        <div className="min-h-56 bg-cover bg-center md:min-h-full" style={{ backgroundImage: `url(${featured.image})` }} role="img" aria-label={featured.title} />
        <div className="p-7 md:p-10">
          <span className="rounded-full bg-gold-500 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-ink-900">{t.blog.featured}</span>
          <h2 className="mt-4 font-display text-2xl font-bold leading-snug group-hover:text-gold-500 md:text-3xl">{featured.title}</h2>
          <p className="mt-3 text-cream-100/85">{featured.excerpt}</p>
          <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-cream-100/70">
            <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatDate(featured.date, lang)}</span>
            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{featured.readingTime} {t.blogHome.readingTime}</span>
          </div>
          <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-500">{t.blog.read} <ArrowRight className="h-4 w-4" /></span>
        </div>
      </Link>
      <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {rest.map((post) => (
          <article key={post.slug} className="group flex flex-col overflow-hidden rounded-2xl border border-cream-200 bg-white transition hover:-translate-y-1 hover:shadow-lg">
            <Link href={localePath(lang, "blog", post.slug)} className="flex h-full flex-col">
              <div className="h-44 bg-cover bg-center" style={{ backgroundImage: `url(${post.image})` }} role="img" aria-label={post.title} />
              <div className="flex flex-1 flex-col p-6">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-500">{post.category}</span>
                <h2 className="mt-2 font-display text-xl font-bold leading-snug text-ink-900 group-hover:text-brand-500">{post.title}</h2>
                <p className="mt-2 line-clamp-3 text-sm text-ink-500">{post.excerpt}</p>
                <div className="mt-auto flex items-center gap-4 pt-4 text-xs text-ink-500">
                  <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatDate(post.date, lang)}</span>
                  <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{post.readingTime} {t.blogHome.readingTime}</span>
                </div>
              </div>
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
