import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { FleetModule } from '../fleet/fleet.module';
import { IdentityModule } from '../identity/identity.module';
import { AcceptDriverInviteUseCase } from './application/accept-driver-invite.use-case';
import { CreateDriverInviteUseCase } from './application/create-driver-invite.use-case';
import { ValidateDriverInviteUseCase } from './application/validate-driver-invite.use-case';
import { DRIVER_INVITE_REPOSITORY } from './domain/ports/driver-invite-repository.port';
import { DriverInviteOrmEntity } from './infrastructure/persistence/driver-invite.orm-entity';
import { DriverInviteRepository } from './infrastructure/persistence/driver-invite.repository';
import { DriverInviteController } from './interface/driver-invite.controller';
import { PublicDriverInviteController } from './interface/public-driver-invite.controller';

/**
 * Convite de motorista (ADR-0085).
 *
 * ## Por que é um módulo próprio
 *
 * A feature **compõe** dois contextos que não se conhecem: o Identity (criar o
 * login) e o Fleet (ligar a ficha). Colocá-la em qualquer um dos dois faria um
 * importar o outro — e o convite não é responsabilidade de nenhum: é o
 * encontro dos dois. Como módulo à parte, a dependência só aponta para baixo
 * (`driver-invite → {identity, fleet}`), sem ciclo, e ambos são consumidos
 * pelas suas **APIs públicas** (`TENANT_USER_PROVISIONING`, `FLEET_LOOKUP`,
 * `AttachDriverAccountUseCase`), nunca pelos repositórios. Mesmo desenho do
 * `public-tracking` (ADR-0082).
 */
@Module({
  imports: [TypeOrmModule.forFeature([DriverInviteOrmEntity]), IdentityModule, FleetModule],
  controllers: [DriverInviteController, PublicDriverInviteController],
  providers: [
    CreateDriverInviteUseCase,
    ValidateDriverInviteUseCase,
    AcceptDriverInviteUseCase,
    { provide: DRIVER_INVITE_REPOSITORY, useClass: DriverInviteRepository },
  ],
})
export class DriverInviteModule {}
