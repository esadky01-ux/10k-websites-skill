import { sendText, isConfigured } from "@/server/whatsapp/cloudapi";
import type { CustomerRecord } from "@/server/store";
import { site } from "@/lib/site";

/**
 * Yeni kayıt bildirimi: ADMIN_WHATSAPP tanımlı ve Cloud API yapılandırılmışsa sahibe WhatsApp mesajı gönderir,
 * aksi halde sunucu günlüğüne yazar. Onay yönetim panelinden (/beheer) yapılır.
 */
export async function notifyOwnerNewRegistration(c: CustomerRecord): Promise<void> {
  const text = [
    `🆕 Nieuwe klantregistratie — wacht op goedkeuring`,
    `Zaak: ${c.company}${c.vat ? ` (${c.vat})` : ""}`,
    `Contact: ${c.firstName} ${c.lastName}`,
    `Tel: ${c.phone}`,
    `E-mail: ${c.email}`,
    c.city ? `Plaats: ${[c.postcode, c.city].filter(Boolean).join(" ")}` : null,
    `Goedkeuren: ${site.url}/beheer`,
  ]
    .filter(Boolean)
    .join("\n");
  const to = process.env.ADMIN_WHATSAPP;
  if (to && isConfigured()) {
    try {
      await sendText(to, text);
      return;
    } catch (err) {
      console.error("[notify] WhatsApp bildirimi gönderilemedi", err);
    }
  }
  console.info(`[notify] ${text.replace(/\n/g, " | ")}`);
}
