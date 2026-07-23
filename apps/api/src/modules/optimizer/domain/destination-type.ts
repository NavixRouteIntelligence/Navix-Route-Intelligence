import type { DestinationType } from '@navix/contracts';

export type { DestinationType };

/**
 * Tempo de serviço **padrão por tipo de destino**, em minutos (ADR-0064). Um
 * hospital (recepção, andares) demora mais que uma casa. Usado como fallback
 * quando a parada não traz `serviceTimeMinutes` explícito. Tunável e, adiante,
 * substituível pelas médias históricas da Inteligência Coletiva (RSE-4).
 * `other` ⇒ sem default (cai no tempo de serviço global).
 */
export const DESTINATION_SERVICE_MINUTES: Record<DestinationType, number | null> = {
  residence: 3,
  apartment: 6,
  condo: 7,
  commerce: 4,
  company: 5,
  hospital: 12,
  mall: 8,
  other: null,
};

/** Tempo de serviço do tipo (min), ou null quando não há default. */
export function serviceMinutesForDestination(type?: DestinationType | null): number | null {
  if (!type) return null;
  return DESTINATION_SERVICE_MINUTES[type] ?? null;
}

/**
 * Palavras-chave por tipo (pt/es/en), ordem = prioridade de match. Heurística
 * determinística — a **seam** para um classificador de ML/POI adiante (RSE-5),
 * pela mesma função. Normaliza acentos e caixa antes de casar.
 */
const KEYWORDS: [DestinationType, readonly string[]][] = [
  ['hospital', ['hospital', 'clinica', 'upa', 'pronto socorro', 'pronto-socorro', 'posto de saude', 'saude', 'ambulatorio']],
  ['mall', ['shopping', 'mall', 'centro comercial']],
  ['hospital', ['santa casa']],
  ['company', ['ltda', 's/a', 's.a', 'empresa', 'escritorio', 'galpao', 'industria', 'corporativo', 'coworking']],
  ['commerce', ['loja', 'comercio', 'mercado', 'mercearia', 'restaurante', 'padaria', 'farmacia', 'supermercado', 'shop']],
  ['condo', ['condominio', 'cond.', 'residencial', 'portaria', 'torre', 'bloco']],
  ['apartment', ['apartamento', 'apto', 'apto.', 'apt', 'ap.', 'andar', 'cobertura']],
  ['residence', ['casa', 'residencia', 'sobrado', 'vivenda']],
];

/** Remove acentos e baixa a caixa (casamento robusto de palavras-chave). */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // remove marcas diacríticas combinantes
    .toLowerCase();
}

/**
 * Classifica um destino a partir do texto do endereço e, quando houver, do
 * **nome de quem recebe** (ADR-0076).
 *
 * O destinatário costuma ser o único sinal disponível: endereços reais são
 * "Av. Paulista, 1000" — sem "loja", "casa" ou "apartamento" —, então casar só
 * o endereço devolvia `null` para praticamente tudo e jogava toda a rota no
 * grupo "outros". "Acme Ltda" resolve o que o endereço não resolve.
 *
 * Determinística; retorna `null` quando nada casa (cai no default global — não
 * "chuta" residência). É a base da classificação automática (RSE-3).
 */
export function classifyDestination(
  text?: string | null,
  recipient?: string | null,
): DestinationType | null {
  const combined = [text, recipient].filter((p): p is string => !!p && p.length > 0).join(' ');
  if (!combined) return null;
  const hay = normalize(combined);
  for (const [type, words] of KEYWORDS) {
    for (const w of words) {
      if (hay.includes(w)) return type;
    }
  }
  return null;
}
