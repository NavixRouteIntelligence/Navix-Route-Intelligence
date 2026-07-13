import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type {
  AccessToken,
  AuthenticatedUser,
  ForgotPasswordResponse,
  ResourceResponse,
  WebAuthResponse,
  WebRegisterResponse,
} from '@navix/contracts';
import type { Request, Response } from 'express';

import { AppConfigService } from '../../../shared/config/app-config.service';
import { UnauthorizedError } from '../../../shared/kernel/domain-error';
import { CurrentUser } from '../../../shared/interface/current-user.decorator';
import { JwtAuthGuard } from '../../../shared/security/jwt-auth.guard';
import {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
  type RefreshCookieConfig,
} from './auth-cookie';
import { ChangePasswordUseCase } from '../application/change-password.use-case';
import { GetProfileUseCase } from '../application/get-profile.use-case';
import { LoginUseCase } from '../application/login.use-case';
import { LogoutUseCase } from '../application/logout.use-case';
import { RefreshTokenUseCase } from '../application/refresh-token.use-case';
import { RegisterUseCase } from '../application/register.use-case';
import { RequestPasswordResetUseCase } from '../application/request-password-reset.use-case';
import { ResetPasswordUseCase } from '../application/reset-password.use-case';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

/**
 * Endpoints de autenticação e conta do cliente **WEB** (ver docs/api.md §14 e
 * docs/security.md §2). Rota base: `/api/v1/auth`.
 *
 * Modelo **cookie**: o refresh token é entregue e lido via **cookie HttpOnly**;
 * o corpo das respostas nunca o expõe. Clientes **mobile** usam os endpoints
 * dedicados em `/api/v1/auth/mobile` (bearer token no corpo — ver ADR-0015).
 * Endpoints de conta (`me`, `change-password`, `forgot/reset-password`) são
 * compartilhados: dependem do access token, não da forma de entrega do refresh.
 */
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly config: AppConfigService,
    private readonly login: LoginUseCase,
    private readonly register: RegisterUseCase,
    private readonly refresh: RefreshTokenUseCase,
    private readonly logout: LogoutUseCase,
    private readonly getProfile: GetProfileUseCase,
    private readonly changePassword: ChangePasswordUseCase,
    private readonly requestReset: RequestPasswordResetUseCase,
    private readonly resetPassword: ResetPasswordUseCase,
  ) {}

  /** Config do cookie de refresh (Secure em produção; SameSite=lax). */
  private cookieConfig(): RefreshCookieConfig {
    return {
      secure: this.config.isProduction,
      sameSite: 'lax',
      maxAgeSeconds: this.config.jwt.refreshTtl,
    };
  }

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  async registerHandler(
    @Res({ passthrough: true }) res: Response,
    @Body() dto: RegisterDto,
  ): Promise<WebRegisterResponse> {
    const { user, tokens, accountType } = await this.register.execute(dto);
    setRefreshCookie(res, tokens.refreshToken, this.cookieConfig());
    return {
      user,
      tokens: { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn },
      accountType,
    };
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async loginHandler(
    @Res({ passthrough: true }) res: Response,
    @Body() dto: LoginDto,
  ): Promise<WebAuthResponse> {
    const { user, tokens } = await this.login.execute(dto);
    setRefreshCookie(res, tokens.refreshToken, this.cookieConfig());
    return { user, tokens: { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn } };
  }

  @Post('refresh')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async refreshHandler(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AccessToken> {
    // Web: o refresh token vem SOMENTE do cookie HttpOnly (sem corpo, sem header).
    const presented = readRefreshCookie(req);
    if (!presented) throw new UnauthorizedError('Sessão inválida.');

    const tokens = await this.refresh.execute(presented);
    setRefreshCookie(res, tokens.refreshToken, this.cookieConfig());
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutHandler(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const presented = readRefreshCookie(req);
    if (presented) await this.logout.execute(presented);
    clearRefreshCookie(res, this.cookieConfig());
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
