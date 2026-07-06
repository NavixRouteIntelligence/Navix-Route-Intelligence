import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthTokens, LoginResponse } from '@navix/contracts';

import { JwtAuthGuard } from '../../../shared/security/jwt-auth.guard';
import { LoginUseCase } from '../application/login.use-case';
import { LogoutUseCase } from '../application/logout.use-case';
import { RefreshTokenUseCase } from '../application/refresh-token.use-case';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';

/**
 * Endpoints de autenticação (ver docs/api.md §14 e docs/security.md §2).
 * Rota base: /api/v1/auth
 */
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly login: LoginUseCase,
    private readonly refresh: RefreshTokenUseCase,
    private readonly logout: LogoutUseCase,
  ) {}

  // Limites estritos contra força bruta/abuso (ver docs/security.md §7).
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
}
