import type { AddressInput, Address as AddressSnapshot } from '@navix/contracts';

import { ValidationError } from '../../../../shared/kernel/domain-error';

/** Value Object de endereço com coordenadas validadas (WGS84). Imutável. */
export class Address {
  private constructor(private readonly props: AddressSnapshot) {}

  static create(input: AddressInput): Address {
    const required: [keyof AddressInput, string][] = [
      ['street', 'Rua'],
      ['number', 'Número'],
      ['city', 'Cidade'],
      ['state', 'Estado'],
      ['postalCode', 'CEP'],
      ['country', 'País'],
    ];
    for (const [field, label] of required) {
      const value = input[field];
      if (typeof value !== 'string' || value.trim().length === 0) {
        throw new ValidationError(`${label} é obrigatório.`);
      }
    }

    Address.validateCoordinate(input.latitude, -90, 90, 'Latitude');
    Address.validateCoordinate(input.longitude, -180, 180, 'Longitude');

    return new Address({
      street: input.street.trim(),
      number: input.number.trim(),
      complement: input.complement?.trim() || null,
      city: input.city.trim(),
      state: input.state.trim(),
      postalCode: input.postalCode.trim(),
      country: input.country.trim().toUpperCase(),
      latitude: input.latitude,
      longitude: input.longitude,
    });
  }

  static restore(props: AddressSnapshot): Address {
    return new Address(props);
  }

  snapshot(): AddressSnapshot {
    return { ...this.props };
  }

  get latitude(): number {
    return this.props.latitude;
  }

  get longitude(): number {
    return this.props.longitude;
  }

  private static validateCoordinate(value: number, min: number, max: number, label: string): void {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
      throw new ValidationError(`${label} deve estar entre ${min} e ${max}.`);
    }
  }
}
