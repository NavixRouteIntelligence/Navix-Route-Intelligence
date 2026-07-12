import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { GetSettingsUseCase } from './application/get-settings.use-case';
import { UpdateSettingsUseCase } from './application/update-settings.use-case';
import { USER_SETTINGS_REPOSITORY } from './domain/ports/user-settings-repository.port';
import { UserSettingsOrmEntity } from './infrastructure/persistence/user-settings.orm-entity';
import { UserSettingsRepository } from './infrastructure/persistence/user-settings.repository';
import { UserSettingsController } from './interface/user-settings.controller';

/**
 * Preferências do usuário (Tema, Idioma, Preferências de UI) sincronizadas com
 * o servidor. Fundação da área de Configurações (ver docs/modules/settings.md).
 */
@Module({
  imports: [TypeOrmModule.forFeature([UserSettingsOrmEntity])],
  controllers: [UserSettingsController],
  providers: [
    GetSettingsUseCase,
    UpdateSettingsUseCase,
    { provide: USER_SETTINGS_REPOSITORY, useClass: UserSettingsRepository },
  ],
})
export class UserSettingsModule {}
