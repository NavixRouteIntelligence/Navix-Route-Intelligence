import { ValidationError } from '../../../shared/kernel/domain-error';
import type { DriverProfile } from '../domain/driver-profile';
import type { DriverProfileSourcePort } from '../domain/driver-profile-source.port';
import type { TrafficModelPort } from '../domain/traffic-model';
import { HeuristicAccessInstructions } from '../infrastructure/heuristic-access-instructions';
import { HeuristicParkingPredictor } from '../infrastructure/heuristic-parking-predictor';
import { ForecastRouteUseCase } from './forecast-route.use-case';

function build(learned: DriverProfile | null = null) {
  const traffic: TrafficModelPort = { factor: () => 1 };
  const source: DriverProfileSourcePort = { get: async () => learned };
  return new ForecastRouteUseCase(
    traffic,
    source,
    new HeuristicAccessInstructions(),
    new HeuristicParkingPredictor(traffic),
  );
}

const base = {
  tenantId: 't1',
  earliestDeparture: '2026-07-14T03:00:00.000Z',
  averageSpeedKmh: 60,
  stops: [
    { id: 'a', latitude: 0, longitude: 0 },
    { id: 'b', latitude: 0, longitude: 0.2 },
  ],
};

describe('ForecastRouteUseCase', () => {
  it('produz um relatório completo com cronograma, atrasos, combustível e saída', async () => {
    const report = await build().execute({ ...base, vehicleType: 'car', currentFuelPercent: 80 });
    expect(report.schedule.stops).toHaveLength(2);
    expect(report.schedule.completionAt).toEqual(expect.any(String));
    expect(Array.isArray(report.delays)).toBe(true);
    expect(report.fuel.vehicleType).toBe('car');
    expect(report.fuel.estimatedConsumption).toBeGreaterThan(0);
    expect(report.departure.recommendedDepartureAt).toEqual(expect.any(String));
    expect(report.traffic.factorAtDeparture).toBeGreaterThan(0);
    expect(report.driver.source).toBe('default');
    // Previsão de estacionamento por parada (ADR-0029).
    expect(report.schedule.stops[0].parking?.difficulty).toBe('easy');
    expect(report.schedule.stops[0].parking?.walkMinutes).toBeGreaterThan(0);
  });

  it('usa o override de perfil quando informado', async () => {
    const report = await build().execute({ ...base, driver: { speedFactor: 1.5 } });
    expect(report.driver.source).toBe('override');
    expect(report.driver.speedFactor).toBe(1.5);
  });

  it('usa o perfil aprendido quando há driverId e histórico', async () => {
    const learned: DriverProfile = { speedFactor: 1.3, serviceTimeMinutes: 7, punctuality: 0.95 };
    const report = await build(learned).execute({ ...base, driverId: 'd1' });
    expect(report.driver.source).toBe('learned');
    expect(report.driver.speedFactor).toBe(1.3);
  });

  it('deriva instruções de acesso das observações da parada (ADR-0028)', async () => {
    const report = await build().execute({
      ...base,
      stops: [
        { id: 'a', latitude: 0, longitude: 0 },
        { id: 'b', latitude: 0, longitude: 0.2, accessNotes: 'Entrar pela doca; interfone 5' },
      ],
    });
    const stopB = report.schedule.stops.find((s) => s.id === 'b');
    expect(stopB?.access?.map((i) => i.kind)).toEqual(['dock', 'intercom']);
    const stopA = report.schedule.stops.find((s) => s.id === 'a');
    expect(stopA?.access).toBeUndefined();
  });

  it('rejeita previsão sem paradas', async () => {
    await expect(build().execute({ ...base, stops: [] })).rejects.toBeInstanceOf(ValidationError);
  });
});
