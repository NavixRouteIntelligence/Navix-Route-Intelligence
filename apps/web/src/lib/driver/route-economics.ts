'use client';

import type { RoutePlan } from '@navix/contracts';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'navix.route.economics';

/**
 * Parâmetros de custo/receita da rota, configuráveis e persistidos no cliente.
 * Base para o painel de rentabilidade do motorista. Trânsito/acidentes entram
 * como fatores futuros; portagem já é um custo configurável.
 */
export interface RouteEconomics {
  /** Receita média por entrega concluída (moeda local). */
  revenuePerDelivery: number;
  /** Preço do combustível/energia por litro (ou kWh). */
  fuelPrice: number;
  /** Consumo médio (litros por 100 km). */
  consumptionPer100km: number;
  /** Custo total de portagens da rota (quando configurado). */
  tollCost: number;
}

export const DEFAULT_ECONOMICS: RouteEconomics = {
  revenuePerDelivery: 6,
  fuelPrice: 1.8,
  consumptionPer100km: 8,
  tollCost: 0,
};

export interface Profitability {
  deliveries: number;
  km: number;
  minutes: number;
  revenue: number;
  fuelCost: number;
  tollCost: number;
  netProfit: number;
}

/** Calcula a rentabilidade a partir das métricas do Route Plan e dos parâmetros. */
export function computeProfitability(plan: RoutePlan, eco: RouteEconomics): Profitability {
  const deliveries = plan.metrics.stops;
  const km = plan.metrics.totalDistanceKm;
  const minutes = plan.metrics.totalTimeMinutes;
  const revenue = deliveries * eco.revenuePerDelivery;
  const fuelCost = (km / 100) * eco.consumptionPer100km * eco.fuelPrice;
  const tollCost = eco.tollCost;
  const netProfit = revenue - fuelCost - tollCost;
  return { deliveries, km, minutes, revenue, fuelCost, tollCost, netProfit };
}

/** Hook de persistência dos parâmetros econômicos. */
export function useRouteEconomics() {
  const [economics, setEconomics] = useState<RouteEconomics>(DEFAULT_ECONOMICS);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setEconomics({ ...DEFAULT_ECONOMICS, ...(JSON.parse(raw) as Partial<RouteEconomics>) });
    } catch {
      /* ignora dados corrompidos */
    }
  }, []);

  const setField = useCallback((key: keyof RouteEconomics, value: number) => {
    setEconomics((prev) => {
      const next = { ...prev, [key]: Number.isFinite(value) ? value : 0 };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { economics, setField };
}
