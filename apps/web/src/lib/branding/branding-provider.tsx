'use client';

import type { TenantBranding } from '@navix/contracts';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { enterpriseApi } from '@/lib/api/enterprise';
import { useAuth } from '@/lib/auth/auth-provider';

export const DEFAULT_BRANDING: TenantBranding = {
  tenantSlug: 'navix',
  displayName: 'Navix',
  logoUrl: null,
  primaryColor: '#6D4AFF',
  accentColor: '#20BFA9',
  customDomain: null,
  customDomainStatus: 'not_configured',
  ssoProtocols: [],
};

interface BrandingContextValue {
  branding: TenantBranding;
  refresh: () => Promise<void>;
}

const BrandingContext = createContext<BrandingContextValue>({
  branding: DEFAULT_BRANDING,
  refresh: async () => undefined,
});

/** Converte #RRGGBB nos canais HSL esperados pelos tokens do design system. */
export function hexToHslChannels(hex: string): string {
  const value = hex.replace('#', '');
  const red = Number.parseInt(value.slice(0, 2), 16) / 255;
  const green = Number.parseInt(value.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(value.slice(4, 6), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;
  let hue = 0;
  let saturation = 0;
  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }
  if (hue < 0) hue += 360;
  return `${Math.round(hue)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [branding, setBranding] = useState<TenantBranding>(DEFAULT_BRANDING);

  const refresh = useCallback(async () => {
    try {
      if (status === 'authenticated') {
        const response = await enterpriseApi.getBranding();
        setBranding(response.data);
        return;
      }
      if (typeof window !== 'undefined') {
        const response = await enterpriseApi.resolveBranding(window.location.host);
        setBranding(response.data ?? DEFAULT_BRANDING);
      }
    } catch {
      // Branding é apresentação: falha degrada para Navix e nunca bloqueia login.
      setBranding(DEFAULT_BRANDING);
    }
  }, [status]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--primary', hexToHslChannels(branding.primaryColor));
    root.style.setProperty('--ring', hexToHslChannels(branding.primaryColor));
    root.style.setProperty('--chart-1', hexToHslChannels(branding.primaryColor));
    root.style.setProperty('--accent', hexToHslChannels(branding.accentColor));
    root.style.setProperty('--chart-2', hexToHslChannels(branding.accentColor));
  }, [branding]);

  return (
    <BrandingContext.Provider value={{ branding, refresh }}>{children}</BrandingContext.Provider>
  );
}

export function useBranding(): BrandingContextValue {
  return useContext(BrandingContext);
}
