"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import type { Dictionary } from "@/i18n/getDictionary";

export const THEME_STORAGE_KEY = "europataxi-theme";

/**
 * Sayfa boyanmadan önce çalışan betik: ziyaretçinin daha önce seçtiği tema varsa
 * `data-theme` olarak uygulanır, yoksa cihaz tercihi geçerli kalır. Bu olmadan
 * koyu tema seçmiş bir ziyaretçi her açılışta bir anlık beyaz ekran görürdü.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t}}catch(e){}})()`;

type Theme = "light" | "dark";

function resolveTheme(): Theme {
  const chosen = document.documentElement.dataset.theme;
  if (chosen === "light" || chosen === "dark") return chosen;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

interface ThemeToggleProps {
  labels: Dictionary["theme"];
  className?: string;
}

/** Açık ve koyu tema arasında geçiş. Seçim yapılmadan önce cihaz tercihi geçerlidir. */
export function ThemeToggle({ labels, className = "" }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(resolveTheme());
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    // Ziyaretçi kendi seçimini yapmadıysa cihaz tercihini izlemeye devam et.
    const onChange = () => {
      if (!document.documentElement.dataset.theme) setTheme(media.matches ? "dark" : "light");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  function toggle() {
    const next: Theme = resolveTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Depolama kapalıysa seçim yalnızca bu sayfa için geçerli olur.
    }
  }

  // Sunucuda hangi temanın geçerli olduğu bilinemez; ilk render'da etiket
  // nötr kalır, etki sonrası doğru etiketle değişir.
  const isDark = theme === "dark";
  const label = theme === null ? labels.label : isDark ? labels.toLight : labels.toDark;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-content transition-colors motion-reduce:transition-none hover:text-taxi-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-taxi-ink ${className}`}
    >
      {isDark ? <Sun aria-hidden="true" className="h-5 w-5" /> : <Moon aria-hidden="true" className="h-5 w-5" />}
    </button>
  );
}
