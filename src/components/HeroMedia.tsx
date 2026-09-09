"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

/**
 * Hero arka planı: masaüstünde kısa sessiz döngü videosu (varsa), mobilde ve
 * hareket azaltma tercihinde statik görsel. Video yalnızca görüntü alanına
 * girdiğinde yüklenir; poster olarak aynı görsel kullanılır.
 */
export default function HeroMedia({ video, poster, alt }: { video?: string; poster: string; alt: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [useVideo, setUseVideo] = useState(false);

  useEffect(() => {
    if (!video) return;
    const wide = window.matchMedia("(min-width: 768px)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (wide && !reduce && !saveData) {
      const id = window.setTimeout(() => setUseVideo(true), 0);
      return () => window.clearTimeout(id);
    }
  }, [video]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !useVideo) return;
    el.play().catch(() => setUseVideo(false));
  }, [useVideo]);

  return (
    <>
      <Image src={poster} alt={alt} fill priority sizes="100vw" className={`object-cover object-[70%_center] transition-opacity duration-700 ${useVideo ? "opacity-0" : "opacity-100"}`} />
      {useVideo && video && (
        <video
          ref={ref}
          className="absolute inset-0 h-full w-full object-cover object-[70%_center]"
          poster={poster}
          muted
          loop
          playsInline
          autoPlay
          preload="metadata"
          aria-hidden
          onError={() => setUseVideo(false)}
        >
          <source src={video.replace(/\.mp4$/, ".webm")} type="video/webm" />
          <source src={video} type="video/mp4" />
        </video>
      )}
    </>
  );
}
