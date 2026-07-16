import { Inject, Injectable } from '@nestjs/common';
import type { PodSummary, ProofOfDeliveryView } from '@navix/contracts';

import { normalizePage, type PageParams } from '../../../shared/kernel/pagination';
import { STORAGE, type StoragePort } from '../../../shared/storage/storage.port';
import { POD_REPOSITORY, type PodRepositoryPort } from '../domain/ports/pod-repository.port';
import { toPodViewSigned } from './pod.mapper';

export interface ListPodResult {
  items: ProofOfDeliveryView[];
  total: number;
  page: PageParams;
}

/** Consultas de comprovantes: por entrega, histórico e resumo (Dashboard). */
@Injectable()
export class QueryPodUseCase {
  constructor(
    @Inject(POD_REPOSITORY) private readonly repo: PodRepositoryPort,
    @Inject(STORAGE) private readonly storage: StoragePort,
  ) {}

  async byDelivery(tenantId: string, deliveryId: string): Promise<ProofOfDeliveryView | null> {
    const pod = await this.repo.findByDelivery(tenantId, deliveryId);
    return pod ? toPodViewSigned(pod, this.storage) : null;
  }

  async list(tenantId: string, page?: number, pageSize?: number): Promise<ListPodResult> {
    const params = normalizePage(page, pageSize);
    const { items, total } = await this.repo.findAll(tenantId, params);
    const podItems = await Promise.all(items.map((p) => toPodViewSigned(p, this.storage)));
    return { items: podItems, total, page: params };
  }

  async summary(tenantId: string): Promise<PodSummary> {
    const c = await this.repo.countByStatus(tenantId);
    return { ...c, total: c.delivered + c.absent + c.refused };
  }
}
