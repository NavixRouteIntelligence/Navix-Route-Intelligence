import { Inject, Injectable } from '@nestjs/common';
import type { DriverPositionView, PositionUpdateRequest } from '@navix/contracts';

import {
  POSITION_REPOSITORY,
  type PositionRepositoryPort,
} from '../domain/ports/position-repository.port';
import {
  TRACKING_EVENTS,
  type TrackingEventsPort,
} from '../domain/ports/tracking-events.port';
import { DomainEventBus } from '../../../shared/events/domain-event-bus';
import {
  DRIVER_ACCOUNT_LINK,
  type DriverAccountLinkPort,
} from './ports/driver-account-link.port';
import { createDriverPosition } from './create-driver-position';
import { toPositionView } from './position.mapper';

export interface UpdatePositionCommand extends PositionUpdateRequest {
  tenantId: string;
  /** Motorista que reporta = **login** do usuário autenticado (ADR-0086). */
  driverId: string;
}

/**
 * Registra uma nova posição do motorista (append-only).
 *
 * A linha é gravada sob o id do **login** — é quem está autenticado, e é o
 * único id que o motorista autônomo tem. Já o que sai daqui (SSE e evento de
 * domínio) é anunciado sob o id da **ficha**, porque todos os assinantes vêm
 * do lado da frota: o detector de atraso e os avisos ao destinatário partem da
 * entrega, que aponta para a ficha (ADR-0086).
 */
@Injectable()
export class UpdatePositionUseCase {
  constructor(
    @Inject(POSITION_REPOSITORY) private readonly positions: PositionRepositoryPort,
    @Inject(TRACKING_EVENTS) private readonly events: TrackingEventsPort,
    @Inject(DRIVER_ACCOUNT_LINK) private readonly link: DriverAccountLinkPort,
    private readonly bus: DomainEventBus,
  ) {}

  async execute(command: UpdatePositionCommand): Promise<DriverPositionView> {
    const position = createDriverPosition(command);
    await this.positions.save(position);

    const announcedId = await this.fleetDriverId(command.tenantId, command.driverId);
    const view = { ...toPositionView(position), driverId: announcedId };

    // Publica em tempo real (SSE); o polling permanece como fallback.
    this.events.positionUpdated(command.tenantId, view);
    // E no barramento de domínio: é o *tick* que faz o Optimizer reavaliar se a
    // rota atrasou (ADR-0083) e o que dispara a checagem de proximidade dos
    // avisos ao destinatário (ADR-0084). Este evento NÃO reotimiza por si só —
    // quem dispara é o `route.delay-detected` que o detector publica.
    this.bus.publish(command.tenantId, {
      type: 'tracking.position-recorded',
      aggregateId: announcedId,
    });
    return view;
  }

  /**
   * Ficha do motorista, com o login como reserva.
   *
   * A tradução é cacheada no gateway, mas ainda assim roda no caminho de
   * escrita mais quente do sistema — por isso **nunca** pode derrubar a
   * gravação: a posição já está salva quando chegamos aqui, e perder o aviso
   * vale menos do que perder o ponto. Motorista autônomo não tem ficha e cai
   * naturalmente no login.
   */
  private async fleetDriverId(tenantId: string, userId: string): Promise<string> {
    try {
      const fichas = await this.link.driverIdsForUsers(tenantId, [userId]);
      return fichas.get(userId) ?? userId;
    } catch {
      return userId;
    }
  }
}
