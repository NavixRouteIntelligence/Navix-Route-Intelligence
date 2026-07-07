import type { AddressCategory } from '@navix/contracts';

/** Classifica o tipo de endereço. Porta trocável por IA no futuro. */
export interface AddressClassifierPort {
  classify(addressText: string, recipient: string | null): AddressCategory;
}

export const ADDRESS_CLASSIFIER = Symbol('ADDRESS_CLASSIFIER');
