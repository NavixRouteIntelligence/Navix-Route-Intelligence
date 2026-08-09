import { Inject, Injectable } from '@nestjs/common';
import type { DriverDailySnapshot, DriverDayState } from '@navix/contracts';

import {
  BASELINE_DAYS,
  comparePersonalBaseline,
  isWorkedDay,
  type PersonalBaseline,
} from '../domain/driver-baseline';
import { KAIZEN_ADVISOR, type KaizenAdvisorPort } from '../domain/ports/kaizen-advisor.port';
import {
  KAIZEN_FEEDBACK_REPOSITORY,
  type KaizenFeedbackRepositoryPort,
} from '../domain/ports/kaizen-feedback-repository.port';
import { NOT_APPLICABLE_QUIET_DAYS, decideRelevance } from '../domain/kaizen-relevance';
import { activeMinutesOf, type DailyRawRow } from '../domain/daily-subject';

/**
 * Calendário lido para trás, para encontrar sete dias **trabalhados**.
 *
 * Seis semanas de folga possível por semana trabalhada: quem entrega dois dias
 * por semana ainda alcança a amostra. Ler mais barato não seria mais correto —
 * seria uma referência construída com menos dias sem o dizer.
 */
const JANELA_DIAS = BASELINE_DAYS * 6;

import {
  TENANT_ACCOUNT_TYPE_READER,
  type TenantAccountTypeReaderPort,
} from '../../../shared/tenancy/tenant-account-type.port';
import {
  TENANT_TIME_ZONE_READER,
  type TenantTimeZoneReaderPort,
} from '../../../shared/tenancy/tenant-time-zone.port';
import {
  onTimeRateOf,
  savedFuelLitersOf,
  successRateOf,
  type DailySubject,
} from '../domain/daily-subject';
import {
  DRIVER_KPI_REPOSITORY,
  type DriverKpiRepositoryPort,
} from '../domain/ports/driver-kpi-repository.port';

/**
 * Fotografia diária do motorista (ADR-0117), lida **só** do read model.
 *
 * Nenhuma consulta a lista do OLTP: a tela pergunta por um dia e recebe uma
 * linha. É o que mantém o custo constante independentemente de quantas entregas
 * a pessoa fez, e é também o que torna o resumo reproduzível — o mesmo dia
 * projetado outra vez dá a mesma linha.
 */
@Injectable()
export class GetDriverDailySnapshotUseCase {
  constructor(
    @Inject(DRIVER_KPI_REPOSITORY) private readonly kpis: DriverKpiRepositoryPort,
    @Inject(TENANT_ACCOUNT_TYPE_READER) private readonly contas: TenantAccountTypeReaderPort,
    @Inject(TENANT_TIME_ZONE_READER) private readonly zonas: TenantTimeZoneReaderPort,
    @Inject(KAIZEN_ADVISOR) private readonly advisor: KaizenAdvisorPort,
    @Inject(KAIZEN_FEEDBACK_REPOSITORY) private readonly feedback: KaizenFeedbackRepositoryPort,
  ) {}

  /** `day` ausente = **ontem**, no fuso de quem opera (ADR-0105/0116). */
  async execute(
    tenantId: string,
    userId: string,
    day?: string,
    agora = new Date(),
  ): Promise<DriverDailySnapshot> {
    const dia = day ?? (await this.ontem(tenantId, agora));
    const sujeito = await this.sujeito(tenantId, userId);
    // Sem sujeito não há o que projetar nem o que mostrar: `pending` seria
    // promessa de um dado que nunca vai chegar.
    if (!sujeito) return vazio(dia, 'no-work');

    // Uma janela, não duas consultas: a comparação precisa dos dias anteriores
    // e a fotografia precisa do próprio dia. `JANELA_DIAS` é generoso porque a
    // referência conta dias **trabalhados**, e folgas não entram — quem trabalha
    // três dias por semana precisa de mais calendário para sete dias de trabalho.
    const desde = recuar(dia, JANELA_DIAS);
    const janela = await this.kpis.range(tenantId, sujeito, desde, dia);
    const linhas = janela.filter((l) => l.day === dia);
    const linha = linhas[0];
    // Ausência de linha é **projeção pendente**, não dia sem trabalho: a
    // projeção materializa o dia do autónomo mesmo quando não houve nada.
    if (!linha) return vazio(dia, 'pending');

    const foto = toSnapshot(linha);
    const baseline = comparePersonalBaseline(janela);
    // A comparação é sempre do último dia **trabalhado**. Se o dia pedido não é
    // esse, ela não se aplica — e devolvê-la assim mesmo faria parecer que os
    // números ao lado se referem ao dia que está no ecrã. A recomendação segue
    // a mesma regra: aconselhar sobre um dia que não é o mais recente seria
    // aconselhar sobre o passado.
    if (baseline.day !== dia) return foto;

    const bruta = this.advisor.recommend(
      paraOMotor(linha, foto.state, foto.activeMinutes, baseline),
    );

    // A relevância olha o que já se disse a esta pessoa (ADR-0121): nunca
    // altera número nenhum, só decide se a sugestão de hoje aparece.
    const [recentes, escondido] = await Promise.all([
      this.feedback.recent(tenantId, userId, NOT_APPLICABLE_QUIET_DAYS),
      this.feedback.hidden(tenantId, userId),
    ]);
    const { recommendation } = decideRelevance({
      recommendation: bruta,
      // A recomendação de ontem é **recalculada**, não guardada: o motor é
      // determinístico, e uma cópia gravada poderia divergir da regra.
      previous: this.recomendacaoAnterior(janela, dia),
      feedback: recentes,
      hidden: escondido,
      day: dia,
    });

    return recommendation ? { ...foto, baseline, recommendation } : { ...foto, baseline };
  }

