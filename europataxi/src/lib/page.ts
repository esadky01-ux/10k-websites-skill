import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";

export type LocaleParams = Promise<{ locale: string }>;
export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export interface PageProps {
  params: LocaleParams;
  searchParams?: SearchParams;
}

/** `[locale]` parametresini doğrular; geçersizse 404. */
export async function resolveLocale(params: LocaleParams): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return locale;
}
