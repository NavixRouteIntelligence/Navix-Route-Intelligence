import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { scopedRepository } from '../../../shared/database/transaction-context';
import {
  USER_EMAIL_CONSTRAINT,
  isUniqueViolation,
} from '../../../shared/database/unique-violation';
import { ConflictError } from '../../../shared/kernel/domain-error';
import { newId } from '../../../shared/kernel/id';
import { UserOrmEntity } from '../infrastructure/persistence/user.orm-entity';
import { PASSWORD_HASHER, type PasswordHasherPort } from './ports/password-hasher.port';

export interface ProvisionUserInput {
  /** Tenant de destino. Quem chama é responsável por já tê-lo autenticado. */
  tenantId: string;
  email: string;
  /** Senha em claro, escolhida pelo próprio usuário. Sai daqui só como hash. */
  password: string;
  roles: string[];
}

/**
 * API pública do Identity para **criar um login dentro de um tenant que já
 * existe** — o oposto do `RegisterUseCase`, que sempre abre organização nova.
 *
 * Existe por causa do convite de motorista (ADR-0085): o convidado se cadastra
 * numa empresa alheia à sua escolha, e o tenant vem do token do convite. Quem
 * chama entrega o `tenantId` já resolvido; este serviço não o infere de nada do
 * cliente.
 *
 * Fica atrás de uma port para que outros módulos não precisem do
 * `USER_REPOSITORY` nem do hasher — a mesma fronteira que o `FLEET_LOOKUP`
 * mantém no Fleet.
 */
export interface TenantUserProvisioningPort {
  /** E-mail é identidade **global** (ADR-0016): já em uso em qualquer tenant. */
  emailTaken(email: string): Promise<boolean>;
  /** Cria o usuário e devolve o id. `ConflictError` se o e-mail já existir. */
  provision(input: ProvisionUserInput): Promise<{ id: string }>;
}

export const TENANT_USER_PROVISIONING = Symbol('TENANT_USER_PROVISIONING');

@Injectable()
export class TenantUserProvisioningService implements TenantUserProvisioningPort {
  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly base: Repository<UserOrmEntity>,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasherPort,
  ) {}

  async emailTaken(email: string): Promise<boolean> {
    const count = await this.repo
      .createQueryBuilder('u')
      .where('LOWER(u.email) = LOWER(:email)', { email })
      .getCount();
    return count > 0;
  }

  async provision(input: ProvisionUserInput): Promise<{ id: string }> {
    const id = newId();
    const now = new Date();
    try {
      await this.repo.insert({
        id,
        tenantId: input.tenantId,
        email: input.email.trim().toLowerCase(),
        passwordHash: await this.hasher.hash(input.password),
        status: 'active',
        roles: input.roles,
        createdAt: now,
        updatedAt: now,
      });
    } catch (err) {
      // O índice único global é a rede de segurança contra a corrida entre um
      // `emailTaken` que passou e um cadastro simultâneo com o mesmo e-mail.
      if (isUniqueViolation(err, USER_EMAIL_CONSTRAINT)) {
        throw new ConflictError('E-mail já cadastrado.');
      }
      throw err;
    }
    return { id };
  }

  /**
   * `users` tem a RLS desligada (migração CreateAppRole — login e demais fluxos
   * pré-tenant precisam ler antes de haver contexto), então o isolamento aqui
   * depende do `tenantId` que o chamador passa. Ainda assim resolvemos pelo
   * `scopedRepository` para que a escrita participe da transação em curso —
   * é o que torna "criar o login" e "ligar a ficha" atômicos no aceite.
   */
  private get repo(): Repository<UserOrmEntity> {
    return scopedRepository(this.base);
  }
}
