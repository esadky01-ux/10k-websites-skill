"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import ProductIcon from "@/components/ProductIcon";
import { productImage } from "@/data/product-images";
import { useI18n } from "@/i18n/I18nProvider";

/**
 * Ürün küçük görseli. Ürünün görseli varsa tıklanınca büyütülür; yoksa kategori simgesi gösterilir.
 */
export default function ProductThumb({ id, category, name, size = "md" }: { id: string; category: string; name: string; size?: "sm" | "md" }) {
  const src = productImage(id);
  const [open, setOpen] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!src) return <ProductIcon category={category} size={size} />;
  const dim = size === "sm" ? "h-12 w-12" : "h-14 w-14";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${dim} shrink-0 overflow-hidden rounded-lg border border-cream-200 bg-white transition hover:border-brand-500/50 hover:shadow`}
        aria-label={`${name} – ${t.common.enlarge}`}
        title={t.common.enlarge}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={name} loading="lazy" width={112} height={112} className="h-full w-full object-cover" />
      </button>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink-900/70 p-4 backdrop-blur-sm" onClick={() => setOpen(false)} role="dialog" aria-modal="true" aria-label={name}>
          <div className="relative max-h-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setOpen(false)} className="absolute right-3 top-3 rounded-full bg-white/90 p-2 text-ink-700 shadow hover:bg-white" aria-label={t.common.close}>
              <X className="h-5 w-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={name} className="max-h-[80vh] w-auto max-w-full object-contain" />
            <p className="border-t border-cream-200 px-4 py-3 text-sm font-semibold text-ink-900">{name}</p>
          </div>
        </div>
      )}
    </>
  );
}
