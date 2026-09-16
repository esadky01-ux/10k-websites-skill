import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { TaxiStripe } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/getDictionary";
import { BOOKING_WIDGET_ID, localizedPath } from "@/lib/paths";

interface CtaBandProps {
  locale: Locale;
  dict: Dictionary;
}

/**
 * Sarı zemin üzerinde siyah buton (birincil butonun tersi). `Button` varyantlarının
 * renk sınıfları Tailwind çıktısında alfabetik sırayla geldiği için `className` ile
 * ezilemez; bu yüzden aynı geometriyle ayrı bir sınıf listesi kullanılır.
 */
const invertedButtonClasses =
  "inline-flex min-h-14 shrink-0 items-center justify-center gap-2 rounded-md bg-surface px-8 text-lg font-bold leading-none text-content transition-colors motion-reduce:transition-none hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-on-taxi focus-visible:ring-offset-2 focus-visible:ring-offset-taxi";

/** Sayfanın tek "yüksek sesli" anı: dama şeritli sarı bant, widget'a dönen siyah CTA. */
export function CtaBand({ locale, dict }: CtaBandProps) {
  return (
    <section aria-labelledby="cta-band-title" className="bg-taxi text-on-taxi">
      <TaxiStripe />
      <div className="container flex flex-col items-start gap-8 py-16 md:flex-row md:items-center md:justify-between md:py-20">
        <div className="max-w-prose">
          <h2 id="cta-band-title" className="text-xl font-extrabold tracking-tight md:text-2xl">
            {dict.ctaBand.title}
          </h2>
          <p className="mt-3 text-base font-medium md:text-lg">{dict.ctaBand.description}</p>
        </div>
        <Link href={localizedPath(locale, "home", { hash: BOOKING_WIDGET_ID })} className={invertedButtonClasses}>
          {dict.ctaBand.button}
          <ArrowRight aria-hidden="true" className="h-5 w-5" />
        </Link>
      </div>
      
    </section>
  );
}
