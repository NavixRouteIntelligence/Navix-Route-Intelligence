import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { PublicTrackingView } from '@navix/contracts';
import { DataSource } from 'typeorm';

import { transactionContext } from '../../../shared/database/transaction-context';
import { NotFoundError } from '../../../shared/kernel/domain-error';
import {
  DELIVERY_LOOKUP,
  type DeliveryLookupPort,
} from '../../delivery/application/delivery-lookup.service';
import {
  ROUTE_ETA_GATEWAY,
  VEHICLE_LOCATION_GATEWAY,
  type RouteEtaGatewayPort,
  type VehicleLocationGatewayPort,
} from './ports/public-tracking-sources.port';
import {
  TRACKING_TOKEN_REPOSITORY,
  type TrackingTokenRepositoryPort,
} from '../domain/ports/tracking-token-repository.port';

/**
 * Rastreamento público por token (ADR-0082). É o único caminho de leitura do
 * sistema **sem autenticação**, então concentra três cuidados:
 *
 * 1. **RLS estabelecida à mão.** Um request público não passa pelo
 *    `TenantTransactionInterceptor` (ele só age quando há `req.user`), logo não
 *    há `app.current_tenant` — e a RLS devolveria zero linhas. Aqui o tenant
 *    vem do token e a transação é aberta explicitamente, de modo que toda
 *    leitura de dado real continua isolada pelo banco.
 * 2. **PII mínima.** A resposta é montada campo a campo (nunca a entrega
 *    inteira): sem endereço, destinatário, observações ou IDs internos.
 * 3. **Posição só em rota.** Fora de `in_route` a localização do veículo não é
 *    devolvida — seguir um motorista fora da janela de entrega é vigilância.
 */
@Injectable()
export class GetPublicTrackingUseCase {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(TRACKING_TOKEN_REPOSITORY) private readonly tokens: TrackingTokenRepositoryPort,
    @Inject(DELIVERY_LOOKUP) private readonly deliveries: DeliveryLookupPort,
    @Inject(ROUTE_ETA_GATEWAY) private readonly eta: RouteEtaGatewayPort,
    @Inject(VEHICLE_LOCATION_GATEWAY) private readonly location: VehicleLocationGatewayPort,
  ) {}

  async execute(token: string): Promise<PublicTrackingView> {
    // Fora de transação de tenant: é esta consulta que descobre o tenant. A
    // tabela de tokens não tem RLS nem PII exatamente para permitir isto.
    const ref = await this.tokens.resolve(token);
    // Mesma resposta para token inexistente, revogado ou malformado: não
    // confirmar a existência de um token é o que impede sondagem.
    if (!ref) throw new NotFoundError('Rastreamento não encontrado.');

    return this.withTenant(ref.tenantId, async () => {
      const snapshot = await this.deliveries.getPublicSnapshot(ref.tenantId, ref.deliveryId);
      if (!snapshot) throw new NotFoundError('Rastreamento não encontrado.');

      const inRoute = snapshot.status === 'in_route';

      const vehiclePosition =
        inRoute && snapshot.driverId
          ? await this.location.latestForDriver(ref.tenantId, snapshot.driverId)
          : null;

      // Entrega concluída não tem "chegada estimada" — mostrar ETA passado
      // confundiria mais do que informa.
      const estimatedArrival =
        snapshot.status === 'pending' || inRoute
          ? await this.eta.etaForDelivery(ref.tenantId, ref.deliveryId)
          : null;

      return {
        status: snapshot.status,
        estimatedArrival: estimatedArrival?.toISOString() ?? null,
        etaIsEstimate: true, // heurística nesta fase; ML de ETA é a Fase 3
        vehiclePosition: vehiclePosition
          ? {
              latitude: vehiclePosition.latitude,
              longitude: vehiclePosition.longitude,
              recordedAt: vehiclePosition.recordedAt.toISOString(),
            }
          : null,
        // Só as coordenadas do destino, para centrar o mapa — nunca a rua, o
        // número ou o complemento.
        destination: { latitude: snapshot.latitude, longitude: snapshot.longitude },
        updatedAt: new Date().toISOString(),
      };
    });
  }

  /** Abre a transação com `app.current_tenant` — o que o interceptor faria. */
  private withTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query("SELECT set_config('app.current_tenant', $1, true)", [tenantId]);
      return transactionContext.run(manager, fn);
    });
  }
}
