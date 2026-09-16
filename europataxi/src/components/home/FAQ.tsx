"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { SectionHeading } from "@/components/ui";
import type { Dictionary } from "@/i18n/getDictionary";

interface FAQProps {
  dict: Dictionary["faq"];
}

/**
 * Erişilebilir akordeon: her soru bir `h3 > button` (aria-expanded/aria-controls),
 * her yanıt `role="region"` bir panel. Birden fazla panel aynı anda açık kalabilir;
 * klavye desteği doğal butonlardan gelir (Tab, Enter, Boşluk).
 */
export function FAQ({ dict }: FAQProps) {
  const baseId = useId();
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set([0]));

  function toggle(index: number) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <section aria-labelledby="faq-title" className="bg-surface py-16 md:py-24">
      <div className="container grid gap-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-16">
        <SectionHeading id="faq-title" eyebrow={dict.eyebrow} title={dict.title} />
        <div className="divide-y divide-line border-y border-line">
          {dict.items.map((item, index) => {
            const isOpen = open.has(index);
            const buttonId = `${baseId}-q${index}`;
            const panelId = `${baseId}-a${index}`;
            return (
              <div key={item.question}>
                <h3>
                  <button
                    type="button"
                    id={buttonId}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => toggle(index)}
                    className="flex w-full items-center justify-between gap-4 py-5 text-left text-base font-bold text-content transition-colors hover:text-taxi-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-taxi-ink motion-reduce:transition-none md:text-lg"
                  >
                    <span className="break-words">{item.question}</span>
                    <ChevronDown
                      aria-hidden="true"
                      className={`h-5 w-5 shrink-0 text-taxi-ink transition-transform motion-reduce:transition-none ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                </h3>
                <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!isOpen} className="pb-5">
                  <p className="max-w-prose text-base text-muted">{item.answer}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
