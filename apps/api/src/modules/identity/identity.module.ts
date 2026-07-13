import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

// Application
import { ChangePasswordUseCase } from './application/change-password.use-case';
import { GetProfileUseCase } from './application/get-profile.use-case';
import { GetUserProfileUseCase } from './application/get-user-profile.use-case';
import { LoginUseCase } from './application/login.use-case';
import { LogoutUseCase } from './application/logout.use-case';
import { RefreshTokenUseCase } from './application/refresh-token.use-case';
import { RegisterUseCase } from './application/register.use-case';
import { RequestPasswordResetUseCase } from './application/request-password-reset.use-case';
import { ResetPasswordUseCase } from './application/reset-password.use-case';
import { UpdateAvatarUseCase } from './application/update-avatar.use-case';
import { UpdateUserProfileUseCase } from './application/update-user-profile.use-case';
import { PASSWORD_HASHER } from './application/ports/password-hasher.port';
import { TOKEN_SERVICE } from './application/ports/token-service.port';
// Domain ports
import { PASSWORD_RESET_TOKEN_REPOSITORY } from './domain/ports/password-reset-token-repository.port';
import { REFRESH_TOKEN_REPOSITORY } from './domain/ports/refresh-token-repository.port';
import { USER_PROFILE_REPOSITORY } from './domain/ports/user-profile-repository.port';
import { USER_REPOSITORY } from './domain/ports/user-repository.port';
// Infrastructure
import { PasswordResetTokenOrmEntity } from './infrastructure/persistence/password-reset-token.orm-entity';
import { PasswordResetTokenRepository } from './infrastructure/persistence/password-reset-token.repository';
import { RefreshTokenOrmEntity } from './infrastructure/persistence/refresh-token.orm-entity';
import { RefreshTokenRepository } from './infrastructure/persistence/refresh-token.repository';
import { UserOrmEntity } from './infrastructure/persistence/user.orm-entity';
import { UserProfileOrmEntity } from './infrastructure/persistence/user-profile.orm-entity';
import { UserProfileRepository } from './infrastructure/persistence/user-profile.repository';
import { UserRepository } from './infrastructure/persistence/user.repository';
import { Argon2PasswordHasher } from './infrastructure/security/argon2-password-hasher';
import { JwtTokenService } from './infrastructure/security/jwt-token.service';
import { KEY_RING } from '../../shared/security/keys/key-ring.port';
import { LocalKeyRing } from '../../shared/security/keys/local-key-ring';
// Interface
import { AuthController } from './interface/auth.controller';
import { MobileAuthController } from './interface/mobile-auth.controller';
import { ProfileController } from './interface/profile.controller';
import { JwtStrategy } from './interface/jwt.strategy';

/**
 * Módulo Identity & Access. Fia as portas do domínio às implementações da
 * infraestrutura via injeção de dependência (ver docs/architecture.md §3-4).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserOrmEntity,
      UserProfileOrmEntity,
      RefreshTokenOrmEntity,
      PasswordResetTokenOrmEntity,
    ]),
    PassportModule,
    JwtModule.register({}),
  ],
  controllers: [AuthController, MobileAuthController, ProfileController],
  providers: [
    LoginUseCase,
    RegisterUseCase,
    RefreshTokenUseCase,
    LogoutUseCase,
    GetProfileUseCase,
    ChangePasswordUseCase,
    RequestPasswordResetUseCase,
    ResetPasswordUseCase,
    GetUserProfileUseCase,
    UpdateUserProfileUseCase,
    UpdateAvatarUseCase,
    JwtStrategy,
    { provide: USER_REPOSITORY, useClass: UserRepository },
    { provide: USER_PROFILE_REPOSITORY, useClass: UserProfileRepository },
    { provide: REFRESH_TOKEN_REPOSITORY, useClass: RefreshTokenRepository },
    { provide: PASSWORD_RESET_TOKEN_REPOSITORY, useClass: PasswordResetTokenRepository },
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    { provide: TOKEN_SERVICE, useClass: JwtTokenService },
    { provide: KEY_RING, useClass: LocalKeyRing },
  ],
})
export class IdentityModule {}
