import { Injectable } from '@nestjs/common';
import type { DelayRiskAlert } from '@navix/contracts';

/**
 * Após este tempo sem ser recalculado, o risco deixa de ser exibido.
 *
 * Um alerta velho é pior que nenhum: se a rota mudou e ninguém reavaliou, o
 * despachante estaria decidindo com base num retrato que não vale mais. O prazo
 * é folgado frente ao ciclo de avaliação, para não piscar entre um e outro.
 */
const TTL_MS = 10 * 60_000;

/**
 * Últimos riscos calculados por tenant (ADR-0091).
 *
 * ## Por que memória, e não tabela
 *
 * O risco é um retrato do turno corrente, derivado inteiramente de dados que já
 * estão no banco (plano vigente + corpus de erro). Persistir criaria um segundo
 * lugar de verdade a manter em dia, com expurgo próprio, para um dado que
 * expira em minutos. Quem quiser o histórico do que aconteceu tem
 * `eta_observations`, que é o registro durável.
 *
 * O web recebe o alerta empurrado por SSE; o app, que usa polling, lê daqui.
 *
 * **Limite conhecido:** com várias réplicas da API, o registro vive na instância
 * que calculou, e uma leitura pode cair noutra. É a mesma limitação do
 * `DomainEventBus` in-process (ADR-0023/0083) e some junto com ela, quando o
 * barramento passar para Redis pub/sub.
 */
@Injectable()
export class DelayRiskRegistry {
  private readonly porTenant = new Map<string, { alerts: DelayRiskAlert[]; at: number }>();

  /** Substitui o retrato do tenant — a avaliação é sempre completa, não incremental. */
  replace(tenantId: string, alerts: DelayRiskAlert[]): void {
    this.porTenant.set(tenantId, { alerts, at: Date.now() });
  }

  /** Riscos vigentes. Vazio quando nunca avaliado ou quando o retrato envelheceu. */
  current(tenantId: string): DelayRiskAlert[] {
    const entrada = this.porTenant.get(tenantId);
    if (!entrada) return [];
    if (Date.now() - entrada.at > TTL_MS) {
      this.porTenant.delete(tenantId);
      return [];
    }
    return entrada.alerts;
  }
}
