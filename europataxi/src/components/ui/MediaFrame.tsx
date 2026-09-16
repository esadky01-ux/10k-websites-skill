import Image from "next/image";
import type { ReactNode } from "react";

interface MediaFrameProps {
  /** `mediaSrc()` sonucu; `null` ise `fallback` çizilir. */
  src: string | null;
  /** Ekran okuyucu için açıklama. Dekoratif kullanımda boş dize verin. */
  alt: string;
  width: number;
  height: number;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  /** Fotoğraf yoksa gösterilecek içerik (çizim, sade yüzey). */
  fallback?: ReactNode;
}

/**
 * Fotoğraf yuvası. Dosya varsa oranı korunmuş, köşeleri yuvarlatılmış bir
 * görsel; yoksa yedek içerik çizilir. Böylece site fotoğraf eklenmeden de
 * eksiksiz görünür.
 */
export function MediaFrame({ src, alt, width, height, className = "", imageClassName = "", priority, fallback = null }: MediaFrameProps) {
  if (!src) return <>{fallback}</>;
  return (
    <div className={`overflow-hidden rounded-lg border border-line bg-surface-2 ${className}`}>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        sizes="(min-width: 1024px) 50vw, 100vw"
        className={`h-full w-full object-cover ${imageClassName}`}
      />
    </div>
  );
}
