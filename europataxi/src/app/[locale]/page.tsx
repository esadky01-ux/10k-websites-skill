import type { Metadata } from "next";
import { AirportTransfers } from "@/components/home/AirportTransfers";
import { Countries } from "@/components/home/Countries";
import { CtaBand } from "@/components/home/CtaBand";
import { FAQ } from "@/components/home/FAQ";
import { Features } from "@/components/home/Features";
import { Fleet } from "@/components/home/Fleet";
import { Hero } from "@/components/home/Hero";
import { HowItWorks } from "@/components/home/HowItWorks";
import { PopularRoutes, type PopularRouteCard } from "@/components/home/PopularRoutes";
import { getLocation } from "@/data/locations";
import { popularRoutes } from "@/data/routes";
import type { Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/getDictionary";
import { fill, resolveKey } from "@/i18n/utils";
import { SERVICE_TIME_ZONE, todayISO } from "@/lib/dates";
import { pageMetadata } from "@/lib/metadata";
import { resolveLocale, type PageProps } from "@/lib/page";
import { estimateDistanceKm, estimateDurationMinutes, formatPrice, splitDuration, startingPrice } from "@/lib/pricing";

/** "Bugün" her istekte Brüksel saatine göre hesaplansın; derleme anında donmasın. */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const dict = await getDictionary(locale);
  return pageMetadata({
    locale,
    page: "home",
    title: dict.meta.home.title,
    description: dict.meta.home.description,
    siteName: dict.meta.siteName,
  });
}

/** 165 dakika → "2 sa 45 dk"; tam saatlerde dakika yazılmaz. */
function formatDuration(totalMinutes: number, dict: Dictionary): string {
  const { hours, minutes } = splitDuration(totalMinutes);
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} ${dict.common.hoursShort}`);
  if (minutes > 0 || hours === 0) parts.push(`${minutes} ${dict.common.minutesShort}`);
  return parts.join(" ");
}

/** Popüler rota kartlarını sunucuda hazırlar: adlar, sedan başlangıç fiyatı, mesafe ve süre. */
function buildPopularRoutes(dict: Dictionary, locale: Locale): PopularRouteCard[] {
  return popularRoutes.flatMap((route) => {
    const from = getLocation(route.from);
    const to = getLocation(route.to);
    if (!from || !to) return [];
    const km = estimateDistanceKm(route.from, route.to);
    return [
      {
        id: route.id,
        from: route.from,
        to: route.to,
        fromName: resolveKey(dict, from.name),
        toName: resolveKey(dict, to.name),
        price: formatPrice(startingPrice(route.from, route.to), locale),
        km,
        duration: fill(dict.popularRoutes.duration, { duration: formatDuration(estimateDurationMinutes(km), dict) }),
      },
    ];
  });
}

export default async function HomePage({ params }: PageProps) {
  const locale = await resolveLocale(params);
  const dict = await getDictionary(locale);
  const today = todayISO(SERVICE_TIME_ZONE);
  const routes = buildPopularRoutes(dict, locale);

  return (
    <>
      <Hero locale={locale} dict={dict} today={today} />
      <Features locale={locale} dict={dict} />
      <Fleet locale={locale} dict={dict} />
      <HowItWorks locale={locale} dict={dict} />
      <PopularRoutes routes={routes} dict={dict.popularRoutes} />
      <Countries locale={locale} dict={dict} />
      <AirportTransfers locale={locale} dict={dict} />
      <FAQ dict={dict.faq} />
      <CtaBand locale={locale} dict={dict} />
    </>
  );
}
