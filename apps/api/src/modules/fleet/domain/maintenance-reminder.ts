import type { MaintenanceType, ReminderStatus } from '@navix/contracts';

/** Limiares de "vence em breve" (FASE 3, V2). Tunáveis. */
export const DUE_SOON_DAYS = 30;
export const DUE_SOON_KM = 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ReminderInput {
  type: MaintenanceType;
  performedAt: Date;
  createdAt: Date;
  nextDueDate: Date | null;
  nextDueOdometerKm: number | null;
}

export interface ReminderContext {
  now: Date;
  currentOdometerKm: number | null;
}

export interface ComputedReminder {
  type: MaintenanceType;
  dueDate: Date | null;
  dueOdometerKm: number | null;
  remainingDays: number | null;
  remainingKm: number | null;
  status: ReminderStatus;
}

const STATUS_RANK: Record<ReminderStatus, number> = { overdue: 0, due_soon: 1, ok: 2 };

/** Ordena os registros do mesmo tipo do mais recente para o mais antigo. */
function mostRecentFirst(a: ReminderInput, b: ReminderInput): number {
  const byPerformed = b.performedAt.getTime() - a.performedAt.getTime();
  return byPerformed !== 0 ? byPerformed : b.createdAt.getTime() - a.createdAt.getTime();
}

/**
 * Deriva os lembretes: para cada TIPO, considera o **registro mais recente com
 * vencimento** (por data e/ou km) e calcula o que falta. `remainingDays`/`Km`
 * são positivos quando ainda falta, negativos quando venceu; `null` quando aquela
 * dimensão não se aplica (sem data / sem hodômetro atual). Determinística.
 */
export function computeReminders(
  records: ReminderInput[],
  ctx: ReminderContext,
): ComputedReminder[] {
  const latestByType = new Map<MaintenanceType, ReminderInput>();
  for (const r of records) {
    if (r.nextDueDate === null && r.nextDueOdometerKm === null) continue;
    const current = latestByType.get(r.type);
    if (!current || mostRecentFirst(r, current) < 0) {
      latestByType.set(r.type, r);
    }
  }

  const reminders: ComputedReminder[] = [];
  for (const r of latestByType.values()) {
    const remainingDays =
      r.nextDueDate === null ? null : Math.ceil((r.nextDueDate.getTime() - ctx.now.getTime()) / DAY_MS);
    const remainingKm =
      r.nextDueOdometerKm === null || ctx.currentOdometerKm === null
        ? null
        : r.nextDueOdometerKm - ctx.currentOdometerKm;

    const overdue = (remainingDays !== null && remainingDays < 0) || (remainingKm !== null && remainingKm < 0);
    const dueSoon =
      (remainingDays !== null && remainingDays <= DUE_SOON_DAYS) ||
      (remainingKm !== null && remainingKm <= DUE_SOON_KM);
    const status: ReminderStatus = overdue ? 'overdue' : dueSoon ? 'due_soon' : 'ok';

    reminders.push({
      type: r.type,
      dueDate: r.nextDueDate,
      dueOdometerKm: r.nextDueOdometerKm,
      remainingDays,
      remainingKm,
      status,
    });
  }

  // Mais urgentes primeiro; empates pelo menor "falta" (dias, depois km).
  return reminders.sort((a, b) => {
    const byStatus = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (byStatus !== 0) return byStatus;
    const ad = a.remainingDays ?? Number.POSITIVE_INFINITY;
    const bd = b.remainingDays ?? Number.POSITIVE_INFINITY;
    if (ad !== bd) return ad - bd;
    const ak = a.remainingKm ?? Number.POSITIVE_INFINITY;
    const bk = b.remainingKm ?? Number.POSITIVE_INFINITY;
    return ak - bk;
  });
}
