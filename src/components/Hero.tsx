import Link from "next/link";
import Image from "next/image";
import { ArrowRight, BadgePercent, MessageCircle, ShieldCheck } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-ink-900 text-white">
      <Image
        src="/media/hero/hero-warehouse.jpg"
        alt="MAXIMUS Food & Horeca Aarschot deposunda sipariş kontrolü yapan şef ve depo görevlisi"
        fill
        priority
        sizes="100vw"
        className="object-cover object-[70%_center]"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-ink-900/95 via-ink-900/70 to-ink-900/20" />
      <div className="absolute inset-0 bg-gradient-to-t from-ink-900/80 via-transparent to-transparent" />

      <div className="relative mx-auto flex max-w-7xl flex-col justify-center px-4 py-20 sm:px-6 md:min-h-[600px] md:py-28">
        <div className="max-w-2xl animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-cream-100 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-gold-500" />
            Aarschot · Belçika · Horeca Toptan Tedarik
          </span>
          <h1 className="mt-5 font-display text-4xl font-bold leading-[1.1] sm:text-5xl lg:text-6xl">
            Restoranınızın mutfağı için
            <span className="block text-gold-500">güvenilir toptan gıda ortağı</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-cream-100/90">
            Soslardan et ürünlerine, dondurulmuş gıdadan ambalaja kadar tüm Horeca ihtiyaçlarınızı
            tek çatı altında topluyoruz. Koli bazında sipariş verin, aynı gün WhatsApp ile onay alın.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/siparis"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-600 px-7 py-3.5 text-base font-bold text-white shadow-lg shadow-brand-900/40 transition hover:bg-brand-500"
            >
              Hızlı Siparişe Başla
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/#kategoriler"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 bg-white/10 px-7 py-3.5 text-base font-semibold text-white backdrop-blur transition hover:bg-white/20"
            >
              Ürün Gruplarını Gör
            </Link>
          </div>

          <ul className="mt-10 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <li className="flex items-center gap-2 text-cream-100">
              <BadgePercent className="h-5 w-5 shrink-0 text-gold-500" />
              Depodan teslimde %15 indirim
            </li>
            <li className="flex items-center gap-2 text-cream-100">
              <MessageCircle className="h-5 w-5 shrink-0 text-gold-500" />
              Aynı gün WhatsApp sipariş onayı
            </li>
            <li className="flex items-center gap-2 text-cream-100">
              <ShieldCheck className="h-5 w-5 shrink-0 text-gold-500" />
              Belçika Horeca tedarik garantisi
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
