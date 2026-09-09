"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { PublicProfile } from "@/server/auth";

type AuthContextValue = {
  customer: PublicProfile | null;
  loading: boolean;
  prices: Record<string, number> | null;
  setCustomer: (c: PublicProfile | null) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomerState] = useState<PublicProfile | null>(null);
  const [prices, setPrices] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);

  const loadPrices = useCallback(async () => {
    try {
      const res = await fetch("/api/prices", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { prices: Record<string, number> };
        setPrices(data.prices);
        return;
      }
    } catch {
      /* ağ hatası: fiyatsız devam */
    }
    setPrices(null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = (await res.json()) as { customer: PublicProfile | null };
      setCustomerState(data.customer);
      if (data.customer) await loadPrices();
      else setPrices(null);
    } catch {
      setCustomerState(null);
      setPrices(null);
    } finally {
      setLoading(false);
    }
  }, [loadPrices]);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => res.json() as Promise<{ customer: PublicProfile | null }>)
      .then((data) => {
        if (!alive) return;
        setCustomerState(data.customer);
        if (data.customer) void loadPrices();
      })
      .catch(() => {
        if (alive) setCustomerState(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [loadPrices]);

  const setCustomer = useCallback(
    (c: PublicProfile | null) => {
      setCustomerState(c);
      if (c) void loadPrices();
      else setPrices(null);
    },
    [loadPrices]
  );

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setCustomerState(null);
    setPrices(null);
  }, []);

  const value = useMemo(() => ({ customer, loading, prices, setCustomer, refresh, logout }), [customer, loading, prices, setCustomer, refresh, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth yalnızca AuthProvider içinde kullanılabilir");
  return ctx;
}
