'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

const COLLAPSE_KEY = 'navix.sidebar.collapsed';

interface UiStore {
  collapsed: boolean;
  toggleCollapsed: () => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

const UiContext = createContext<UiStore | null>(null);

export function UiStoreProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === '1');
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      return next;
    });
  }, []);

  return (
    <UiContext.Provider value={{ collapsed, toggleCollapsed, mobileOpen, setMobileOpen }}>
      {children}
    </UiContext.Provider>
  );
}

export function useUiStore(): UiStore {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('useUiStore deve ser usado dentro de <UiStoreProvider>.');
  return ctx;
}
