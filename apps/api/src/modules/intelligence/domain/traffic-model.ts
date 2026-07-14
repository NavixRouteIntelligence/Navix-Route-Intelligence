import { Injectable } from '@nestjs/common';
import type { TrafficWindow } from '@navix/contracts';

import type { LatLng } from '../../../shared/kernel/geo';

/**
 * Previsão de trânsito (ADR-0025). Port desacoplada: hoje uma heurística por
 * **contexto temporal**; amanhã um modelo de ML treinado com histórico de
 * velocidades por região/hora — **sem alterar** os consumidores (scheduler,
 * departure planner).
 */
export interface TrafficModelPort {
  /** Multiplicador de congestionamento (1 = fluxo livre) num ponto e instante. */
  factor(point: LatLng, at: Date): number;
}

export const TRAFFIC_MODEL = Symbol('TRAFFIC_MODEL');

const PEAK = 1.5;
const MODERATE = 1.2;
const FREE = 1.0;

/** Classifica o multiplicador em janela de trânsito (para exibição). */
export function classifyTraffic(factor: number): TrafficWindow {
  if (factor >= 1.35) return 'peak';
  if (factor >= 1.1) return 'moderate';
  return 'off_peak';
}

/**
 * Heurística de trânsito por **hora do dia + dia da semana**. Picos em dias
 * úteis (manhã/tarde); fins de semana mais leves; madrugada livre. Determinística
 * e testável. A localização é aceita na assinatura para o futuro modelo por
 * região — nesta camada ainda não influencia.
 */
@Injectable()
export class TimeContextTrafficModel implements TrafficModelPort {
  factor(_point: LatLng, at: Date): number {
    const hour = at.getHours();
    const day = at.getDay(); // 0=domingo, 6=sábado
    const weekend = day === 0 || day === 6;

    if (weekend) {
      // Fim de semana: tarde levemente carregada, resto livre.
      return hour >= 12 && hour <= 18 ? MODERATE : FREE;
    }
    // Dias úteis: picos de deslocamento casa↔trabalho.
    if ((hour >= 7 && hour < 10) || (hour >= 17 && hour < 20)) return PEAK;
    if ((hour >= 6 && hour < 7) || (hour >= 10 && hour < 12) || (hour >= 16 && hour < 17)) {
      return MODERATE;
    }
    return FREE;
  }
}
