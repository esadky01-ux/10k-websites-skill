/**
 * Kategori metinlerinin diğer dillerdeki karşılıkları.
 *
 * Hollandaca ve Türkçe metinler categories.ts içinde kaynaktır; Fransızca, İngilizce, Kürtçe ve
 * Arapça çeviriler ayrı JSON dosyalarında durur (çeviri güncellemesi kod değişikliği gerektirmesin diye).
 * Bir dilde karşılık yoksa o dilin içerik diline (contentLocale) düşülür, arayüz hiçbir zaman boş kalmaz.
 */
import { contentLocale, type Locale } from "@/i18n/config";
import type { Category } from "./categories";
import fr from "./categories.fr.json";
import en from "./categories.en.json";

type CategoryText = { name: string; shortName: string; description: string };
type CategoryTexts = Record<string, CategoryText>;

const overlays: Partial<Record<Locale, CategoryTexts>> = {
  fr: fr as CategoryTexts,
  en: en as CategoryTexts,
};

function field(c: Category, lang: Locale, key: keyof CategoryText): string {
  const t = overlays[lang]?.[c.slug]?.[key];
  return t && t.trim() ? t : c[key][contentLocale[lang]];
}

export function categoryName(c: Category, lang: Locale): string {
  return field(c, lang, "name");
}

export function categoryShortName(c: Category, lang: Locale): string {
  return field(c, lang, "shortName");
}

export function categoryDescription(c: Category, lang: Locale): string {
  return field(c, lang, "description");
}
