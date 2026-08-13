import {
  needsReview,
  reviewReason,
  type GeocodeAccuracy,
  type GeocodeConfidence,
} from './geocode-quality';

const morada = (
  over: Partial<{ confidence: GeocodeConfidence; accuracy: GeocodeAccuracy; featureType: string }> = {},
) => ({
  confidence: 'exact' as GeocodeConfidence,
  accuracy: 'rooftop' as GeocodeAccuracy,
  featureType: 'address',
  ...over,
});

describe('needsReview', () => {
  it('uma morada exata no telhado entra sem revisão', () => {
    expect(needsReview(morada())).toBe(false);
    expect(reviewReason(morada())).toBeNull();
  });

  it.each(['high', 'exact'] as GeocodeConfidence[])(
    'confiança %s é suficiente',
    (confidence) => {
      expect(needsReview(morada({ confidence }))).toBe(false);
    },
  );

  it.each(['medium', 'low'] as GeocodeConfidence[])(
    'confiança %s vai para revisão',
    (confidence) => {
      expect(needsReview(morada({ confidence }))).toBe(true);
    },
  );

  it('confiança desconhecida conta como fraca', () => {
    // Um provedor que não sabe dizer a confiança não é motivo para confiar.
    expect(needsReview(morada({ confidence: 'unknown' }))).toBe(true);
  });

  it.each(['rooftop', 'parcel', 'point', 'interpolated', 'intersection'] as GeocodeAccuracy[])(
    'precisão %s identifica um destino',
    (accuracy) => {
      expect(needsReview(morada({ accuracy }))).toBe(false);
    },
  );

  it.each(['street', 'approximate', 'unknown'] as GeocodeAccuracy[])(
    'precisão %s não é uma porta',
    (accuracy) => {
      expect(needsReview(morada({ accuracy }))).toBe(true);
    },
  );

  it.each(['street', 'place', 'postcode', 'region', 'country'])(
    '%s não é morada e vai para revisão',
    (featureType) => {
      // Um `place` é uma cidade inteira: aceitar isso põe o pino na câmara
      // municipal e chama-lhe entrega.
      expect(needsReview(morada({ featureType }))).toBe(true);
    },
  );

  it('interpolado com confiança alta é aceite', () => {
    // Interpolado não é o telhado, mas é a rua e o quarteirão certos. Recusá-lo
    // mandaria metade das moradas brasileiras para revisão manual.
    expect(needsReview(morada({ accuracy: 'interpolated', confidence: 'high' }))).toBe(false);
  });

  it('interpolado com confiança média não é aceite', () => {
    expect(needsReview(morada({ accuracy: 'interpolated', confidence: 'medium' }))).toBe(true);
  });
});

describe('reviewReason', () => {
  it('explica que não é uma morada', () => {
    expect(reviewReason(morada({ featureType: 'place' }))).toMatch(/não é uma morada/i);
  });

  it('explica a baixa confiança', () => {
    expect(reviewReason(morada({ confidence: 'low' }))).toMatch(/confiança/i);
  });

  it('explica a coordenada aproximada', () => {
    expect(reviewReason(morada({ accuracy: 'approximate' }))).toMatch(/aproximada/i);
  });

  it('dá um motivo só, mesmo quando há três', () => {
    // Dizer três coisas de uma vez sobre a mesma linha não ajuda quem a está a
    // corrigir.
    const razao = reviewReason(
      morada({ featureType: 'place', confidence: 'low', accuracy: 'approximate' }),
    );

    expect(razao).toMatch(/não é uma morada/i);
    expect(razao).not.toMatch(/confiança/i);
  });

  it('nunca há motivo sem revisão, nem revisão sem motivo', () => {
    // As duas funções lêem a mesma regra; separá-las deixaria uma linha
    // marcada para revisão sem nada a explicar porquê.
    const casos = [
      morada(),
      morada({ confidence: 'low' }),
      morada({ accuracy: 'street' }),
      morada({ featureType: 'place' }),
      morada({ confidence: 'medium', accuracy: 'interpolated' }),
    ];

    for (const caso of casos) {
      expect(needsReview(caso)).toBe(reviewReason(caso) !== null);
    }
  });
});
