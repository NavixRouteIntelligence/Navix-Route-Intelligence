import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type {
  AuthenticatedUser,
  AuthTokens,
  ForgotPasswordResponse,
  LoginResponse,
  ResourceResponse,
} from '@navix/contracts';

import { CurrentUser } from '../../../shared/interface/current-user.decorator';
import { JwtAuthGuard } from '../../../shared/security/jwt-auth.guard';
import { ChangePasswordUseCase } from '../application/change-password.use-case';
import { GetProfileUseCase } from '../application/get-profile.use-case';
import { LoginUseCase } from '../application/login.use-case';
import { LogoutUseCase } from '../application/logout.use-case';
import { RefreshTokenUseCase } from '../application/refresh-token.use-case';
import { RequestPasswordResetUseCase } from '../application/request-password-reset.use-case';
import { ResetPasswordUseCase } from '../application/reset-password.use-case';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';

/**
 * Endpoints de autenticação e conta (ver docs/api.md §14 e docs/security.md §2).
 * Rota base: /api/v1/auth
 */
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly login: LoginUseCase,
    private readonly refresh: RefreshTokenUseCase,
    private readonly logout: LogoutUseCase,
    private readonly getProfile: GetProfileUseCase,
    private readonly changePassword: ChangePasswordUseCase,
    private readonly requestReset: RequestPasswordResetUseCase,
    private readonly resetPassword: ResetPasswordUseCase,
  ) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  loginHandler(@Body() dto: LoginDto): Promise<LoginResponse> {
    return this.login.execute(dto);
  }

  @Post('refresh')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  refreshHandler(@Body() dto: RefreshDto): Promise<AuthTokens> {
    return this.refresh.execute(dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutHandler(@Body() dto: RefreshDto): Promise<void> {
    await this.logout.execute(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ResourceResponse<AuthenticatedUser>> {
    const data = await this.getProfile.execute(user.id);
    return { data };
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePasswordHandler(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.changePassword.execute({
      tenantId: user.tenantId,
      userId: user.id,
      currentPassword: dto.currentPassword,
      newPassword: dto.newPassword,
    });
  }

  @Post('forgot-password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  forgotPasswordHandler(@Body() dto: ForgotPasswordDto): Promise<ForgotPasswordResponse> {
    return this.requestReset.execute(dto);
  }

  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPasswordHandler(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.resetPassword.execute(dto);
  }
}
