interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  as?: "h1" | "h2" | "h3";
  id?: string;
  className?: string;
  /** Başlık boyutu: sayfa başlığı (`page`) veya bölüm başlığı (`section`). */
  level?: "page" | "section";
}

/** Bölüm başlığı: küçük sarı üst etiket, başlık ve isteğe bağlı açıklama. */
export function SectionHeading({ eyebrow, title, description, align = "left", as = "h2", id, className = "", level = "section" }: SectionHeadingProps) {
  const Heading = as;
  const alignment = align === "center" ? "text-center mx-auto" : "";
  // Türkçe uzun kelimeler (ör. "Rezervasyonunuzu") 360 px'de 40 px'lik başlığa sığmıyor;
  // ölçek küçük ekranda bir kademe düşer, `break-words` de taşmayı son çare olarak keser.
  const size = level === "page" ? "text-xl sm:text-2xl md:text-3xl" : "text-lg sm:text-xl md:text-2xl";
  return (
    <div className={`max-w-prose ${alignment} ${className}`}>
      {eyebrow ? (
        <p className="mb-3 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-taxi-ink">
          <span aria-hidden="true" className="inline-block h-px w-6 bg-taxi" />
          {eyebrow}
        </p>
      ) : null}
      <Heading id={id} className={`${size} break-words font-extrabold tracking-tight text-content`}>
        {title}
      </Heading>
      {description ? <p className="mt-4 text-base text-muted md:text-lg">{description}</p> : null}
    </div>
  );
}
