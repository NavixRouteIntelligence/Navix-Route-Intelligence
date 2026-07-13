import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type {
  MobileAuthResponse,
  MobileRegisterResponse,
  SessionTokens,
} from '@navix/contracts';

import { LoginUseCase } from '../application/login.use-case';
import { LogoutUseCase } from '../application/logout.use-case';
import { RefreshTokenUseCase } from '../application/refresh-token.use-case';
import { RegisterUseCase } from '../application/register.use-case';
import { LoginDto } from './dto/login.dto';
import { MobileRefreshDto } from './dto/mobile-refresh.dto';
import { RegisterDto } from './dto/register.dto';

/**
 * Endpoints de autenticação do cliente **MOBILE** (Flutter). Rota base:
 * `/api/v1/auth/mobile`. Modelo **bearer token**: o refresh token trafega no
 * **corpo** (request e response) e é guardado em armazenamento seguro do
 * dispositivo — **sem cookie** e **sem dependência de header** (elimina o antigo
 * `X-Auth-Mode`). Ver ADR-0015 e docs/security.md §2.
 *
 * Reaproveita os mesmos casos de uso do fluxo web (`login`, `register`,
 * `refresh`, `logout`); muda apenas a forma de entrega dos tokens, mantendo web
 * e mobile totalmente desacoplados. Endpoints de conta (`me`, troca/reset de
 * senha) permanecem compartilhados em `/api/v1/auth` (usam o access token).
 */
@Controller({ path: 'auth/mobile', version: '1' })
export class MobileAuthController {
  constructor(
    private readonly login: LoginUseCase,
    private readonly register: RegisterUseCase,
    private readonly refresh: RefreshTokenUseCase,
    private readonly logout: LogoutUseCase,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  registerHandler(@Body() dto: RegisterDto): Promise<MobileRegisterResponse> {
    return this.register.execute(dto);
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  loginHandler(@Body() dto: LoginDto): Promise<MobileAuthResponse> {
    return this.login.execute(dto);
  }

  @Post('refresh')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  refreshHandler(@Body() dto: MobileRefreshDto): Promise<SessionTokens> {
    return this.refresh.execute(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutHandler(@Body() dto: MobileRefreshDto): Promise<void> {
    await this.logout.execute(dto.refreshToken);
  }
}
