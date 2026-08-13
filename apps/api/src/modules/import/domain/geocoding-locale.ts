/**
 * País e idioma a enviar ao geocodificador, derivados do fuso do tenant
 * (ADR-0133).
 *
 * ## Por que o fuso e não um campo de país
 *
 * A tabela `tenants` não tem país — tem `region` (que na prática é `'global'`
 * em toda a base) e `time_zone`, este sim preenchido e usado a sério desde o
 * dia operacional (ADR-0105). Acrescentar uma coluna de país criaria um campo
 * que ninguém preenche e que ficaria a mentir por omissão; o fuso já está lá e
 * já é escolhido por quem opera.
 *
 * ## Por que «desconhecido» não vira Brasil
 *
 * O valor por omissão do fuso é `UTC`, que não diz nada. A tentação é assumir o
 * mercado maior — e uma morada portuguesa filtrada por `country=br` devolve o
 * resultado mais parecido **no Brasil**, com coordenadas plausíveis e um pino a
 * milhares de quilómetros. Sem sinal, não se filtra: a qualidade baixa, mas a
 * resposta continua a ser sobre o sítio certo.
 */

export interface GeocodingLocale {
  /** ISO 3166-1 alpha-2, minúsculo. Ausente significa **sem filtro de país**. */
  country?: string;
  /** Idioma dos rótulos devolvidos. */
  language: string;
}

/** Fusos de Portugal, incluindo as regiões autónomas. */
const PORTUGAL = new Set(['Europe/Lisbon', 'Atlantic/Azores', 'Atlantic/Madeira']);

/**
 * Fusos do Brasil.
 *
 * Enumerados em vez de deduzidos de `America/*`: `America/` cobre o continente
 * inteiro, e uma morada de Bogotá ou de Buenos Aires acabaria filtrada por
 * `country=br`.
 */
const BRASIL = new Set([
  'America/Sao_Paulo',
  'America/Bahia',
  'America/Fortaleza',
  'America/Recife',
  'America/Maceio',
  'America/Belem',
  'America/Santarem',
  'America/Araguaina',
  'America/Manaus',
  'America/Cuiaba',
  'America/Campo_Grande',
  'America/Porto_Velho',
  'America/Boa_Vista',
  'America/Rio_Branco',
  'America/Eirunepe',
  'America/Noronha',
]);

/**
 * O par país/idioma para este fuso.
 *
 * O idioma é sempre `pt`: os dois mercados falam português, e os rótulos
 * devolvidos alimentam a morada que o motorista lê.
 */
export function localeForTimeZone(timeZone: string | null | undefined): GeocodingLocale {
  const zona = (timeZone ?? '').trim();
  if (PORTUGAL.has(zona)) return { country: 'pt', language: 'pt' };
  if (BRASIL.has(zona)) return { country: 'br', language: 'pt' };
  return { language: 'pt' };
}
