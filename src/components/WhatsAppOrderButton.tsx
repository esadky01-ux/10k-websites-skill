"use client";

import { MessageCircle } from "lucide-react";
import { useCart } from "@/components/CartProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { whatsappUrl } from "@/lib/whatsapp";

/**
 * Sayfanın sağ alt köşesindeki sabit WhatsApp sipariş düğmesi.
 * Müşterinin dilinde hazır bir mesajla WhatsApp'ı açar; sepet ve sipariş akışına dokunmaz
 * (sepetteki siparişi göndermek için sepet panelindeki WhatsApp düğmesi kullanılır).
 */
export default function WhatsAppOrderButton() {
  const { t } = useI18n();
  const cart = useCart();
  const label = t.whatsapp.orderButton;
  const href = whatsappUrl(t.whatsapp.orderPrefill);
  // Sepette ürün varken sipariş sayfasının altında sabit sepet çubuğu belirir (en çok 85 piksel).
  // Düğme o çubuğun "sepete git" eylemini kapatmasın diye yukarı kayar.
  const bottom = cart.hydrated && cart.lineCount > 0 ? "bottom-28" : "bottom-5";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      data-testid="whatsapp-order"
      className={`fixed ${bottom} end-5 z-[45] inline-flex h-14 items-center gap-2 rounded-full bg-wa px-4 text-white shadow-xl shadow-green-900/25 transition-all duration-200 hover:scale-105 hover:bg-wa-dark sm:h-16 sm:px-5`}
    >
      <MessageCircle className="h-6 w-6 shrink-0 sm:h-7 sm:w-7" aria-hidden />
      <span className="hidden text-sm font-bold sm:inline">{label}</span>
    </a>
  );
}
