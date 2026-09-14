import { intlLocale, type Locale } from "@/i18n/config";

export function formatEur(value: number, lang: Locale): string {
  return new Intl.NumberFormat(intlLocale[lang], { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(value);
}

export function formatDate(iso: string, lang: Locale): string {
  return new Date(iso).toLocaleDateString(intlLocale[lang], { day: "numeric", month: "long", year: "numeric" });
}
