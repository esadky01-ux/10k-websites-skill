import { intlLocale, type Locale } from "@/i18n/config";

/** Hizmetin verildiği saat dilimi; sunucu tarafı "bugün" hesabında kullanılır. */
export const SERVICE_TIME_ZONE = "Europe/Brussels";

/** Bugünün tarihi `YYYY-MM-DD` biçiminde. `timeZone` verilmezse cihazın yerel tarihi. */
export function todayISO(timeZone?: string): string {
  const now = new Date();
  if (!timeZone) {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  // en-CA yereli tarihi doğrudan YYYY-MM-DD olarak üretir.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** "00:00", "00:15", … "23:45" */
export function timeOptions(stepMinutes = 15): string[] {
  const out: string[] = [];
  for (let m = 0; m < 24 * 60; m += stepMinutes) {
    const h = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    out.push(`${h}:${mm}`);
  }
  return out;
}

/** Saati bir sonraki 15 dakikalık dilime yuvarlar (widget'ın varsayılan saati için). */
export function nextQuarterHour(date = new Date()): string {
  const m = date.getHours() * 60 + date.getMinutes();
  const rounded = Math.min(Math.ceil((m + 1) / 15) * 15, 23 * 60 + 45);
  const h = String(Math.floor(rounded / 60)).padStart(2, "0");
  const mm = String(rounded % 60).padStart(2, "0");
  return `${h}:${mm}`;
}

/** `YYYY-MM-DD` tarihini dile göre uzun biçimde yazar (ör. "2 Ekim 2026 Cuma"). */
export function formatDate(iso: string, locale: Locale): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** İki tarih-saat çiftini karşılaştırır: negatif = a önce, 0 = eşit, pozitif = a sonra. */
export function compareDateTime(dateA: string, timeA: string, dateB: string, timeB: string): number {
  const a = `${dateA}T${timeA}`;
  const b = `${dateB}T${timeB}`;
  return a < b ? -1 : a > b ? 1 : 0;
}
