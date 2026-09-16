interface SkipLinkProps {
  /** Görünür metin, ör. "İçeriğe geç". */
  label: string;
}

/** Klavye kullanıcıları için sayfanın ilk odak noktası; yalnızca odaklanınca görünür ve `#main`'e atlar. */
export function SkipLink({ label }: SkipLinkProps) {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-md focus:bg-taxi focus:px-4 focus:text-base focus:font-bold focus:text-on-taxi focus:outline-none focus:ring-4 focus:ring-content"
    >
      {label}
    </a>
  );
}
