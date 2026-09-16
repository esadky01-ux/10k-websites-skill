"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
// Kabul edilen tek istisna: hata sınırı bir istemci bileşenidir ve düzenden sözlük alamaz.
// Bu yüzden yalnızca bu dosya Türkçe sözlüğü doğrudan içe aktarır (EN/FR şimdilik Türkçeye düşer).
import tr from "@/i18n/dictionaries/tr.json";
import { Button, ButtonLink, SectionHeading } from "@/components/ui";
import { localeFromPath, localizedPath } from "@/lib/paths";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/** Sayfa düzeyinde hata sınırı: header ve footer yerinde kalır, yalnızca içerik yerine bu ekran gelir. */
export default function LocaleError({ error, reset }: ErrorPageProps) {
  const locale = localeFromPath(usePathname());

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="container flex flex-col items-start gap-8 py-16 md:py-24">
      <SectionHeading as="h1" level="page" title={tr.errorPage.title} description={tr.errorPage.description} />
      <div className="flex flex-wrap gap-3">
        <Button onClick={reset}>{tr.errorPage.retry}</Button>
        <ButtonLink variant="secondary" href={localizedPath(locale)}>
          {tr.errorPage.home}
        </ButtonLink>
      </div>
    </section>
  );
}
