/**
 * O que se aceita de um geocodificador, e o que vai para revisão (ADR-0133).
 *
 * ## O problema que isto resolve
 *
 * O adaptador v5 aceitava o **primeiro** resultado, sempre. «Rua Alfa», sem
 * número e sem cidade, devolve o centro de uma freguesia com coordenadas
 * perfeitamente válidas — e essa parada entrava na rota como qualquer outra.
 * O motorista só descobria à porta, e o plano tinha sido otimizado à volta de
 * um ponto que não é uma morada.
 *
 * A v6 devolve duas coisas que a v5 não dava: **quão bem** a morada casou
 * (`match_code.confidence`) e **como** a coordenada foi obtida
 * (`coordinates.accuracy`). Estas regras são sobre elas.
 */

/** Confiança do casamento, no vocabulário da v6. */
export type GeocodeConfidence = 'exact' | 'high' | 'medium' | 'low' | 'unknown';

/**
 * Como a coordenada foi obtida, no vocabulário da v6.
 *
 * `rooftop` e `parcel` são o edifício. `interpolated` é estimado ao longo da
 * rua a partir da numeração vizinha — não é a porta, mas é a rua certa e o
 * quarteirão certo, que chega para conduzir até lá. `street` e `approximate`
 * não são morada nenhuma: são o meio da rua e o centro da localidade.
 */
export type GeocodeAccuracy =
  | 'rooftop'
  | 'parcel'
  | 'point'
  | 'interpolated'
  | 'intersection'
  | 'street'
  | 'approximate'
  | 'unknown';

/** Precisões que não identificam um destino de entrega. */
const IMPRECISAS: ReadonlySet<string> = new Set(['street', 'approximate', 'unknown']);

/** Confianças que não bastam para uma parada entrar sozinha. */
const FRACAS: ReadonlySet<string> = new Set(['medium', 'low', 'unknown']);

export interface GeocodeQualityInput {
  /** `match_code.confidence` da v6. */
  confidence: GeocodeConfidence;
  /** `coordinates.accuracy` da v6. */
  accuracy: GeocodeAccuracy;
  /** `properties.feature_type` da v6 — `address` é o único que é uma morada. */
  featureType: string;
}

/**
 * O resultado precisa de alguém a olhar antes de virar parada.
 *
 * Três motivos, e qualquer um deles basta:
 *
 * 1. **Não é uma morada.** A v6 diz o que casou: `street`, `place`, `postcode`.
 *    Um `place` é uma cidade inteira — aceitar isso põe o pino na câmara
 *    municipal e chama-lhe entrega.
 * 2. **A confiança é fraca.** `medium` já significa que o geocodificador tem
 *    dúvidas; `low` significa que devolveu o menos mau.
 * 3. **A coordenada é imprecisa.** `street` é o meio da rua e `approximate` é o
 *    centro da localidade — nenhum dos dois é uma porta.
 *
 * Marcar para revisão **não** descarta a linha: ela continua importável depois
 * de alguém confirmar. Descartá-la perderia uma entrega real por causa de uma
 * morada mal escrita, e aceitá-la em silêncio é o defeito que se está a
 * corrigir.
 */
export function needsReview(input: GeocodeQualityInput): boolean {
  if (input.featureType !== 'address') return true;
  if (FRACAS.has(input.confidence)) return true;
  return IMPRECISAS.has(input.accuracy);
}

/**
 * Motivo legível da revisão, para a tela poder explicar-se.
 *
 * `null` quando não há revisão a fazer. A ordem espelha a de [needsReview]: o
 * primeiro motivo que se aplica é o que se mostra, porque dizer três coisas de
 * uma vez sobre a mesma linha não ajuda quem está a corrigi-la.
 */
export function reviewReason(input: GeocodeQualityInput): string | null {
  if (input.featureType !== 'address') {
    return 'O endereço encontrado não é uma morada exata; confirme antes de importar.';
  }
  if (FRACAS.has(input.confidence)) {
    return 'A morada foi encontrada com baixa confiança; confirme antes de importar.';
  }
  if (IMPRECISAS.has(input.accuracy)) {
    return 'A coordenada é aproximada e pode não ser a porta; confirme antes de importar.';
  }
  return null;
}
