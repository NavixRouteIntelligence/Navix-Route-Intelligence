import { Inject, Injectable } from '@nestjs/common';
import { HealthCheckError, HealthIndicator, type HealthIndicatorResult } from '@nestjs/terminus';

import {
  QUEUE_HEALTH,
  WORKER_STATUS,
  type QueueHealthPort,
  type WorkerStatusPort,
} from '../optimizer/domain/ports/queue-health.port';

/**
 * Indicador da fila de otimização — **fatal por design** quando a fila é
 * obrigatória (ADR-0114), ao contrário do Redis de cache.
 *
 * A distinção é o ponto: o mesmo Redis serve cache e fila, mas as duas coisas
 * degradam de formas diferentes. Cache fora vira miss, e a instância continua
 * servindo; fila fora significa que **toda** otimização vai falhar, e uma
 * instância nessas condições não deveria receber tráfego. Antes o `/ready`
 * respondia 200 com `redis: degraded` nos dois casos — verificado ao vivo: com
 * o Redis fora e `bullmq` configurado, a aplicação subia, ficava em rotação e
 * devolvia 500 em cada pedido de rota.
 *
 * O worker é avaliado por processo: quem tem `OPTIMIZER_WORKER_ENABLED=true` e
 * não está consumindo está quebrado; quem tem `false` legitimamente não consome
 * (topologia de worker dedicado) e só reporta quantos workers existem na fila.
 */
@Injectable()
export class QueueHealthIndicator extends HealthIndicator {
  constructor(
    @Inject(QUEUE_HEALTH) private readonly queue: QueueHealthPort,
    @Inject(WORKER_STATUS) private readonly worker: WorkerStatusPort,
  ) {
    super();
  }

  async check(key = 'optimizer-queue'): Promise<HealthIndicatorResult> {
    const saude = await this.queue.health();
    const workerStatus = this.worker.workerStatus();
    const detalhes = { ...saude, worker: this.mergeWorker(saude.worker, workerStatus) };

    // Fila in-process não é dependência externa: não há o que estar fora.
    if (saude.driver === 'inprocess') return this.getStatus(key, true, detalhes);

    const motivos: string[] = [];
    if (saude.connection === 'down') motivos.push('sem conexão com a fila');
    if (saude.producer === 'down') motivos.push('produtor indisponível');
    // Só acusa o worker deste processo. Um worker remoto ausente pode ser um
    // deploy em andamento, e derrubar a API por isso trocaria uma indisponi-
    // bilidade parcial por uma total.
    if (workerStatus === 'stopped') motivos.push('worker habilitado mas parado');

    if (motivos.length > 0) {
      throw new HealthCheckError(
        `Fila de otimização indisponível: ${motivos.join('; ')}.`,
        this.getStatus(key, false, { ...detalhes, motivos }),
      );
    }
    return this.getStatus(key, true, detalhes);
  }

  /**
   * O estado deste processo tem precedência sobre a contagem global: `running`
   * aqui é uma resposta mais forte do que "há N workers em algum lugar".
   */
  private mergeWorker(
    naFila: 'running' | 'remote' | 'absent' | 'disabled',
    neste: 'running' | 'stopped' | 'disabled',
  ): string {
    if (neste === 'running') return 'running';
    if (neste === 'stopped') return 'stopped';
    return naFila;
  }
}
