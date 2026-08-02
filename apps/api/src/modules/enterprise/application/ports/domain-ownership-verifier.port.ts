export interface DomainOwnershipVerifierPort {
  hasVerificationRecord(domain: string, token: string): Promise<boolean>;
}

export const DOMAIN_OWNERSHIP_VERIFIER = Symbol('DOMAIN_OWNERSHIP_VERIFIER');
