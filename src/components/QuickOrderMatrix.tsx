"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Lock, LayoutGrid, X, ShoppingCart, ArrowRight } from "lucide-react";
import { categories } from "@/data/categories";
import { products, formatPackaging, productName, unitLabel, type Product } from "@/data/products";
import { useCart } from "@/components/CartProvider";
import { useAuth } from "@/components/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { localePath } from "@/i18n/config";
import { formatEur } from "@/lib/format";
import ProductIcon from "@/components/ProductIcon";
import QtyCounter from "@/components/QtyCounter";
import Link from "next/link";

const normalize = (s: string) =>
  s.toLocaleLowerCase("tr-TR").replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c").replace(/é|è|ë/g, "e");

const PARAM_KEYS = ["categorie", "kategori"];

export default function QuickOrderMatrix() {
  const router = useRouter();
  const params = useSearchParams();
  const cart = useCart();
  const { customer, prices } = useAuth();
  const { lang, t } = useI18n();
  const tt = t.order;

  const paramKey = lang === "nl" ? "categorie" : "kategori";
  const fromUrl = PARAM_KEYS.map((k) => params.get(k)).find(Boolean) ?? "";
  const active = categories.some((c) => c.slug === fromUrl) ? fromUrl : "";
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const selectCategory = (slug: string) => {
    router.replace(slug ? localePath(lang, "order", undefined, `${paramKey}=${slug}`) : localePath(lang, "order"), { scroll: false });
  };

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return products.filter((p) => {
      if (active && p.category !== active) return false;
      if (!q) return true;
      const hay = normalize(`${p.name} ${p.nameNl} ${p.brand} ${p.sku} ${(p.tags ?? []).join(" ")}`);
      return q.split(/\s+/).every((w) => hay.includes(w));
    });
  }, [active, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of filtered) {
      const arr = map.get(p.category) ?? [];
      arr.push(p);
      map.set(p.category, arr);
    }
    return categories.filter((c) => map.has(c.slug)).map((c) => ({ cat: c, items: map.get(c.slug)! }));
  }, [filtered]);

  const lineFor = (id: string) => cart.lines.find((l) => l.productId === id);
  const activeCat = categories.find((c) => c.slug === active);

  const PriceCell = ({ p }: { p: Product }) => {
    const price = prices?.[p.id];
    if (customer && price !== undefined) {
      return (
        <div>
          <span className="font-bold text-ink-900">{formatEur(price, lang)}</span>
          <span className="block text-xs text-ink-500">{tt.priceUnit}</span>
        </div>
      );
    }
    if (customer && customer.status !== "approved") {
      return <span className="inline-flex items-center gap-1 rounded-full bg-gold-500/20 px-2.5 py-1 text-xs font-semibold text-yellow-800" title={t.auth.pendingTitle}><Lock className="h-3 w-3" />{tt.pendingPrice}</span>;
    }
    if (customer) return <span className="text-xs text-ink-500">—</span>;
    return (
      <Link href={localePath(lang, "login")} className="inline-flex items-center gap-1.5 rounded-full border border-cream-200 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:border-brand-500 hover:text-brand-600">
        <Lock className="h-3.5 w-3.5" />
        {tt.loginForPrice}
      </Link>
    );
  };

  const Counters = ({ p, compact = false }: { p: Product; compact?: boolean }) => {
    const line = lineFor(p.id);
    return (
      <>
        <QtyCounter compact={compact} label={tt.caseLabel} value={line?.cases ?? 0} onChange={(v) => cart.setQuantity(p.id, v, line?.units ?? 0)} />
        <QtyCounter compact={compact} label={unitLabel(p, lang)} value={line?.units ?? 0} onChange={(v) => cart.setQuantity(p.id, line?.cases ?? 0, v)} />
      </>
    );
  };

  return (
    <div>
      <div className="sticky top-[57px] z-30 -mx-4 border-b border-cream-200 bg-cream-50/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 md:top-[97px] lg:top-[69px]">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 lg:flex-row lg:items-center">
          <div className="scroll-tabs flex gap-1.5 overflow-x-auto py-0.5 lg:flex-1" role="tablist" aria-label={tt.filters}>
            <button type="button" role="tab" aria-selected={active === ""} onClick={() => selectCategory("")} className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition ${active === "" ? "bg-ink-900 text-white" : "bg-white text-ink-700 ring-1 ring-cream-200 hover:ring-ink-300"}`}>
              <LayoutGrid className="h-4 w-4" />
              {tt.all}
            </button>
            {categories.map((c) => (
              <button key={c.slug} type="button" role="tab" aria-selected={active === c.slug} onClick={() => selectCategory(c.slug)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${active === c.slug ? "bg-brand-500 text-white" : "bg-white text-ink-700 ring-1 ring-cream-200 hover:ring-ink-300"}`}>
                {c.shortName[lang]}
              </button>
            ))}
          </div>
          <div className="relative lg:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
            <input ref={searchRef} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tt.search} aria-label={tt.searchAria} className="w-full rounded-full border border-cream-200 bg-white py-2.5 pl-9 pr-9 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
            {query && (
              <button type="button" onClick={() => { setQuery(""); searchRef.current?.focus(); }} aria-label={tt.clearSearch} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink-500 hover:bg-cream-100">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-ink-900">{activeCat ? activeCat.name[lang] : tt.allTitle}</h2>
          <p className="mt-1 text-sm text-ink-500">{activeCat?.description[lang] ?? tt.allText}</p>
        </div>
        <p className="text-sm text-ink-500"><span className="font-semibold text-ink-900">{filtered.length}</span> {tt.listed}</p>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-cream-200 bg-white p-12 text-center">
          <p className="font-semibold text-ink-900">{tt.noResults}</p>
          <p className="mt-1 text-sm text-ink-500">{tt.noResultsText}</p>
        </div>
      ) : (
        <>
          {/* Mobil: kart görünümü */}
          <div className="mt-6 space-y-6 md:hidden" data-testid="mobile-cards">
            {grouped.map(({ cat, items }) => (
              <section key={cat.slug} aria-label={cat.name[lang]}>
                {!active && <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-brand-500">{cat.name[lang]}</h3>}
                <div className="space-y-3">
                  {items.map((p) => {
                    const inCart = !!lineFor(p.id);
                    return (
                      <article key={p.id} className={`rounded-2xl border bg-white p-4 shadow-sm ${inCart ? "border-brand-500/60 bg-brand-50/40" : "border-cream-200"}`}>
                        <div className="flex items-start gap-3">
                          <ProductIcon category={p.category} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold leading-snug text-ink-900">{productName(p, lang)}</p>
                            <p className="text-xs text-ink-500">{p.brand}{p.sku !== "—" && <> · <span className="font-mono">{p.sku}</span></>}</p>
                            <p className="mt-1 text-sm font-semibold text-ink-800">{formatPackaging(p)} <span className="font-normal text-ink-500">· {tt.caseIs} {p.unitsPerCase} {unitLabel(p, lang)}</span></p>
                          </div>
                          <div className="shrink-0 text-right text-sm"><PriceCell p={p} /></div>
                        </div>
                        <div className="mt-3 flex items-end justify-between gap-3 border-t border-cream-200 pt-3">
                          <Counters p={p} compact />
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          {/* Masaüstü: tablo */}
          <div className="mt-6 hidden overflow-hidden rounded-2xl border border-cream-200 bg-white shadow-sm md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-cream-100 text-[11px] font-bold uppercase tracking-wider text-ink-500">
                  <tr>
                    <th className="px-4 py-3">{tt.colProduct}</th>
                    <th className="px-4 py-3">{tt.colPackaging}</th>
                    <th className="px-4 py-3">{tt.colPrice}</th>
                    <th className="px-4 py-3 text-center">{tt.colCase}</th>
                    <th className="px-4 py-3 text-center">{tt.colUnit}</th>
                  </tr>
                </thead>
                {grouped.map(({ cat, items }) => (
                  <tbody key={cat.slug} className="divide-y divide-cream-200">
                    {!active && (
                      <tr className="bg-cream-50"><td colSpan={5} className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-brand-500">{cat.name[lang]}</td></tr>
                    )}
                    {items.map((p) => {
                      const line = lineFor(p.id);
                      return (
                        <tr key={p.id} className={`transition ${line ? "bg-brand-50/50" : "hover:bg-cream-50"}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <ProductIcon category={p.category} />
                              <div className="min-w-0">
                                <p className="font-semibold text-ink-900">{productName(p, lang)}</p>
                                <p className="text-xs text-ink-500">{p.brand}{p.sku !== "—" && <> · <span className="font-mono">{p.sku}</span></>}</p>
                                {lang === "tr" && p.nameNl !== p.name && <p className="text-[11px] text-ink-300" title={tt.catalogName}>{p.nameNl}</p>}
                                {p.tags?.includes("çok satan") && <span className="mt-1 inline-block rounded bg-gold-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-yellow-800">{tt.bestseller}</span>}
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <span className="font-semibold text-ink-900">{formatPackaging(p)}</span>
                            <span className="block text-xs text-ink-500">{tt.caseIs} {p.unitsPerCase} {unitLabel(p, lang)}</span>
                          </td>
                          <td className="px-4 py-3"><PriceCell p={p} /></td>
                          <td className="px-4 py-3"><div className="flex justify-center"><QtyCounter label={tt.caseLabel} value={line?.cases ?? 0} onChange={(v) => cart.setQuantity(p.id, v, line?.units ?? 0)} /></div></td>
                          <td className="px-4 py-3"><div className="flex justify-center"><QtyCounter label={unitLabel(p, lang)} value={line?.units ?? 0} onChange={(v) => cart.setQuantity(p.id, line?.cases ?? 0, v)} /></div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                ))}
              </table>
            </div>
          </div>
        </>
      )}

      {cart.hydrated && cart.lineCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-cream-200 bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(20,22,26,0.12)] backdrop-blur sm:px-6">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 text-white"><ShoppingCart className="h-5 w-5" /></span>
              <div className="text-sm">
                <p className="font-bold text-ink-900">{cart.lineCount} {tt.inCart}</p>
                <p className="text-xs text-ink-500">
                  {cart.totalCases > 0 && `${cart.totalCases} ${t.cart.caseShort}`}
                  {cart.totalCases > 0 && cart.totalUnits > 0 && " + "}
                  {cart.totalUnits > 0 && `${cart.totalUnits} ${t.cart.unitShort}`}
                </p>
              </div>
            </div>
            <button type="button" onClick={cart.open} className="inline-flex items-center gap-2 rounded-full bg-wa px-5 py-2.5 text-sm font-bold text-white hover:bg-wa-dark">
              {tt.viewCart}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
