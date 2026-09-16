"use client";

import { ArrowRight } from "lucide-react";
import { useId } from "react";
import { SectionHeading } from "@/components/ui";
import type { Dictionary } from "@/i18n/getDictionary";
import { fill } from "@/i18n/utils";
import { prefillBookingWidget } from "@/lib/widget-events";

/** Sunucuda hesaplanıp istemciye serileştirilen kart verisi. */
export interface PopularRouteCard {
  id: string;
  from: string;
  to: string;
  fromName: string;
  toName: string;
  /** Biçimlendirilmiş başlangıç fiyatı, ör. "128 €". */
  price: string;
  km: number;
  /** Sözlükten doldurulmuş tahmini süre metni (isteğe bağlı). */
  duration?: string;
}

interface PopularRoutesProps {
  routes: PopularRouteCard[];
  dict: Dictionary["popularRoutes"];
}

/** Popüler rotalar: her kart bir buton; tıklanınca widget'ı doldurur ve widget'a kaydırır. */
export function PopularRoutes({ routes, dict }: PopularRoutesProps) {
  const baseId = useId();
  return (
    <section aria-labelledby="popular-routes-title" className="bg-ink py-16 md:py-24">
      <div className="container">
        <SectionHeading id="popular-routes-title" eyebrow={dict.eyebrow} title={dict.title} description={dict.description} />
        <ul role="list" className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {routes.map((route) => {
            const metaId = `${baseId}-${route.id}`;
            return (
              <li key={route.id}>
                <button
                  type="button"
                  aria-label={fill(dict.select, { from: route.fromName, to: route.toName })}
                  aria-describedby={metaId}
                  onClick={() => prefillBookingWidget({ from: route.from, to: route.to })}
                  className="group flex h-full w-full flex-col rounded-lg border border-line bg-ink-soft p-5 text-left transition-colors motion-reduce:transition-none hover:border-taxi focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-taxi focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
                >
                  <span className="flex min-w-0 flex-col gap-1 text-base font-bold text-paper">
                    <span className="break-words">{route.fromName}</span>
                    <span className="flex items-start gap-2">
                      <ArrowRight
                        aria-hidden="true"
                        className="mt-1 h-4 w-4 shrink-0 text-taxi motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
                      />
                      <span className="break-words">{route.toName}</span>
                    </span>
                  </span>
                  <span id={metaId} className="mt-4 flex w-full items-end justify-between gap-3 border-t border-line pt-4">
                    <span className="flex flex-col">
                      <span className="text-sm text-muted">{dict.startingFrom}</span>
                      <span className="text-lg font-extrabold tabular-nums text-paper">{route.price}</span>
                      <span className="text-sm text-muted">{dict.perVehicle}</span>
                    </span>
                    <span className="flex flex-col items-end text-right text-sm text-muted">
                      <span>{fill(dict.distance, { km: route.km })}</span>
                      {route.duration ? <span>{route.duration}</span> : null}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
