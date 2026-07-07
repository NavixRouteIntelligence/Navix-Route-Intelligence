import { Injectable } from '@nestjs/common';
import type { AddressCategory } from '@navix/contracts';

import type { AddressClassifierPort } from '../../domain/ports/address-classifier.port';

/**
 * Classificador heurístico por palavras-chave. Ordem importa (mais específico
 * primeiro). Trocável por um classificador de IA no futuro (mesma porta).
 */
@Injectable()
export class HeuristicAddressClassifier implements AddressClassifierPort {
  classify(addressText: string, recipient: string | null): AddressCategory {
    const t = `${addressText} ${recipient ?? ''}`.toLowerCase();

    if (/\b(cond\.?|condom[íi]nio|bloco|apto|apartamento|torre|residencial)\b/.test(t)) return 'condo';
    if (/\b(ltda|s\/a|s\.a\.?|epp|me\b|empresa|corp|inc|comercial)\b/.test(t)) return 'company';
    if (/\b(loja|shopping|mercado|farm[áa]cia|restaurante|padaria|posto|bar)\b/.test(t)) return 'commerce';
    if (/\b(rua|r\.|av\.?|avenida|travessa|alameda|casa|resid[êe]ncia)\b/.test(t)) return 'residence';
    return 'unknown';
  }
}
