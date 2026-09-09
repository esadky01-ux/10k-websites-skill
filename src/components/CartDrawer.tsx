"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { X, Trash2, MessageCircle, Truck, Warehouse, ShoppingCart, ArrowRight, Copy, Check, BookmarkPlus } from "lucide-react";
import { useCart } from "@/components/CartProvider";
import { useAuth } from "@/components/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { localePath } from "@/i18n/config";
import { getProduct, formatPackaging, productName, unitLabel } from "@/data/products";
import { buildWhatsAppMessage, whatsappUrl } from "@/lib/whatsapp";
import { site } from "@/lib/site";
import { formatEur } from "@/lib/format";
import ProductIcon from "@/components/ProductIcon";
import QtyCounter from "@/components/QtyCounter";
import type { DeliveryType } from "@/lib/cart";

export default function CartDrawer() {
  const cart = useCart();
  const { isOpen, close } = cart;
  const { customer, prices } = useAuth();
  const { lang, t } = useI18n();
  const tc = t.cart;
  const [company, setCompany] = useState("");
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, close]);

  const message = useMemo(
    () =>
      cart.lines.length
        ? buildWhatsAppMessage({ lines: cart.lines, delivery: cart.delivery, company: company || customer?.company, note, lang, prices, customerName: customer?.contact })
        : "",
    [cart.lines, cart.delivery, company, note, lang, prices, customer]
  );

  const totals = useMemo(() => {
    if (!prices) return null;
    let sum = 0, any = false;
    for (const l of cart.lines) {
      const p = getProduct(l.productId);
      const price = prices[l.productId];
      if (!p || price === undefined) continue;
      any = true;
      sum += l.cases * price + (l.units * price) / Math.max(1, p.unitsPerCase);
    }
    if (!any) return null;
    const discount = cart.delivery === "depo" ? sum * site.pickupDiscount : 0;
    return { sum, discount, total: sum - discount };
  }, [cart.lines, cart.delivery, prices]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* pano yoksa sessizce geç */ }
  };

  /** WhatsApp'a giderken siparişi hesaba kaydet (giriş yapılmışsa). */
  const recordOrder = () => {
    if (!customer || !cart.lines.length) return;
    void fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines: cart.lines, delivery: cart.delivery, note }),
      keepalive: true,
    });
  };

  const saveList = async () => {
    if (!customer) return;
    const name = window.prompt(tc.saveListPrompt);
    if (!name) return;
    const res = await fetch("/api/lists", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, lines: cart.lines }) });
    if (res.ok) {
      setSavedMsg(tc.saved);
      setTimeout(() => setSavedMsg(null), 2500);
    }
  };

  const deliveryOptions: { value: DeliveryType; label: string; sub: string; Icon: typeof Truck }[] = [
    { value: "adres", label: tc.delivery, sub: tc.deliverySub, Icon: Truck },
    { value: "depo", label: tc.pickup, sub: tc.pickupSub, Icon: Warehouse },
  ];

  return (
    <>
      <div aria-hidden onClick={close} className={`fixed inset-0 z-50 bg-ink-900/60 backdrop-blur-[2px] transition-opacity duration-300 ${isOpen ? "opacity-100" : "pointer-events-none opacity-0"}`} />
      <aside role="dialog" aria-modal="true" aria-label={tc.title} translate="no" className={`notranslate fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${isOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center justify-between border-b border-cream-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-brand-500" />
            <h2 className="text-lg font-bold text-ink-900">{tc.title}</h2>
            {cart.lineCount > 0 && <span className="rounded-full bg-cream-100 px-2 py-0.5 text-xs font-semibold text-ink-700">{cart.lineCount} {tc.items}</span>}
          </div>
          <button type="button" onClick={close} aria-label={tc.close} className="rounded-full p-2 text-ink-500 hover:bg-cream-100 hover:text-ink-900"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {cart.lines.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cream-100"><ShoppingCart className="h-7 w-7 text-ink-300" /></div>
              <p className="font-semibold text-ink-900">{tc.empty}</p>
              <p className="text-sm text-ink-500">{tc.emptyText}</p>
              <Link href={localePath(lang, "order")} onClick={close} className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">{tc.goToProducts} <ArrowRight className="h-4 w-4" /></Link>
            </div>
          ) : (
            <div className="divide-y divide-cream-200">
              {cart.lines.map((line) => {
                const p = getProduct(line.productId);
                if (!p) return null;
                const price = prices?.[p.id];
                return (
                  <div key={line.productId} className="flex gap-3 px-5 py-4">
                    <ProductIcon category={p.category} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink-900">{productName(p, lang)}</p>
                      <p className="text-xs text-ink-500">{p.brand} · {formatPackaging(p)}{p.sku !== "—" && ` · ${p.sku}`}{price !== undefined && ` · ${formatEur(price, lang)}${t.order.priceUnit ? " " + t.order.priceUnit : ""}`}</p>
                      <div className="mt-2 flex items-end gap-3">
                        <QtyCounter compact label={t.order.caseLabel} value={line.cases} onChange={(v) => cart.setQuantity(p.id, v, line.units)} />
                        <QtyCounter compact label={unitLabel(p, lang)} value={line.units} onChange={(v) => cart.setQuantity(p.id, line.cases, v)} />
                        <button type="button" onClick={() => cart.remove(p.id)} aria-label={`${productName(p, lang)} ${tc.remove}`} className="mb-5 ml-auto rounded-full p-2 text-ink-300 hover:bg-brand-50 hover:text-brand-500"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {cart.lines.length > 0 && (
          <div className="space-y-4 border-t border-cream-200 bg-cream-50 px-5 py-4">
            <fieldset>
              <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-500">{tc.deliveryType}</legend>
              <div className="grid grid-cols-2 gap-2">
                {deliveryOptions.map((opt) => {
                  const active = cart.delivery === opt.value;
                  return (
                    <label key={opt.value} className={`relative flex cursor-pointer flex-col gap-1 rounded-xl border p-3 text-left transition ${active ? "border-brand-500 bg-white ring-2 ring-brand-500/20" : "border-cream-200 bg-white hover:border-ink-300"}`}>
                      <input type="radio" name="delivery" value={opt.value} checked={active} onChange={() => cart.setDelivery(opt.value)} className="sr-only" />
                      <opt.Icon className={`h-5 w-5 ${active ? "text-brand-500" : "text-ink-500"}`} />
                      <span className="text-sm font-semibold text-ink-900">{opt.label}</span>
                      <span className="text-[11px] leading-snug text-ink-500">{opt.sub}</span>
                      {opt.value === "depo" && <span className="absolute right-2 top-2 rounded-full bg-gold-500 px-1.5 py-0.5 text-[10px] font-black text-ink-900">-15%</span>}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="grid grid-cols-1 gap-2">
              {!customer && <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder={tc.company} className="w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500" />}
              <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder={tc.note} className="w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500" />
            </div>

            <div className="space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-ink-500">{tc.total}</span>
                <span className="font-bold text-ink-900">
                  {cart.totalCases > 0 && `${cart.totalCases} ${tc.caseShort}`}
                  {cart.totalCases > 0 && cart.totalUnits > 0 && " + "}
                  {cart.totalUnits > 0 && `${cart.totalUnits} ${tc.unitShort}`}
                </span>
              </div>
              {totals && (
                <>
                  <div className="flex items-center justify-between text-ink-500"><span>{tc.subtotal}</span><span>{formatEur(totals.sum, lang)}</span></div>
                  {totals.discount > 0 && <div className="flex items-center justify-between text-wa-dark"><span>{tc.discount}</span><span>-{formatEur(totals.discount, lang)}</span></div>}
                  <div className="flex items-center justify-between text-base font-bold text-ink-900"><span>{tc.estimate}</span><span data-testid="cart-estimate">{formatEur(totals.total, lang)}</span></div>
                </>
              )}
            </div>
            <p className="text-xs text-ink-500">{customer ? tc.priceNoteLoggedIn : tc.priceNote}</p>

            <div className="flex gap-2">
              <a href={whatsappUrl(message)} target="_blank" rel="noopener noreferrer" onClick={recordOrder} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-wa px-5 py-3 text-sm font-bold text-white shadow-md transition hover:bg-wa-dark">
                <MessageCircle className="h-5 w-5" />
                {tc.sendWhatsApp}
              </a>
              <button type="button" onClick={copy} aria-label={tc.copy} title={tc.copy} className="rounded-full border border-cream-200 bg-white px-3 text-ink-700 hover:border-ink-300">
                {copied ? <Check className="h-4.5 w-4.5 text-wa" /> : <Copy className="h-4.5 w-4.5" />}
              </button>
            </div>
            <div className="flex items-center justify-between text-xs">
              {customer ? (
                <button type="button" onClick={saveList} className="inline-flex items-center gap-1 font-semibold text-brand-500 hover:text-brand-600">
                  <BookmarkPlus className="h-3.5 w-3.5" />
                  {savedMsg ?? tc.saveList}
                </button>
              ) : (
                <Link href={localePath(lang, "login")} onClick={close} className="font-semibold text-brand-500 hover:text-brand-600">{tc.loginHint}</Link>
              )}
              <button type="button" onClick={cart.clear} className="font-semibold text-ink-500 underline-offset-2 hover:text-brand-500 hover:underline">{tc.clear}</button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
