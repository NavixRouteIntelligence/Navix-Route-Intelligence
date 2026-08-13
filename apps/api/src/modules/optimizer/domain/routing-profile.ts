import type { VehicleType } from '@navix/contracts';

/**
 * Mapeamento entre os tipos de veículo da Navix e os perfis do provedor de
 * rotas (ADR-0108).
 *
 * ## Por que isto existe
 *
 * O provedor era chamado **sempre** com `driving`, qualquer que fosse o
 * veículo. Uma bicicleta recebia distâncias e durações de carro — por
 * autoestradas onde ela não pode circular —, e um camião recebia rotas que
 * ignoram ponte baixa, limite de peso e restrição de centro urbano.
 *
 * A tabela abaixo é deliberadamente **explícita**, com uma linha por tipo. Um
 * `switch` com `default: 'driving'` esconderia exatamente o que interessa
 * declarar: quais tipos o provedor atende de fato, e quais são aproximação.
 */

/** Perfis de deslocamento suportados pelo provedor (Mapbox Matrix API). */
/**
 * Perfis do provedor.
 *
 * `driving` usa **velocidades típicas da via**, não trânsito em tempo real —
 * quem lê trânsito é `driving-traffic`, com um limite de coordenadas mais
 * apertado. Ver `matrix-profile.ts` para quando cada um se justifica (ADR-0126).
 */
export type RoutingProfile = 'driving' | 'driving-traffic' | 'cycling' | 'walking';

/** Quão fielmente o perfil representa o veículo. */
export type ProfileFidelity =
  /** O provedor tem um perfil para este veículo. */
  | 'exact'
  /**
   * O provedor não tem perfil para este veículo; usa-se o mais próximo, e as
   * restrições específicas dele **não** são aplicadas. Nunca é silencioso: sai
   * no plano e na explicação da rota.
   */
  | 'approximate';

export interface RoutingProfileMapping {
  profile: RoutingProfile;
  fidelity: ProfileFidelity;
  /** O que o perfil escolhido não representa. Vazio quando é exato. */
  caveat?: string;
  /**
   * A rota partia agora e o trânsito em tempo real **era aplicável**, mas não
   * coube (ADR-0132).
   *
   * Só existe neste caso. Uma bicicleta não «perdeu» o trânsito — ela nunca o
   * teve; uma rota de amanhã também não. Aqui alguém ia sair agora, num carro,
   * e recebeu velocidades típicas da via em vez do trânsito do momento, porque
   * o `driving-traffic` aceita 10 coordenadas e a rota tinha mais.
   *
   * Registá-lo é o que impede que um ETA sem trânsito seja lido como ETA com
   * trânsito: o perfil gravado já era honesto sobre **o quê**, mas calava-se
   * sobre o **porquê**, e quem lê o plano não tinha como distinguir «não quis»
   * de «não coube».
   */
  trafficDenied?: 'too-many-points';
}

const MAPPING: Record<VehicleType, RoutingProfileMapping> = {
  car: { profile: 'driving', fidelity: 'exact' },
  bicycle: { profile: 'cycling', fidelity: 'exact' },
  // Furgão circula na malha viária de carro; a diferença que importa é
  // capacidade, e essa o motor já trata (ADR-0022).
  van: {
    profile: 'driving',
    fidelity: 'approximate',
    caveat: 'dimensões e restrições de carga do furgão não entram no traçado',
  },
  // Moto usa a mesma malha; o provedor não modela corredor entre faixas nem
  // acesso a via restrita a duas rodas.
  motorcycle: {
    profile: 'driving',
    fidelity: 'approximate',
    caveat: 'vantagens e restrições próprias de moto não entram no traçado',
  },
  // O caso mais consequente: o provedor não tem perfil de camião, então altura,
  // peso por eixo e proibição de centro urbano não são considerados. Uma rota
  // aceita aqui pode ser impraticável na rua.
  truck: {
    profile: 'driving',
    fidelity: 'approximate',
    caveat: 'altura, peso e restrição de centro urbano do camião não entram no traçado',
  },
};

/** Perfil usado quando não há veículo informado — o comportamento legado. */
const SEM_VEICULO: RoutingProfileMapping = { profile: 'driving', fidelity: 'exact' };

/**
 * Perfil do provedor para um tipo de veículo.
 *
 * Sem tipo informado, `driving` — é o que o motor sempre fez, e mudar isso
 * alteraria silenciosamente rotas que hoje funcionam.
 */
export function resolveRoutingProfile(type: VehicleType | null | undefined): RoutingProfileMapping {
  return type ? MAPPING[type] : SEM_VEICULO;
}