  private async ontem(tenantId: string, agora: Date): Promise<string> {
    const zona = await this.zonas.findTimeZone(tenantId);
    const hoje = new Intl.DateTimeFormat('en-CA', {
      timeZone: zona,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(agora);
    const d = new Date(`${hoje}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  /**
   * A recomendação do **dia de trabalho anterior**, recalculada.
   *
   * Recalcular em vez de guardar mantém uma verdade só: se a regra mudar, o
   * histórico muda com ela, em vez de ficar uma cópia a discordar do motor.
   */
  private recomendacaoAnterior(janela: readonly DailyRawRow[], dia: string) {
    const trabalhados = [...janela]
      .filter(isWorkedDay)
      .filter((l) => l.day < dia)
      .sort((a, b) => (a.day < b.day ? -1 : 1));
    const anterior = trabalhados[trabalhados.length - 1];
    if (!anterior) return null;

    const baseline = comparePersonalBaseline(janela.filter((l) => l.day <= anterior.day));
    const rec = this.advisor.recommend(
      paraOMotor(anterior, 'ok', activeMinutesOf(anterior), baseline),
    );
    return { day: anterior.day, code: rec.code, evidence: rec.evidence };
  }

  /** Mesma regra da ADR-0116: ficha, ou login em conta de motorista. */
  private async sujeito(tenantId: string, userId: string): Promise<DailySubject | null> {
    const ficha = await this.kpis.driverIdForUser(tenantId, userId);
    if (ficha) return { kind: 'driver', driverId: ficha };

    const conta = await this.contas.findAccountType(tenantId);
    return conta === 'driver' ? { kind: 'user', userId } : null;
  }
}

/** Entrada do motor a partir de uma linha crua — a mesma para hoje e para ontem. */
function paraOMotor(
  linha: DailyRawRow,
  state: DriverDayState,
  activeMinutes: number | null,
  baseline: PersonalBaseline | null,
) {
  return {
    state,
    delivered: linha.delivered,
    failed: linha.failed,
    activeMinutes,
    savedKm: linha.savedKm,
    plans: linha.plans,
    baseline,
  };
}

/** Calendário recuado, em dias. A janela é de calendário; a amostra, de trabalho. */
function recuar(day: string, dias: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}

function vazio(day: string, state: DriverDayState): DriverDailySnapshot {
  return {
    day,
    state,
    delivered: 0,
    failed: 0,
    onTime: 0,
    successRate: null,
    onTimeRate: null,
    activeMinutes: null,
    savings: null,
    projectedAt: null,
  };
}

/**
 * Estado do dia a partir da linha crua.
 *
 * `incomplete` existe porque um dia com trabalho e sem limites de atividade não
 * é um dia completo — e chamar-lhe `ok` esconderia que a duração é desconhecida
 * justamente onde ela seria usada para sugerir descanso.
 */
function toSnapshot(row: DailyRawRow): DriverDailySnapshot {
  const activeMinutes = activeMinutesOf(row);
  const houveTrabalho = row.delivered + row.failed > 0 || row.plans > 0;
  const state: DriverDayState = !houveTrabalho
    ? 'no-work'
    : activeMinutes === null
      ? 'incomplete'
      : 'ok';

  const fuelLiters = savedFuelLitersOf(row);
  return {
    day: row.day,
    state,
    delivered: row.delivered,
    failed: row.failed,
    onTime: row.onTime,
    successRate: successRateOf(row),
    onTimeRate: onTimeRateOf(row),
    activeMinutes,
    savings:
      row.plans > 0
        ? {
            distanceKm: row.savedKm,
            timeMinutes: row.savedMinutes,
            fuelLiters,
            estimated: true,
          }
        : null,
    projectedAt: row.projectedAt.toISOString(),
  };
}
