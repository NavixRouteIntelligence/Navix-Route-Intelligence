/**
 * Plano comercial do tenant — a reotimização dinâmica é **premium**
 * (ADR-0083 · `docs/strategy/pricing-navix.md`).
 *
 * A coluna `tenants.plan` existe desde a InitPhase0 com default `'free'`, mas
 * até aqui nenhum código a lia. Este port é o primeiro consumidor: não há
 * billing, só a leitura do que já está no banco.
 */
export interface TenantPlanPort {
  /**
   * `true` quando o plano dá direito à reotimização dinâmica.
   *
   * Em caso de dúvida (tenant inexistente, falha de leitura) devolve `false`:
   * **negar é o padrão seguro** — liberar um recurso pago por causa de um erro
   * de infraestrutura é pior do que não reotimizar.
   */
  allowsDynamicReoptimization(tenantId: string): Promise<boolean>;

  /**
   * `true` quando o plano dá direito aos **alertas preditivos** de atraso
   * (ADR-0091). Mesma leitura, mesma política de negar em caso de dúvida.
   *
   * Nota: com a segunda funcionalidade paga, este port começa a extrapolar o
   * Optimizer — plano é assunto de tenant, não de otimização. Na terceira, vale
   * movê-lo para `shared/tenancy`; hoje mudar de lugar custaria mais do que
   * rende.
   */
  allowsPredictiveAlerts(tenantId: string): Promise<boolean>;
}

export const TENANT_PLAN = Symbol('TENANT_PLAN');

/**
 * Planos com direito à reotimização dinâmica. `free` fica de fora — é
 * exatamente a fronteira que o tier paga compra.
 */
export const PREMIUM_PLANS: readonly string[] = ['fleet', 'enterprise', 'pro'];
