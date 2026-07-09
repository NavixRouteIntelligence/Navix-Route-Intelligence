import { Inject, Injectable } from '@nestjs/common';
import type { PodSummary, ProofOfDeliveryView } from '@navix/contracts';

import { normalizePage, type PageParams } from '../../../shared/kernel/pagination';
import { POD_REPOSITORY, type PodRepositoryPort } from '../domain/ports/pod-repository.port';
import { toPodView } from './pod.mapper';

export interface ListPodResult {
  items: ProofOfDeliveryView[];
  total: number;
  page: PageParams;
}

/** Consultas de comprovantes: por entrega, histórico e resumo (Dashboard). */
@Injectable()
export class QueryPodUseCase {
  constructor(@Inject(POD_REPOSITORY) private readonly repo: PodRepositoryPort) {}

  async byDelivery(tenantId: string, deliveryId: string): Promise<ProofOfDeliveryView | null> {
    const pod = await this.repo.findByDelivery(tenantId, deliveryId);
    return pod ? toPodView(pod) : null;
  }

  async list(tenantId: string, page?: number, pageSize?: number): Promise<ListPodResult> {
    const params = normalizePage(page, pageSize);
    const { items, total } = await this.repo.findAll(tenantId, params);
    return { items: items.map(toPodView), total, page: params };
  }

  async summary(tenantId: string): Promise<PodSummary> {
    const c = await this.repo.countByStatus(tenantId);
    return { ...c, total: c.delivered + c.absent + c.refused };
  }
}
