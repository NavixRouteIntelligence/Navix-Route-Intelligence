import { Inject, Injectable } from '@nestjs/common';
import type { DriverPositionView, PositionHistoryResponse } from '@navix/contracts';

import {
  POSITION_REPOSITORY,
  type PositionRepositoryPort,
} from '../domain/ports/position-repository.port';
import {
  DRIVER_ACCOUNT_LINK,
  type DriverAccountLinkPort,
} from './ports/driver-account-link.port';
import { toPositionView } from './position.mapper';

const DEFAULT_HISTORY_LIMIT = 200;

/**
 * Consultas de posição: do próprio motorista e da frota.
 *
 * ## Os dois identificadores (ADR-0086)
 *
 * A posição é **gravada** sob o id do `user` — quem transmite é quem está
 * autenticado, e para o motorista autônomo esse é o único id que existe. Já o
 * resto do sistema fala o id da **ficha** (`deliveries.driver_id`, a lista da
 * frota, o rastreio público).
 *
 * Este caso de uso é a fronteira entre os dois espaços, e por isso os métodos
 * vêm em pares explícitos: os que recebem **ficha** traduzem; os `...ForUser`
 * recebem **login** e não traduzem. Um único método "esperto", que tentasse
 * adivinhar qual dos dois ids recebeu, seria exatamente o tipo de ambiguidade
 * que manteve as duas metades do sistema desconectadas.
 */
@Injectable()
export class QueryPositionsUseCase {
  constructor(
    @Inject(POSITION_REPOSITORY) private readonly positions: PositionRepositoryPort,
    @Inject(DRIVER_ACCOUNT_LINK) private readonly link: DriverAccountLinkPort,
  ) {}

  /**
   * Última posição de uma **ficha** da frota. Usado pela empresa, pelo rastreio
   * público e pelos avisos ao destinatário — todos partem da entrega, que
   * aponta para a ficha.
   */
  async latestForDriver(tenantId: string, driverId: string): Promise<DriverPositionView | null> {
    const userId = await this.link.userIdForDriver(tenantId, driverId);
    // Ficha sem conta no app (terceirizado): não há posição, e isso é normal.
    if (!userId) return null;
    const position = await this.positions.findLatestForDriver(tenantId, userId);
    // A view sai com o id da FICHA: quem perguntou pela ficha não deve receber
    // de volta um id de outro espaço para conciliar por conta própria.
    return position ? { ...toPositionView(position), driverId } : null;
  }

  /** Última posição do próprio motorista autenticado (recebe o **login**). */
  async latestForUser(tenantId: string, userId: string): Promise<DriverPositionView | null> {
    const position = await this.positions.findLatestForDriver(tenantId, userId);
    return position ? toPositionView(position) : null;
  }

  /**
   * Última posição de cada motorista do tenant (visão de frota — empresa).
   *
   * Traduz login→ficha em lote: é esta tradução que faz a tela de frota casar a
   * posição com o nome do motorista. Sem ela, toda ficha aparecia "offline, sem
   * sinal" e a posição real virava uma linha órfã — o sintoma que abriu a
   * ADR-0086.
   */
  async fleetLatest(tenantId: string): Promise<DriverPositionView[]> {
    const now = new Date();
    const positions = await this.positions.findLatestPerDriver(tenantId);
    const fichas = await this.link.driverIdsForUsers(
      tenantId,
      positions.map((p) => p.driverId),
    );
    return positions.map((p) => {
      const view = toPositionView(p, now);
      // Sem ficha (autônomo) fica o id do login: devolver a posição
      // identificada pelo que existe é melhor do que escondê-la.
      const driverId = fichas.get(p.driverId);
      return driverId ? { ...view, driverId } : view;
    });
  }

  /** Histórico de uma **ficha** da frota. */
  async history(
    tenantId: string,
    driverId: string,
    limit = DEFAULT_HISTORY_LIMIT,
  ): Promise<PositionHistoryResponse> {
    const userId = await this.link.userIdForDriver(tenantId, driverId);
    if (!userId) return { driverId, points: [] };
    return { driverId, points: await this.historyPoints(tenantId, userId, limit) };
  }

  /** Histórico do próprio motorista autenticado (recebe o **login**). */
  async historyForUser(
    tenantId: string,
    userId: string,
    limit = DEFAULT_HISTORY_LIMIT,
  ): Promise<PositionHistoryResponse> {
    return { driverId: userId, points: await this.historyPoints(tenantId, userId, limit) };
  }

  private async historyPoints(
    tenantId: string,
    userId: string,
    limit: number,
  ): Promise<DriverPositionView[]> {
    const now = new Date();
    const points = await this.positions.findHistory(tenantId, userId, limit);
    return points.map((p) => toPositionView(p, now));
  }
}
