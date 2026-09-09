import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { categories } from "@/data/categories";
import { products } from "@/data/products";

export default function CategoryGrid() {
  return (
    <section id="kategoriler" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20">
      <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">Ürün Grupları</p>
          <h2 className="mt-2 font-display text-3xl font-bold text-ink-900 sm:text-4xl">
            Ne sipariş etmek istiyorsunuz?
          </h2>
          <p className="mt-3 max-w-2xl text-ink-500">
            Bir ürün grubuna tıklayın, o grubun hızlı sipariş tablosu açılsın. Onlarca koliyi tek
            ekrandan sepete ekleyin.
          </p>
        </div>
        <Link
          href="/siparis"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700"
        >
          Tüm ürünleri gör
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
        {categories.map((cat, i) => {
          const count = products.filter((p) => p.category === cat.slug).length;
          return (
            <Link
              key={cat.slug}
              href={`/siparis?kategori=${cat.slug}`}
              className="group relative isolate flex aspect-[4/3] flex-col justify-end overflow-hidden rounded-2xl bg-ink-800 shadow-md shadow-ink-900/10 ring-1 ring-ink-900/5 transition hover:-translate-y-1 hover:shadow-xl"
            >
              <Image
                src={cat.image}
                alt={cat.name}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 20vw"
                priority={i < 5}
                className="object-cover transition duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink-900/95 via-ink-900/40 to-transparent" />
              <div className="relative p-5 text-white sm:p-6">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider backdrop-blur">
                    {count} ürün
                  </span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-ink-900 transition group-hover:bg-brand-600 group-hover:text-white">
                    <ArrowUpRight className="h-4.5 w-4.5" />
                  </span>
                </div>
                <h3 className="mt-3 font-display text-lg font-bold lg:text-xl">{cat.name}</h3>
                <p className="mt-1.5 line-clamp-2 text-xs text-cream-100/85 sm:text-sm">{cat.description}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
