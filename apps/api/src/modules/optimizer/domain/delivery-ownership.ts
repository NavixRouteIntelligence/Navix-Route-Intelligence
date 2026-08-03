/**
 * Propriedade das entregas enviadas numa otimização de motorista (ADR-0099).
 *
 * O motorista manda uma lista de `deliveryIds`. A RLS garante que ele não
 * alcance outro tenant, mas **dentro** do tenant nada impedia que ele
 * otimizasse — e portanto reordenasse e enxergasse as coordenadas de — entregas
 * atribuídas a um colega.
 *
 * A decisão vive aqui, pura, e não numa consulta com `WHERE driver_id = ...`:
 * uma consulta filtrada devolveria menos linhas e a otimização seguiria adiante
 * com o que sobrou, silenciosamente. O que se quer é o oposto — recusar o
 * pedido inteiro e dizer por quê.
 */

/** A quem uma entrega pertence. `driverId` nulo = sem motorista atribuído. */
export interface DeliveryOwnership {
  id: string;
  driverId: string | null;
}

export interface OwnershipVerdict {
  /** Ids que o tenant não enxerga: inexistentes, apagados ou de outro tenant. */
  missing: string[];
  /** Ids que existem no tenant, mas não são deste motorista. */
  foreign: string[];
}

/**
 * Confronta os ids pedidos com o que o tenant enxerga.
 *
 * `driverId` é a **ficha** de quem pediu, ou `null` para o motorista autônomo,
 * que não tem ficha (ADR-0085). Para ele, "sua" entrega é a que não tem
 * motorista atribuído — o tenant é ele, e ninguém mais atribui nada ali.
 *
 * A consequência disso num tenant de frota é deliberada: uma entrega **sem
 * motorista** não pertence a ninguém, então um motorista com ficha não pode
 * otimizá-la. Pegar trabalho não atribuído é uma atribuição — uma decisão de
 * quem despacha —, não um efeito colateral de reordenar a própria rota.
 */
export function checkOwnership(
  pedidos: readonly string[],
  visiveis: readonly DeliveryOwnership[],
  driverId: string | null,
): OwnershipVerdict {
  const porId = new Map(visiveis.map((d) => [d.id, d.driverId]));
  const missing: string[] = [];
  const foreign: string[] = [];

  for (const id of new Set(pedidos)) {
    if (!porId.has(id)) {
      missing.push(id);
      continue;
    }
    if (porId.get(id) !== driverId) foreign.push(id);
  }

  return { missing, foreign };
}

/** `true` quando toda entrega pedida é do motorista. */
export function isFullyOwned(verdict: OwnershipVerdict): boolean {
  return verdict.missing.length === 0 && verdict.foreign.length === 0;
}
