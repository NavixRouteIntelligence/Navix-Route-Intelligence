import { Resolver } from 'node:dns/promises';

import { Injectable } from '@nestjs/common';

import type { DomainOwnershipVerifierPort } from '../../application/ports/domain-ownership-verifier.port';

@Injectable()
export class DnsDomainOwnershipVerifier implements DomainOwnershipVerifierPort {
  async hasVerificationRecord(domain: string, token: string): Promise<boolean> {
    const resolver = new Resolver({ timeout: 3_000, tries: 2 });
    try {
      const records = await resolver.resolveTxt(`_navix-verification.${domain}`);
      const expected = `navix-verification=${token}`;
      return records.some((parts) => parts.join('') === expected);
    } catch {
      return false;
    }
  }
}
