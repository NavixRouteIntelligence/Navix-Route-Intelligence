/**
 * Quem enxerga quais entregas na listagem (ADR-0100).
 *
 * A regra vive aqui, e não no controller, porque é decisão de domínio: "de quem
 * é esta entrega" é a mesma pergunta que a ADR-0086 responde para o plano de
 * rota — fora do Tracking, o dono é a **ficha** (`drivers.id`), nunca o login.
 *
 * Duas leituras convivem no mesmo endpoint:
 *
 * - **Operação** (`admin`, `dispatcher`, `fleet_manager`) e a **API pública**
 *   (`api`, já limitada por escopo e por tenant na ADR-0094) enxergam o tenant
 *   inteiro. É o que despacho e integração existem para fazer.
 * - **Motorista** enxerga apenas as próprias. O filtro deixa de ser escolha do
 *   cliente e passa a ser imposto pelo servidor.
 */

/** Papéis para os quais a listagem é o tenant inteiro. */
const FULL_TENANT_VIEW: readonly string[] = ['admin', 'dispatcher', 'fleet_manager', 'api'];

/**
 * `true` quando o ator pode listar todas as entregas do tenant.
 *
 * Falha fechado de propósito: um papel desconhecido (ou uma conta sem papel
 * nenhum) não cai no caminho amplo — cai no escopo de motorista, que no pior
 * caso mostra as entregas sem dono, nunca as de um colega. Papel novo com
 * visão total é uma linha a mais nesta lista, decidida conscientemente.
 */
export function seesWholeTenant(roles: readonly string[]): boolean {
  return roles.some((role) => FULL_TENANT_VIEW.includes(role));
}
