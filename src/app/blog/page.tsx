import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, Clock } from "lucide-react";
import { posts } from "@/data/posts";

export const metadata: Metadata = {
  title: "Blog | Belçika Horeca & Toptan Gıda Rehberleri",
  description:
    "Belçika restoran, fritür ve döner işletmeleri için toptan tedarik rehberleri, sos trendleri ve maliyet ipuçları. MAXIMUS Food & Horeca uzman blogu.",
  alternates: { canonical: "/blog" },
};

const fmt = (d: string) =>
  new Date(d).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

export default function BlogPage() {
  const [featured, ...rest] = posts;
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-16">
      <div className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">Blog</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink-900 sm:text-4xl">
          Belçika Horeca sektörü için rehberler
        </h1>
        <p className="mt-3 text-ink-500">
          Toptan tedarik, maliyet yönetimi ve ürün trendleri üzerine uzman ekibimizden pratik yazılar.
        </p>
      </div>

      <Link
        href={`/blog/${featured.slug}`}
        className="group mt-10 grid gap-6 overflow-hidden rounded-3xl bg-ink-900 text-white transition hover:shadow-xl md:grid-cols-2"
      >
        <div
          className="min-h-56 bg-cover bg-center md:min-h-full"
          style={{ backgroundImage: `url(${featured.image})` }}
          role="img"
          aria-label={featured.title}
        />
        <div className="p-7 md:p-10">
          <span className="rounded-full bg-gold-500 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-ink-900">
            Öne çıkan
          </span>
          <h2 className="mt-4 font-display text-2xl font-bold leading-snug group-hover:text-gold-500 md:text-3xl">
            {featured.title}
          </h2>
          <p className="mt-3 text-cream-100/85">{featured.excerpt}</p>
          <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-cream-100/70">
            <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{fmt(featured.date)}</span>
            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{featured.readingTime} dk okuma</span>
          </div>
          <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-500">
            Yazıyı oku <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </Link>

      <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {rest.map((post) => (
          <article key={post.slug} className="group flex flex-col overflow-hidden rounded-2xl border border-cream-200 bg-white transition hover:-translate-y-1 hover:shadow-lg">
            <Link href={`/blog/${post.slug}`} className="flex h-full flex-col">
              <div
                className="h-44 bg-cover bg-center"
                style={{ backgroundImage: `url(${post.image})` }}
                role="img"
                aria-label={post.title}
              />
              <div className="flex flex-1 flex-col p-6">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-600">{post.category}</span>
                <h2 className="mt-2 font-display text-xl font-bold leading-snug text-ink-900 group-hover:text-brand-600">
                  {post.title}
                </h2>
                <p className="mt-2 line-clamp-3 text-sm text-ink-500">{post.excerpt}</p>
                <div className="mt-auto flex items-center gap-4 pt-4 text-xs text-ink-500">
                  <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{fmt(post.date)}</span>
                  <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{post.readingTime} dk</span>
                </div>
              </div>
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
