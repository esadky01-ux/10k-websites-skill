import { partners } from "@/lib/site";
import { getDictionary, type Locale } from "@/i18n";

export default function Partners({ lang }: { lang: Locale }) {
  const t = getDictionary(lang).partners;
  return (
    <section className="border-y border-cream-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-500">{t.eyebrow}</p>
            <h2 className="mt-2 font-display text-2xl font-bold text-ink-900 sm:text-3xl">
              {t.title}
            </h2>
          </div>
          <p className="max-w-md text-sm text-ink-500">
            {t.text}
          </p>
        </div>

        <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {partners.map((p) => (
            <li
              key={p.name}
              title={p.name}
              className={`flex h-24 items-center justify-center gap-3 rounded-xl border px-4 transition ${
                p.dark
                  ? "border-ink-900 bg-[#0e0b3a]"
                  : "border-cream-200 bg-cream-50 hover:border-brand-500/40 hover:bg-white"
              }`}
            >
              {p.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.logo}
                  alt={`${p.name} logo`}
                  loading="lazy"
                  className={`${p.markOnly ? "h-10 w-auto" : "max-h-12 w-auto max-w-[80%]"} object-contain`}
                />
              ) : null}
              {(!p.logo || p.markOnly) && (
                <span className="text-center text-sm font-bold text-ink-800">{p.name}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
