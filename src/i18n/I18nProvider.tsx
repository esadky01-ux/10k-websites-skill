"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Dictionary } from "./nl";
import type { Locale } from "./config";

type Ctx = { lang: Locale; t: Dictionary };
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ lang, t, children }: Ctx & { children: ReactNode }) {
  return <I18nContext.Provider value={{ lang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n yalnızca I18nProvider içinde kullanılabilir");
  return ctx;
}
