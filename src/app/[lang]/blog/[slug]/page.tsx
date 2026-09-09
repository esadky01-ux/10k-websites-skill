import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays, Clock, MessageCircle } from "lucide-react";
import { getPostBySlug, getPosts, translatedPost } from "@/data/blog";
import { site } from "@/lib/site";
import { getDictionary, isLocale, localePath, locales, type Locale } from "@/i18n";
import { jsonLd } from "@/lib/seo";
import { formatDate } from "@/lib/format";

type Params = Promise<{ lang: string; slug: string }>;

export function generateStaticParams() {
  return locales.flatMap((lang) => getPosts(lang).map((p) => ({ lang, slug: p.slug })));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang: raw, slug } = await params;
  const lang: Locale = isLocale(raw) ? raw : "nl";
  const post = getPostBySlug(lang, slug);
  if (!post) return { title: "404" };
  const other = translatedPost(lang, slug);
  const self = localePath(lang, "blog", post.slug);
  const languages: Record<string, string> = { [lang === "nl" ? "nl-BE" : "tr"]: self };
  if (other) languages[other.lang === "nl" ? "nl-BE" : "tr"] = localePath(other.lang, "blog", other.post.slug);
  languages["x-default"] = lang === "nl" ? self : other ? localePath("nl", "blog", other.post.slug) : self;
  return {
    title: post.metaTitle ?? post.title,
    description: post.metaDescription,
    keywords: post.keywords,
    alternates: { canonical: self, languages },
    openGraph: { type: "article", title: post.title, description: post.metaDescription, publishedTime: post.date, modifiedTime: post.updated ?? post.date, images: [{ url: post.image, alt: post.title }] },
  };
}

export default async function BlogPostPage({ params }: { params: Params }) {
  const { lang: raw, slug } = await params;
  const lang: Locale = isLocale(raw) ? raw : "nl";
  const t = getDictionary(lang);
  const post = getPostBySlug(lang, slug);
  if (!post) notFound();
  const all = getPosts(lang);
  const idx = all.findIndex((p) => p.slug === post.slug);
  const next = all[(idx + 1) % all.length];

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.metaDescription,
    image: `${site.url}${post.image}`,
    datePublished: post.date,
    dateModified: post.updated ?? post.date,
    inLanguage: lang === "nl" ? "nl-BE" : "tr",
    author: { "@type": "Organization", name: site.name, "@id": `${site.url}/#organization` },
    publisher: { "@type": "Organization", name: site.name, "@id": `${site.url}/#organization` },
    mainEntityOfPage: `${site.url}${localePath(lang, "blog", post.slug)}`,
  };

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(articleLd) }} />
      <header className="relative isolate overflow-hidden bg-ink-900 text-white">
        <div className="absolute inset-0 bg-cover bg-center opacity-40" style={{ backgroundImage: `url(${post.image})` }} aria-hidden />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/60 to-ink-900/30" aria-hidden />
        <div className="relative mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-24">
          <Link href={localePath(lang, "blog")} className="inline-flex items-center gap-1.5 text-sm font-semibold text-cream-100/80 hover:text-white"><ArrowLeft className="h-4 w-4" /> {t.blog.back}</Link>
          <span className="mt-6 block text-[11px] font-bold uppercase tracking-[0.2em] text-gold-500">{post.category}</span>
          <h1 className="mt-3 font-display text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">{post.title}</h1>
          <p className="mt-4 text-lg text-cream-100/85">{post.excerpt}</p>
          <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-cream-100/70">
            <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatDate(post.date, lang)}</span>
            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{post.readingTime} {t.blogHome.readingTime}</span>
            <span>{t.blog.author}</span>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_320px]">
        <div className="prose-blog max-w-3xl" dangerouslySetInnerHTML={{ __html: post.content }} />
        <aside className="space-y-5 lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-2xl bg-ink-900 p-6 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-500">{t.blog.sidebarEyebrow}</p>
            <p className="mt-2 font-display text-3xl font-bold">{t.blog.sidebarTitle}</p>
            <p className="mt-2 text-sm text-cream-100/80">{t.blog.sidebarText}</p>
            <Link href={localePath(lang, "order")} className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-500 px-5 py-2.5 text-sm font-bold hover:bg-brand-600">{t.blog.sidebarCta} <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="rounded-2xl border border-cream-200 bg-white p-6">
            <p className="font-bold text-ink-900">{t.blog.question}</p>
            <p className="mt-1 text-sm text-ink-500">{t.blog.questionText}</p>
            <a href={`https://wa.me/${site.whatsapp}`} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-full bg-wa px-5 py-2.5 text-sm font-bold text-white hover:bg-wa-dark"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
          </div>
          {post.keywords && (
            <div className="rounded-2xl border border-cream-200 bg-white p-6">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-500">{t.blog.tags}</p>
              <div className="mt-3 flex flex-wrap gap-2">{post.keywords.map((k) => <span key={k} className="rounded-full bg-cream-100 px-2.5 py-1 text-xs text-ink-700">{k}</span>)}</div>
            </div>
          )}
        </aside>
      </div>
      <div className="border-t border-cream-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-500">{t.blog.next}</p>
          <Link href={localePath(lang, "blog", next.slug)} className="mt-2 inline-flex items-center gap-2 font-display text-2xl font-bold text-ink-900 hover:text-brand-500">{next.title} <ArrowRight className="h-5 w-5" /></Link>
        </div>
      </div>
    </article>
  );
}
