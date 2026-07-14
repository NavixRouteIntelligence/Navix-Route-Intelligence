import { Inject, Injectable } from '@nestjs/common';
import type {
  DriverProfileInput,
  DriverProfileSource,
  RouteForecastRequest,
  RouteIntelligenceReport,
  RouteScheduleView,
  VehicleType,
} from '@navix/contracts';

import { ValidationError } from '../../../shared/kernel/domain-error';
import type { LatLng } from '../../../shared/kernel/geo';
import { analyzeDelays } from '../domain/delay-risk';
import { planDeparture } from '../domain/departure-planner';
import {
  DRIVER_PROFILE_SOURCE,
  type DriverProfileSourcePort,
} from '../domain/driver-profile-source.port';
import { NEUTRAL_DRIVER_PROFILE, type DriverProfile } from '../domain/driver-profile';
import { adviseFuel } from '../domain/fuel-advisor';
import { buildSchedule, type RouteSchedule, type ScheduleInput } from '../domain/route-scheduler';
import { classifyTraffic, TRAFFIC_MODEL, type TrafficModelPort } from '../domain/traffic-model';

const DEFAULT_SPEED_KMH = 30;
const DEFAULT_VEHICLE: VehicleType = 'car';
const MAX_STOPS = 500;

export interface ForecastRouteCommand extends RouteForecastRequest {
  tenantId: string;
}

/**
 * Orquestra a **Navix Intelligence** (ADR-0025): resolve o perfil do motorista
 * (override → aprendido → neutro), calcula o **melhor horário de saída**, monta o
 * **cronograma com ETA por parada + conclusão**, e deriva **atrasos**, **combustível**
 * e **contexto de trânsito**. Cada peça é um serviço de domínio reutilizável; a
 * previsão de trânsito e a fonte de perfil são **ports** (troca por ML depois).
 */
@Injectable()
export class ForecastRouteUseCase {
  constructor(
    @Inject(TRAFFIC_MODEL) private readonly traffic: TrafficModelPort,
    @Inject(DRIVER_PROFILE_SOURCE) private readonly driverSource: DriverProfileSourcePort,
  ) {}

  async execute(command: ForecastRouteCommand): Promise<RouteIntelligenceReport> {
    if (!command.stops || command.stops.length < 1) {
      throw new ValidationError('É necessária ao menos 1 parada para a previsão.');
    }
    if (command.stops.length > MAX_STOPS) {
      throw new ValidationError(`Máximo de ${MAX_STOPS} paradas por previsão.`);
    }

    const vehicleType = command.vehicleType ?? DEFAULT_VEHICLE;
    const baseSpeedKmh = command.averageSpeedKmh ?? DEFAULT_SPEED_KMH;
    if (baseSpeedKmh <= 0) throw new ValidationError('Velocidade média deve ser positiva.');

    const { profile, source } = await this.resolveDriver(command, baseSpeedKmh);

    const origin: LatLng | null = command.origin
      ? { latitude: command.origin.latitude, longitude: command.origin.longitude }
      : null;
    const stops = command.stops.map((s) => ({
      id: s.id,
      point: { latitude: s.latitude, longitude: s.longitude },
      serviceMinutes: s.serviceTimeMinutes,
      window: s.timeWindow
        ? { start: new Date(s.timeWindow.start), end: new Date(s.timeWindow.end) }
        : null,
    }));

    const base: Omit<ScheduleInput, 'departure'> = {
      origin,
      stops,
      baseSpeedKmh,
      driver: profile,
      traffic: this.traffic,
    };

    const earliest = command.earliestDeparture ? new Date(command.earliestDeparture) : new Date();
    if (Number.isNaN(earliest.getTime())) {
      throw new ValidationError('`earliestDeparture` inválido (esperado ISO 8601).');
    }

    const departurePlan = planDeparture(base, earliest);
    const schedule = buildSchedule({ ...base, departure: departurePlan.departure });

    const delays = analyzeDelays(schedule);
    const fuel = adviseFuel(vehicleType, schedule.totalDistanceKm, command.currentFuelPercent);
    const factorAtDeparture = this.traffic.factor(stops[0].point, departurePlan.departure);

    return {
      schedule: this.toScheduleView(schedule),
      delays,
      fuel,
      departure: {
        recommendedDepartureAt: departurePlan.departure.toISOString(),
        expectedLateStops: departurePlan.expectedLateStops,
        rationale:
          departurePlan.expectedLateStops === 0
            ? 'Horário escolhido cumpre todas as janelas com o trânsito previsto.'
            : `Horário que minimiza atrasos: ${departurePlan.expectedLateStops} parada(s) ainda em risco.`,
      },
      traffic: {
        factorAtDeparture: Math.round(factorAtDeparture * 100) / 100,
        window: classifyTraffic(factorAtDeparture),
      },
      driver: { ...profile, source },
    };
  }

  private async resolveDriver(
    command: ForecastRouteCommand,
    baseSpeedKmh: number,
  ): Promise<{ profile: DriverProfile; source: DriverProfileSource }> {
    if (command.driver) {
      return { profile: mergeOverride(command.driver), source: 'override' };
    }
    if (command.driverId) {
      const learned = await this.driverSource.get(command.tenantId, command.driverId);
      if (learned) return { profile: learned, source: 'learned' };
    }
    void baseSpeedKmh;
    return { profile: NEUTRAL_DRIVER_PROFILE, source: 'default' };
  }

  private toScheduleView(schedule: RouteSchedule): RouteScheduleView {
    return {
      departureAt: schedule.departure.toISOString(),
      completionAt: schedule.completion.toISOString(),
      totalMinutes: schedule.totalMinutes,
      totalDistanceKm: schedule.totalDistanceKm,
      stops: schedule.stops.map((s) => ({
        id: s.id,
        sequence: s.sequence,
        etaMinutes: s.etaMinutes,
        arrivalAt: s.arrivalAt.toISOString(),
        legDistanceKm: s.legDistanceKm,
        cumulativeDistanceKm: s.cumulativeDistanceKm,
        serviceMinutes: s.serviceMinutes,
        timeWindowRespected: s.timeWindowRespected,
      })),
    };
  }
}

function mergeOverride(o: DriverProfileInput): DriverProfile {
  return {
    speedFactor: o.speedFactor ?? NEUTRAL_DRIVER_PROFILE.speedFactor,
    serviceTimeMinutes: o.serviceTimeMinutes ?? NEUTRAL_DRIVER_PROFILE.serviceTimeMinutes,
    punctuality: o.punctuality ?? NEUTRAL_DRIVER_PROFILE.punctuality,
  };
}
