"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Trash2, MessageCircle, Truck, Warehouse, ShoppingCart, ArrowRight, Copy, Check } from "lucide-react";
import Link from "next/link";
import { useCart } from "@/components/CartProvider";
import { getProduct, formatPackaging } from "@/data/products";
import { buildWhatsAppMessage, whatsappUrl } from "@/lib/whatsapp";
import { site } from "@/lib/site";
import ProductIcon from "@/components/ProductIcon";
import QtyCounter from "@/components/QtyCounter";
import type { DeliveryType } from "@/lib/cart";

export default function CartDrawer() {
  const cart = useCart();
  const { isOpen, close } = cart;
  const [company, setCompany] = useState("");
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);

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
        ? buildWhatsAppMessage({ lines: cart.lines, delivery: cart.delivery, company, note })
        : "",
    [cart.lines, cart.delivery, company, note]
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* pano erişimi yoksa sessizce geç */
    }
  };

  const deliveryOptions: { value: DeliveryType; label: string; sub: string; Icon: typeof Truck }[] = [
    { value: "adres", label: "Adrese Teslimat", sub: "Soğuk zincir araçla işletmenize", Icon: Truck },
    { value: "depo", label: "Depodan Teslim Alma", sub: "Aarschot deposundan · %15 indirim", Icon: Warehouse },
  ];

  return (
    <>
      {/* Arka plan */}
      <div
        aria-hidden
        onClick={cart.close}
        className={`fixed inset-0 z-50 bg-ink-900/60 backdrop-blur-[2px] transition-opacity duration-300 ${
          cart.isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      {/* Çekmece */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Sepetim"
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${
          cart.isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-cream-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-brand-600" />
            <h2 className="text-lg font-bold text-ink-900">Sepetim</h2>
            {cart.lineCount > 0 && (
              <span className="rounded-full bg-cream-100 px-2 py-0.5 text-xs font-semibold text-ink-700">
                {cart.lineCount} kalem
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={cart.close}
            aria-label="Sepeti kapat"
            className="rounded-full p-2 text-ink-500 hover:bg-cream-100 hover:text-ink-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {cart.lines.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cream-100">
                <ShoppingCart className="h-7 w-7 text-ink-300" />
              </div>
              <p className="font-semibold text-ink-900">Sepetiniz henüz boş</p>
              <p className="text-sm text-ink-500">
                Hızlı sipariş tablosundan koli ve adet girerek ürün ekleyin.
              </p>
              <Link
                href="/siparis"
                onClick={cart.close}
                className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Ürünlere Git <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-cream-200">
              {cart.lines.map((line) => {
                const p = getProduct(line.productId);
                if (!p) return null;
                return (
                  <div key={line.productId} className="flex gap-3 px-5 py-4">
                    <ProductIcon category={p.category} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink-900">{p.name}</p>
                      <p className="text-xs text-ink-500">
                        {p.brand} · {formatPackaging(p)} · {p.sku}
                      </p>
                      <div className="mt-2 flex items-end gap-3">
                        <QtyCounter
                          compact
                          label="Koli"
                          value={line.cases}
                          onChange={(v) => cart.setQuantity(p.id, v, line.units)}
                        />
                        <QtyCounter
                          compact
                          label={p.unitLabel}
                          value={line.units}
                          onChange={(v) => cart.setQuantity(p.id, line.cases, v)}
                        />
                        <button
                          type="button"
                          onClick={() => cart.remove(p.id)}
                          aria-label={`${p.name} ürününü sepetten çıkar`}
                          className="mb-5 ml-auto rounded-full p-2 text-ink-300 hover:bg-brand-50 hover:text-brand-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
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
              <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-500">
                Teslimat Tipi
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {deliveryOptions.map((opt) => {
                  const active = cart.delivery === opt.value;
                  return (
                    <label
                      key={opt.value}
                      className={`relative flex cursor-pointer flex-col gap-1 rounded-xl border p-3 text-left transition ${
                        active
                          ? "border-brand-500 bg-white ring-2 ring-brand-500/20"
                          : "border-cream-200 bg-white hover:border-ink-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="teslimat"
                        value={opt.value}
                        checked={active}
                        onChange={() => cart.setDelivery(opt.value)}
                        className="sr-only"
                      />
                      <opt.Icon className={`h-5 w-5 ${active ? "text-brand-600" : "text-ink-500"}`} />
                      <span className="text-sm font-semibold text-ink-900">{opt.label}</span>
                      <span className="text-[11px] leading-snug text-ink-500">{opt.sub}</span>
                      {opt.value === "depo" && (
                        <span className="absolute right-2 top-2 rounded-full bg-gold-500 px-1.5 py-0.5 text-[10px] font-black text-ink-900">
                          -%15
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="grid grid-cols-1 gap-2">
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="İşletme adı (isteğe bağlı)"
                className="w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Sipariş notu (isteğe bağlı)"
                className="w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-500">Toplam</span>
              <span className="font-bold text-ink-900">
                {cart.totalCases > 0 && `${cart.totalCases} koli`}
                {cart.totalCases > 0 && cart.totalUnits > 0 && " + "}
                {cart.totalUnits > 0 && `${cart.totalUnits} paket/adet`}
              </span>
            </div>
            <p className="text-xs text-ink-500">
              Fiyatlar teklif üzerine bildirilir. Siparişiniz WhatsApp üzerinden aynı gün onaylanır.
            </p>

            <div className="flex gap-2">
              <a
                href={whatsappUrl(message)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-wa px-5 py-3 text-sm font-bold text-white shadow-md transition hover:bg-wa-dark"
              >
                <MessageCircle className="h-5 w-5" />
                WhatsApp ile Sipariş Gönder
              </a>
              <button
                type="button"
                onClick={copy}
                aria-label="Sipariş fişini kopyala"
                title="Sipariş fişini kopyala"
                className="rounded-full border border-cream-200 bg-white px-3 text-ink-700 hover:border-ink-300"
              >
                {copied ? <Check className="h-4.5 w-4.5 text-wa" /> : <Copy className="h-4.5 w-4.5" />}
              </button>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-ink-500">{site.whatsapp.replace(/^32/, "+32 ")}</span>
              <button
                type="button"
                onClick={cart.clear}
                className="font-semibold text-ink-500 underline-offset-2 hover:text-brand-600 hover:underline"
              >
                Sepeti temizle
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
