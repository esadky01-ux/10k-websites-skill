import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays, Clock, MessageCircle } from "lucide-react";
import { posts, getPost } from "@/data/posts";
import { site } from "@/lib/site";

type Params = Promise<{ slug: string }>;

export function generateStaticParams() {
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return { title: "Yazı bulunamadı" };
  return {
    title: post.metaTitle ?? post.title,
    description: post.metaDescription,
    keywords: post.keywords,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.metaDescription,
      publishedTime: post.date,
      modifiedTime: post.updated ?? post.date,
      images: [{ url: post.image, alt: post.title }],
    },
  };
}

const fmt = (d: string) =>
  new Date(d).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

export default async function BlogPostPage({ params }: { params: Params }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const idx = posts.findIndex((p) => p.slug === post.slug);
  const next = posts[(idx + 1) % posts.length];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.metaDescription,
    image: `${site.url}${post.image}`,
    datePublished: post.date,
    dateModified: post.updated ?? post.date,
    author: { "@type": "Organization", name: site.name },
    publisher: { "@type": "Organization", name: site.name },
    mainEntityOfPage: `${site.url}/blog/${post.slug}`,
  };

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="relative isolate overflow-hidden bg-ink-900 text-white">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40"
          style={{ backgroundImage: `url(${post.image})` }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/60 to-ink-900/30" aria-hidden />
        <div className="relative mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-24">
          <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm font-semibold text-cream-100/80 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Blog
          </Link>
          <span className="mt-6 block text-[11px] font-bold uppercase tracking-[0.2em] text-gold-500">{post.category}</span>
          <h1 className="mt-3 font-display text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">{post.title}</h1>
          <p className="mt-4 text-lg text-cream-100/85">{post.excerpt}</p>
          <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-cream-100/70">
            <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{fmt(post.date)}</span>
            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{post.readingTime} dk okuma</span>
            <span>{site.name} Editör Ekibi</span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_320px]">
        <div className="prose-blog max-w-3xl" dangerouslySetInnerHTML={{ __html: post.content }} />

        <aside className="space-y-5 lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-2xl bg-ink-900 p-6 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-500">Depodan Teslim</p>
            <p className="mt-2 font-display text-3xl font-bold">%15 İndirim</p>
            <p className="mt-2 text-sm text-cream-100/80">
              Siparişinizi Aarschot deposundan teslim alın, maliyetinizi anında düşürün.
            </p>
            <Link href="/siparis" className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-bold hover:bg-brand-500">
              Siparişe Başla <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="rounded-2xl border border-cream-200 bg-white p-6">
            <p className="font-bold text-ink-900">Sorunuz mu var?</p>
            <p className="mt-1 text-sm text-ink-500">Ürün ve tedarik soruları için WhatsApp hattımıza yazın.</p>
            <a
              href={`https://wa.me/${site.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-wa px-5 py-2.5 text-sm font-bold text-white hover:bg-wa-dark"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          </div>
          {post.keywords && (
            <div className="rounded-2xl border border-cream-200 bg-white p-6">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-500">Etiketler</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {post.keywords.map((k) => (
                  <span key={k} className="rounded-full bg-cream-100 px-2.5 py-1 text-xs text-ink-700">{k}</span>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      <div className="border-t border-cream-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">Sonraki yazı</p>
          <Link href={`/blog/${next.slug}`} className="mt-2 inline-flex items-center gap-2 font-display text-2xl font-bold text-ink-900 hover:text-brand-600">
            {next.title} <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </article>
  );
}
