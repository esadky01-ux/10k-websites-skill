import { partners } from "@/lib/site";

export default function Partners() {
  return (
    <section className="border-y border-cream-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-500">Partnerlerimiz</p>
            <h2 className="mt-2 font-display text-2xl font-bold text-ink-900 sm:text-3xl">
              Sektörün güvenilir markalarıyla çalışıyoruz
            </h2>
          </div>
          <p className="max-w-md text-sm text-ink-500">
            Döner üreticilerinden sos markalarına, içecek devlerinden un değirmenlerine kadar seçili
            üreticilerle doğrudan tedarik.
          </p>
        </div>
        <ul className="mt-8 flex flex-wrap gap-2.5">
          {partners.map((name) => (
            <li
              key={name}
              className="rounded-full border border-cream-200 bg-cream-50 px-4 py-2 text-sm font-semibold text-ink-700 transition hover:border-brand-500 hover:text-brand-600"
            >
              {name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
