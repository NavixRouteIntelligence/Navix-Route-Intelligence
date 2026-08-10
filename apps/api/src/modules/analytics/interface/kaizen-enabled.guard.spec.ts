import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { NotFoundException, type ExecutionContext } from '@nestjs/common';

import type { AppConfigService } from '../../../shared/config/app-config.service';
import type { TenantAccountTypeReaderPort } from '../../../shared/tenancy/tenant-account-type.port';

import { KaizenEnabledGuard } from './kaizen-enabled.guard';

function contexto(user?: { tenantId: string }): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function guard(rollout: 'off' | 'autonomous' | 'all', conta: 'driver' | 'company' = 'driver') {
  const config = { kaizenRollout: rollout } as AppConfigService;
  const contas: TenantAccountTypeReaderPort = { findAccountType: async () => conta };
  return new KaizenEnabledGuard(config, contas);
}

describe('KaizenEnabledGuard', () => {
  // 404 e não 403: «não é para si» convida a insistir; «não está aqui» é a
  // verdade enquanto a funcionalidade está desligada.
  it('desligado responde 404, não 403', async () => {
    await expect(guard('off').canActivate(contexto({ tenantId: 't1' }))).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('em `all`, qualquer motorista passa', async () => {
    await expect(guard('all', 'company').canActivate(contexto({ tenantId: 't1' }))).resolves.toBe(
      true,
    );
  });

  it('em `autonomous`, a conta de motorista passa', async () => {
    await expect(
      guard('autonomous', 'driver').canActivate(contexto({ tenantId: 't1' })),
    ).resolves.toBe(true);
  });

  // Um motorista de frota recebe 404, não um resumo vazio — que seria uma
  // promessa por cumprir.
  it('em `autonomous`, a conta de empresa não vê a funcionalidade', async () => {
    await expect(
      guard('autonomous', 'company').canActivate(contexto({ tenantId: 't1' })),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sem utilizador no pedido, não expõe', async () => {
    await expect(guard('autonomous').canActivate(contexto())).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

/**
 * O critério de aceite da T7.9: desligar o Kaizen não pode afetar rotas,
 * entregas nem login. A garantia é estrutural — o interruptor está **só** no
 * controlador do Kaizen, e o módulo não escreve em tabela de negócio nenhuma.
 */
describe('o interruptor é local ao Kaizen', () => {
  const raizModulos = join(__dirname, '..', '..');

  function ficheirosDeInterface(): string[] {
    const encontrados: string[] = [];
    const percorrer = (dir: string): void => {
      for (const entrada of readdirSync(dir, { withFileTypes: true })) {
        const caminho = join(dir, entrada.name);
        if (entrada.isDirectory()) percorrer(caminho);
        else if (entrada.name.endsWith('.controller.ts')) encontrados.push(caminho);
      }
    };
    percorrer(raizModulos);
    return encontrados;
  }

  it('nenhum controlador fora do Kaizen usa o guarda', () => {
    const comGuarda = ficheirosDeInterface().filter((f) =>
      readFileSync(f, 'utf8').includes('KaizenEnabledGuard'),
    );

    expect(comGuarda.map((f) => f.split('/').pop())).toEqual(['kaizen.controller.ts']);
  });

  // Se o módulo escrevesse em `deliveries` ou `route_plans`, desligá-lo mudaria
  // o comportamento delas — e o interruptor deixaria de ser seguro.
  it('o módulo do Kaizen não escreve em tabelas de negócio', () => {
    const raiz = join(raizModulos, 'analytics');
    const escritas: string[] = [];
    const percorrer = (dir: string): void => {
      for (const entrada of readdirSync(dir, { withFileTypes: true })) {
        const caminho = join(dir, entrada.name);
        if (entrada.isDirectory()) percorrer(caminho);
        else if (entrada.name.endsWith('.ts') && !entrada.name.endsWith('.spec.ts')) {
          const fonte = readFileSync(caminho, 'utf8');
          if (
            /(INSERT INTO|UPDATE|DELETE FROM)\s+(deliveries|route_plans|users|drivers)\b/i.test(
              fonte,
            )
          ) {
            escritas.push(caminho);
          }
        }
      }
    };
    percorrer(raiz);

    expect(escritas).toEqual([]);
  });
});
