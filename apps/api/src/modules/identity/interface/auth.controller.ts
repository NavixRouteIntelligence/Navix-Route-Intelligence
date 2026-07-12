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
  AuthenticatedUser,
  AuthTokens,
  ForgotPasswordResponse,
  LoginResponse,
  RegisterResponse,
  ResourceResponse,
} from '@navix/contracts';
import type { Request, Response } from 'express';

import { AppConfigService } from '../../../shared/config/app-config.service';
import { UnauthorizedError } from '../../../shared/kernel/domain-error';
import { CurrentUser } from '../../../shared/interface/current-user.decorator';
import { JwtAuthGuard } from '../../../shared/security/jwt-auth.guard';
import {
  clearRefreshCookie,
  isBearerMode,
  resolveRefreshToken,
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
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';

/**
 * Endpoints de autenticação e conta (ver docs/api.md §14 e docs/security.md §2).
 * Rota base: /api/v1/auth
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

  /**
   * Entrega a sessão: grava o refresh token no cookie HttpOnly e, salvo em modo
   * *bearer* (mobile), remove o refresh token do corpo da resposta (fluxo web).
   */
  private withSession<T extends { tokens: AuthTokens }>(
    req: Request,
    res: Response,
    payload: T,
  ): T {
    const { refreshToken } = payload.tokens;
    if (refreshToken) setRefreshCookie(res, refreshToken, this.cookieConfig());
    if (isBearerMode(req)) return payload;
    // Fluxo web: nunca expõe o refresh token no corpo (fica só no cookie).
    return {
      ...payload,
      tokens: { accessToken: payload.tokens.accessToken, expiresIn: payload.tokens.expiresIn },
    };
  }

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  async registerHandler(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: RegisterDto,
  ): Promise<RegisterResponse> {
    const result = await this.register.execute(dto);
    return this.withSession(req, res, result);
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async loginHandler(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: LoginDto,
  ): Promise<LoginResponse> {
    const result = await this.login.execute(dto);
    return this.withSession(req, res, result);
  }

  @Post('refresh')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async refreshHandler(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: RefreshDto,
  ): Promise<AuthTokens> {
    const presented = resolveRefreshToken(req, dto.refreshToken);
    if (!presented) throw new UnauthorizedError('Sessão inválida.');

    const tokens = await this.refresh.execute(presented);
    if (tokens.refreshToken) setRefreshCookie(res, tokens.refreshToken, this.cookieConfig());
    if (isBearerMode(req)) return tokens;
    // Fluxo web: só access token no corpo; o novo refresh token vai no cookie.
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutHandler(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: RefreshDto,
  ): Promise<void> {
    const presented = resolveRefreshToken(req, dto.refreshToken);
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
