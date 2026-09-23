import { MediaFrame, SectionHeading } from "@/components/ui";
import { mediaSrc } from "@/lib/media";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/getDictionary";

interface HowItWorksProps {
  locale: Locale;
  dict: Dictionary;
}

/**
 * Nasıl çalışır: gerçek bir sıra olduğu için numaralı liste. Adımlar sarı bir
 * dikey çizgiyle birbirine bağlanır (çizgi her `li`'nin `before` sözde öğesidir).
 */
export function HowItWorks({ dict }: HowItWorksProps) {
  return (
    <section aria-labelledby="how-it-works-title" className="bg-surface py-16 md:py-24">
      <div className="container grid gap-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-16">
        <div>
          <SectionHeading id="how-it-works-title" eyebrow={dict.howItWorks.eyebrow} title={dict.howItWorks.title} />
          <MediaFrame
            src={mediaSrc("familyVan")}
            alt={dict.howItWorks.photoAlt}
            width={720}
            height={405}
            className="mt-10 aspect-[16/9]"
          />
        </div>
        <ol role="list">
          {dict.howItWorks.steps.map((step, index) => (
            <li
              key={step.title}
              className="relative flex gap-6 pb-10 before:absolute before:bottom-0 before:left-6 before:top-12 before:w-px before:bg-taxi before:content-[''] last:pb-0 last:before:hidden"
            >
              <span
                aria-hidden="true"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-taxi text-base font-extrabold tabular-nums text-on-taxi ring-8 ring-surface"
              >
                {index + 1}
              </span>
              <div className="min-w-0 pt-2.5">
                <h3 className="text-lg font-bold text-content">{step.title}</h3>
                <p className="mt-1.5 max-w-prose text-base text-muted">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
