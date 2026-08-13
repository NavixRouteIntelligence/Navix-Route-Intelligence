import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '@navix/contracts';

import { AppConfigService } from '../../../shared/config/app-config.service';
import {
  TENANT_ACCOUNT_TYPE_READER,
  type TenantAccountTypeReaderPort,
} from '../../../shared/tenancy/tenant-account-type.port';
import { isInRollout } from '../../../shared/rollout/rollout';

/**
 * Interruptor do Kaizen (ADR-0123).
 *
 * ## O que desligar significa
 *
 * `KAIZEN_ROLLOUT=off` faz os endpoints do Kaizen responderem **404** — não 403.
 * A diferença importa: 403 diz «existe e não é para si», e convida a insistir;
 * 404 diz que a rota não está lá, que é a verdade enquanto a funcionalidade
 * está desligada.
 *
 * ## O que desligar NÃO toca
 *
 * Nada fora deste controlador. O Kaizen é um módulo de **leitura** que não
 * escreve em `deliveries`, `route_plans` nem em nada da identidade — e é por
 * isso que o interruptor pode ser um guarda de rota em vez de uma cascata de
 * `if`s espalhados. Rota, entregas e login não sabem que ele existe.
 *
 * ## O recorte do piloto
 *
 * `autonomous` limita a quem a frente foi desenhada: contas de tipo `driver`,
 * onde o tenant é a pessoa (ADR-0116). Um motorista de frota com a mesma app
 * recebe 404 — não um resumo vazio, que seria uma promessa por cumprir.
 *
 * Dentro do alcance escolhido, `KAIZEN_ROLLOUT_PERCENT` recorta uma amostra
 * **determinística por utilizador** (ADR-0124): quem entra continua dentro
 * enquanto a percentagem não baixar. Um sorteio por pedido daria a mesma pessoa
 * a funcionalidade num pedido e não no seguinte, que parece avaria, não piloto.
 */
@Injectable()
export class KaizenEnabledGuard implements CanActivate {
  constructor(
    private readonly config: AppConfigService,
    @Inject(TENANT_ACCOUNT_TYPE_READER) private readonly contas: TenantAccountTypeReaderPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rollout = this.config.kaizenRollout;
    if (rollout === 'off') throw new NotFoundException();

    const user = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user;
    // Sem utilizador o guarda de autenticação já terá recusado; aqui a ausência
    // só pode significar rota mal montada, e o seguro é não expor.
    if (!user) throw new NotFoundException();

    if (rollout === 'autonomous') {
      const conta = await this.contas.findAccountType(user.tenantId);
      if (conta !== 'driver') throw new NotFoundException();
    }

    // A amostra é o último filtro: primeiro decide-se **quem pode**, depois
    // **quantos por agora**. Invertido, uma conta fora do público entraria na
    // amostra e ocuparia um lugar que não lhe pertence.
    if (!isInRollout(user.id, this.config.kaizenRolloutPercent)) throw new NotFoundException();
    return true;
  }
}
