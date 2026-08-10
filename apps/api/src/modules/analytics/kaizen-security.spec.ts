import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Revisão de segurança do Kaizen, executável (ADR-0124).
 *
 * A T7.9 pedia «revisão de linguagem e segurança antes do merge». A de
 * linguagem já é um teste desde a #133; esta é a de segurança — e é um teste
 * pela mesma razão: uma revisão que depende de alguém se lembrar de olhar
 * falha exatamente no dia em que ninguém olha.
 *
 * Não substitui SAST nem pentest. Guarda as invariantes **desta frente**, que
 * um scanner genérico não conhece: o resumo é de uma pessoa, e há maneiras
 * específicas de o vazar.
 */
const RAIZ = __dirname;

function ficheiros(dir: string, filtro: (nome: string) => boolean): string[] {
  const encontrados: string[] = [];
  const percorrer = (atual: string): void => {
    for (const entrada of readdirSync(atual, { withFileTypes: true })) {
      const caminho = join(atual, entrada.name);
      if (entrada.isDirectory()) percorrer(caminho);
      else if (filtro(entrada.name)) encontrados.push(caminho);
    }
  };
  percorrer(dir);
  return encontrados;
}

const fonte = (f: string): string => readFileSync(f, 'utf8');

describe('segurança do Kaizen — superfície', () => {
  const controlador = join(RAIZ, 'interface', 'kaizen.controller.ts');

  it('todas as rotas exigem autenticação, papel e o interruptor', () => {
    const src = fonte(controlador);

    expect(src).toContain('JwtAuthGuard');
    expect(src).toContain('RolesGuard');
    expect(src).toContain('KaizenEnabledGuard');
  });

  it('todo método exposto é restrito ao papel `driver`', () => {
    const src = fonte(controlador);
    const rotas = src.match(/@(Get|Post|Put|Patch|Delete)\(/g) ?? [];
    const papeis = src.match(/@Roles\('driver'\)/g) ?? [];

    expect(rotas).toHaveLength(papeis.length);
  });

  // A ausência de superfície é a garantia desta frente: sem rota que aceite o
  // id de outra pessoa, não há como pedir o resumo alheio.
  it('nenhuma rota aceita identificador de outro utilizador', () => {
    const src = fonte(controlador);

    expect(src).not.toMatch(/@Param\(\s*'(driverId|userId|tenantId)'/);
    expect(src).not.toMatch(/@Query\(\s*'(driverId|userId|tenantId)'/);
    expect(src).toMatch(/@CurrentUser\(\)/);
  });

  it('o tenant e o utilizador vêm sempre do token', () => {
    const src = fonte(controlador);
    const chamadas = src.match(/\.execute\([^)]*\)/gs) ?? [];

    for (const chamada of chamadas) {
      if (!chamada.includes('tenantId') && !chamada.includes('user.tenantId')) continue;
      expect(chamada).toContain('user.');
    }
  });
});

describe('segurança do Kaizen — dados', () => {
  it('as métricas não têm rótulo que identifique alguém', () => {
    const metricas = fonte(join(RAIZ, 'infrastructure', 'observability', 'kaizen-metrics.ts'));
    const rotulos = [...metricas.matchAll(/labelNames:\s*\[([^\]]*)\]/g)].flatMap((m) =>
      m[1].split(',').map((s) => s.trim().replace(/['"]/g, '')),
    );

    for (const rotulo of rotulos.filter(Boolean)) {
      expect(['user', 'userId', 'tenant', 'tenantId', 'email', 'driver', 'day']).not.toContain(
        rotulo,
      );
    }
  });

  // Texto livre num campo que a empresa lê é outra promessa (ADR-0121).
  it('o feedback não aceita texto livre', () => {
    const dto = fonte(join(RAIZ, 'interface', 'dto', 'kaizen-feedback.dto.ts'));

    expect(dto).toContain('@IsIn(');
    // `code` é a única string sem enum, e é uma chave do próprio motor.
    const livres = [...dto.matchAll(/@IsString\(\)/g)];
    expect(livres).toHaveLength(1);
  });

  it('a auditoria não copia métrica nenhuma para o log', () => {
    const src = fonte(join(RAIZ, 'interface', 'kaizen.controller.ts'));
    const metadados = [...src.matchAll(/metadata:\s*\{([^}]*)\}/g)].map((m) => m[1]);

    for (const meta of metadados) {
      expect(meta).not.toMatch(/delivered|failed|onTime|activeMinutes|savedKm/);
    }
  });

  // As tabelas do Kaizen têm de estar sob RLS forçada, como todas as outras.
  it('as migrações do Kaizen forçam RLS e criam política de tenant', () => {
    const migracoes = ficheiros(
      join(RAIZ, '..', '..', 'database', 'migrations'),
      (n) => n.includes('Kaizen') || n.includes('DriverDailySubject'),
    );
    expect(migracoes.length).toBeGreaterThan(0);

    for (const m of migracoes) {
      const src = fonte(m);
      if (!src.includes('CREATE TABLE')) continue;
      expect(src).toContain('FORCE ROW LEVEL SECURITY');
      expect(src).toContain('CREATE POLICY tenant_isolation');
    }
  });
});

describe('segurança do Kaizen — raio de alcance', () => {
  // Repetido de propósito a partir do guarda: é a invariante que torna o
  // rollback seguro, e vale tê-la também na revisão de segurança.
  it('o módulo não escreve em tabela de negócio nenhuma', () => {
    const escritas = ficheiros(RAIZ, (n) => n.endsWith('.ts') && !n.endsWith('.spec.ts')).filter(
      (f) =>
        /(INSERT INTO|UPDATE|DELETE FROM)\s+(deliveries|route_plans|users|drivers|tenants)\b/i.test(
          fonte(f),
        ),
    );

    expect(escritas).toEqual([]);
  });

  it('o módulo não lê segredo nem token', () => {
    const suspeitos = ficheiros(RAIZ, (n) => n.endsWith('.ts') && !n.endsWith('.spec.ts')).filter(
      (f) => /(refresh_tokens|password_hash|JWT_PRIVATE_KEY|api_keys)/i.test(fonte(f)),
    );

    expect(suspeitos).toEqual([]);
  });
});
