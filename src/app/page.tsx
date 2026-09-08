import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import Hero from "@/components/Hero";
import CategoryGrid from "@/components/CategoryGrid";
import Advantages from "@/components/Advantages";
import { posts } from "@/data/posts";

export default function HomePage() {
  const latest = posts.slice(0, 3);
  return (
    <>
      <Hero />
      <CategoryGrid />
      <Advantages />

      {/* Nasıl çalışır */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">Nasıl Çalışır?</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-ink-900 sm:text-4xl">
              Üç adımda toptan sipariş
            </h2>
            <p className="mt-3 text-ink-500">
              Telefonla saatlerce ürün saymak yerine tüm siparişinizi tek tabloda hazırlayın.
            </p>
          </div>
          <ol className="space-y-4">
            {[
              ["Ürün grubunu seçin", "Kategori kartına tıklayın; ilgili ürünler koli formatlarıyla listelenir."],
              ["Koli ve adetleri girin", "Her satırdaki sayaçlarla onlarca ürünü saniyeler içinde sepete ekleyin."],
              ["WhatsApp ile gönderin", "Sepet düzenli bir sipariş fişine dönüşür; aynı gün fiyat ve teslimat onayı alırsınız."],
            ].map(([title, text], i) => (
              <li key={title} className="flex gap-4 rounded-2xl border border-cream-200 bg-white p-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-900 font-display text-lg font-bold text-gold-500">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-bold text-ink-900">{title}</h3>
                  <p className="mt-1 text-sm text-ink-500">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Blog önizleme */}
      <section className="border-t border-cream-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20">
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">Sektör Rehberleri</p>
              <h2 className="mt-2 font-display text-3xl font-bold text-ink-900 sm:text-4xl">
                Horeca işletmeleri için bilgi merkezi
              </h2>
            </div>
            <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700">
              Tüm yazılar <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {latest.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group flex flex-col rounded-2xl border border-cream-200 bg-cream-50 p-6 transition hover:-translate-y-1 hover:shadow-lg"
              >
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                  <FileText className="h-3.5 w-3.5" />
                  {post.category}
                </span>
                <h3 className="mt-4 font-display text-xl font-bold leading-snug text-ink-900 group-hover:text-brand-600">
                  {post.title}
                </h3>
                <p className="mt-2 line-clamp-3 text-sm text-ink-500">{post.excerpt}</p>
                <span className="mt-4 text-xs text-ink-500">{post.readingTime} dk okuma</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
