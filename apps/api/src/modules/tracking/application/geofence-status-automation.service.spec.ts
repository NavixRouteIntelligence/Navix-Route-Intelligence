import type { AppConfigService } from '../../../shared/config/app-config.service';
import type { ChangeDeliveryStatusUseCase } from '../../delivery/application/change-delivery-status.use-case';
import type { DeliveryLookupPort } from '../../delivery/application/delivery-lookup.service';

import { GeofenceStatusAutomationService } from './geofence-status-automation.service';
import type { QueryPositionsUseCase } from './query-positions.use-case';

const input = {
  tenantId: 'tenant-1',
  driverId: 'driver-1',
  recordedAt: new Date('2026-08-02T10:05:00.000Z'),
};

function build(options: { enabled?: boolean; dwell?: Map<string, number | null> } = {}) {
  const config = {
    tracking: {
      geofenceAutomationEnabled: options.enabled ?? true,
      geofenceDwellMinutes: 2,
      geofenceCheckIntervalMs: 30_000,
    },
  } as AppConfigService;
  const listNotifiableActive = jest.fn().mockResolvedValue([
    {
      id: 'd1',
      status: 'pending',
      driverId: 'driver-1',
      latitude: 38.7223,
      longitude: -9.1393,
    },
    {
      id: 'd2',
      status: 'pending',
      driverId: 'driver-1',
      latitude: 38.7369,
      longitude: -9.1427,
    },
    {
      id: 'd3',
      status: 'in_route',
      driverId: 'driver-1',
      latitude: 38.7,
      longitude: -9.1,
    },
  ]);
  const deliveries = { listNotifiableActive } as unknown as DeliveryLookupPort;
  const serviceMinutesAtStops = jest.fn().mockResolvedValue(
    options.dwell ??
      new Map([
        ['d1', 2.5],
        ['d2', null],
      ]),
  );
  const positions = { serviceMinutesAtStops } as unknown as QueryPositionsUseCase;
  const execute = jest.fn().mockResolvedValue({ status: 'in_route' });
  const changeStatus = { execute } as unknown as ChangeDeliveryStatusUseCase;
  const service = new GeofenceStatusAutomationService(config, deliveries, positions, changeStatus);
  return { service, listNotifiableActive, serviceMinutesAtStops, execute };
}

describe('GeofenceStatusAutomationService', () => {
  it('promove somente pending com dwell acima do limiar', async () => {
    const { service, serviceMinutesAtStops, execute } = build();

    await expect(service.evaluate(input)).resolves.toBe(1);

    expect(serviceMinutesAtStops).toHaveBeenCalledWith(
      'tenant-1',
      'driver-1',
      expect.arrayContaining([expect.objectContaining({ id: 'd1' })]),
      input.recordedAt,
    );
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      id: 'd1',
      actorId: 'driver-1',
      status: 'in_route',
    });
  });

  it('aplica throttle por tenant e motorista', async () => {
    const { service, listNotifiableActive } = build();

    await service.evaluate(input);
    await service.evaluate({
      ...input,
      recordedAt: new Date(input.recordedAt.getTime() + 10_000),
    });

    expect(listNotifiableActive).toHaveBeenCalledTimes(1);
  });

  it('flag desligada não consulta entregas nem posições', async () => {
    const { service, listNotifiableActive, serviceMinutesAtStops } = build({ enabled: false });

    await expect(service.evaluate(input)).resolves.toBe(0);

    expect(listNotifiableActive).not.toHaveBeenCalled();
    expect(serviceMinutesAtStops).not.toHaveBeenCalled();
  });

  it('dwell insuficiente não altera status', async () => {
    const { service, execute } = build({ dwell: new Map([['d1', 1.9]]) });

    await expect(service.evaluate(input)).resolves.toBe(0);
    expect(execute).not.toHaveBeenCalled();
  });

  it('continua as demais transições quando uma entrega muda em concorrência', async () => {
    const { service, execute } = build({
      dwell: new Map([
        ['d1', 2.5],
        ['d2', 3],
      ]),
    });
    execute.mockRejectedValueOnce(new Error('status já alterado')).mockResolvedValueOnce({
      status: 'in_route',
    });

    await expect(service.evaluate(input)).resolves.toBe(1);
    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute).toHaveBeenLastCalledWith({
      tenantId: 'tenant-1',
      id: 'd2',
      actorId: 'driver-1',
      status: 'in_route',
    });
  });
});
