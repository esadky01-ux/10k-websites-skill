import { BadgePercent, MessageCircle, ShieldCheck, Truck, Warehouse, Pizza } from "lucide-react";
import Link from "next/link";
import { site } from "@/lib/site";
import { getDictionary, localePath, type Locale } from "@/i18n";

const icons = [BadgePercent, MessageCircle, ShieldCheck];
const extraIcons = [Pizza, Warehouse, Truck];

export default function Advantages({ lang }: { lang: Locale }) {
  const t = getDictionary(lang).advantages;
  return (
    <section className="bg-ink-900 text-white">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20">
        <div className="mb-10 max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-500">{t.eyebrow}</p>
          <h2 className="mt-2 font-display text-3xl font-bold sm:text-4xl">{t.title}</h2>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {t.items.map((it, i) => {
            const Icon = icons[i];
            return (
              <div key={it.title} className="relative rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur transition hover:border-gold-500/50">
                {"badge" in it && it.badge && <span className="absolute right-5 top-5 rounded-full bg-brand-500 px-3 py-1 text-sm font-black text-white shadow">{it.badge}</span>}
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500 text-white"><Icon className="h-6 w-6" /></div>
                <h3 className="mt-5 text-xl font-bold">{it.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-cream-100/80">{it.text}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-10 flex flex-col gap-6 rounded-2xl border border-white/10 bg-gradient-to-r from-brand-600 to-brand-900 p-6 md:flex-row md:items-center md:justify-between md:p-8">
          <ul className="grid gap-3 sm:grid-cols-3 md:flex-1">
            {t.extras.map((e, i) => {
              const Icon = extraIcons[i];
              return <li key={e} className="flex items-start gap-2 text-sm text-cream-100"><Icon className="mt-0.5 h-4.5 w-4.5 shrink-0 text-gold-500" />{e}</li>;
            })}
          </ul>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href={localePath(lang, "order")} className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-bold text-brand-600 transition hover:bg-cream-100">{t.cta}</Link>
            <a href={`https://wa.me/${site.whatsapp}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full border border-white/40 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
              <MessageCircle className="h-4 w-4" />{t.whatsapp}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
