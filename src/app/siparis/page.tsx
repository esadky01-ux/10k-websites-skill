import { Suspense } from "react";
import type { Metadata } from "next";
import QuickOrderMatrix from "@/components/QuickOrderMatrix";

export const metadata: Metadata = {
  title: "Hızlı Sipariş | Ürünler",
  description:
    "MAXIMUS Food & Horeca hızlı sipariş tablosu: soslar, et ürünleri, dondurulmuş gıda, ambalaj, içecek ve kuru gıdayı koli bazında tek ekrandan sipariş edin.",
  alternates: { canonical: "/siparis" },
};

export default function OrderPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-32 pt-8 sm:px-6">
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">Hızlı Sipariş</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink-900 sm:text-4xl">Ürünler</h1>
        <p className="mt-2 max-w-2xl text-ink-500">
          Onlarca koliyi tek ekrandan girin. Fiyatlar B2B müşterilerimize teklif olarak iletilir;
          sepetinizi WhatsApp&apos;a gönderdiğinizde aynı gün onay alırsınız.
        </p>
      </div>
      <Suspense fallback={<div className="py-20 text-center text-ink-500">Ürünler yükleniyor…</div>}>
        <QuickOrderMatrix />
      </Suspense>
    </div>
  );
}
