# Auditoria técnica — Fase 0 (Fundação)

> **Status:** Concluída · **Data:** 2026-07-05 · **Autor:** CTO/Arquitetura
> **Escopo:** estrutura base do monorepo (backend, frontend, infra, banco, auth inicial).
> Sem execução de features de negócio.

## 1. Resumo

A estrutura da Fase 0 está coerente com a documentação (`/docs`) e com as decisões (ADRs). A revisão estática encontrou **4 defeitos que impediriam compilar/executar** — todos já corrigidos — e um conjunto de melhorias classificadas por severidade para endereçar antes/durante a Fase 1.

**Observação de ambiente:** a validação de build (`npm install`, `nest build`, `next build`, `docker compose`) deve ser executada na máquina do desenvolvedor via `scripts/validate-phase0.sh`. O sandbox de revisão não tem acesso ao registro npm nem a um daemon Docker; por isso a verificação aqui foi **estática** (JSON/YAML válidos, resolução de imports, revisão de tipos/DI).

## 2. Defeitos corrigidos (bloqueadores de build/run)

| # | Severidade | Problema | Correção |
|---|-----------|----------|----------|
| 1 | Alta | `uuid@^9` não exporta `v7` (usado em `shared/kernel/id.ts`); só a partir do `uuid@10`. | Bump para `uuid@^10` e `@types/uuid@^10`. |
| 2 | Alta | `pino-pretty` referenciado no transport de dev do logger, mas ausente das dependências → crash no `start:dev`. | Adicionado `pino-pretty` como devDependency. |
| 3 | Média | Script `test:e2e` apontava para `test/jest-e2e.json` inexistente. | Script removido; e2e será introduzido na Fase 1 com a config. |
| 4 | **Crítica** | `FORCE ROW LEVEL SECURITY` em `users` sem o wiring de `app.current_tenant` faria o login **não retornar nenhum usuário** (app inoperante). | Fase 0 usa `ENABLE` (sem `FORCE`); política criada e documentado o caminho de enforcement real. |

## 3. Achados por categoria (melhorias)

Severidade: 🔴 alta · 🟠 média · 🟡 baixa.

### 3.1 Arquitetura

- 🟠 **Wiring de tenant/RLS pendente.** O `TenantContext` (AsyncLocalStorage) existe, mas falta o interceptor que o popula a partir do JWT e o provider de transação que executa `SET app.current_tenant`. **Sem isso, RLS não protege nada.** Ação (início da Fase 1): implementar o interceptor + rodar a app sob um **role não-owner** e então `FORCE` a RLS.
- 🟠 **Outbox/audit sem relay nem escrita.** As tabelas `outbox` e `audit_log` existem, mas não há publisher/relay nem interceptor de auditoria. Implementar o relay (worker) e um interceptor que grava eventos de auth no `audit_log` — barato agora, alto valor de conformidade.
- 🟡 **Aliases de path (`@shared/*`, `@modules/*`) definidos e não usados.** Ou adotar nos imports (melhora legibilidade) ou remover para evitar confusão. Se adotar, incluir `tsconfig-paths`/`tsc-alias` no build.
- 🟡 **Sem camada de mapeamento explícita (mapper) domínio↔ORM.** Hoje a conversão é feita inline nos repositórios. Aceitável no MVP; extrair `mappers` quando os agregados crescerem.

### 3.2 Segurança

- 🔴 **Access token com segredo simétrico (HS256).** Aceitável em dev; **produção deve usar RS256/ES256** com chave no KMS (já sinalizado no código). Ação: suportar par de chaves e `JWKS` antes de expor externamente.
- 🟠 **`ENCRYPTION_KEK` configurada mas sem serviço de criptografia.** Implementar o serviço de envelope encryption (DEK por tenant — ADR-0010) quando o primeiro dado PII for persistido; hoje não há PII, então não é bloqueador.
- 🟠 **Sem rate limiting/броtel.** `helmet` e CORS estão ativos, mas falta `@nestjs/throttler` (login é alvo de força bruta). Adicionar throttler global + limite específico no `/auth/login`.
- 🟠 **Sem limpeza de refresh tokens expirados.** A tabela cresce indefinidamente. Adicionar job periódico de expurgo (ou índice + retenção).
- 🟡 **Segredos mínimos de 16 chars no schema.** Endurecer para produção (comprimento/entropia) e mover para secret manager.

### 3.3 Escalabilidade

- 🟠 **PgBouncer em modo transaction + prepared statements.** O driver `pg` usa statements não-nomeados por padrão (compatível), mas confirmar que o TypeORM não habilita prepared nomeados. Recomendo teste de carga e, se necessário, `poolSize`/`statement_timeout` explícitos.
- 🟡 **Health check só cobre o banco.** Quando o Redis for integrado, adicionar `RedisHealthIndicator` ao `/health/ready`.
- 🟡 **Pool fixo `max: 20` por instância.** Parametrizar por env e dimensionar junto ao `DEFAULT_POOL_SIZE` do PgBouncer ao escalar horizontalmente.

### 3.4 Performance

- 🟡 **Parâmetros do Argon2id no padrão.** Ajustar `memoryCost`/`timeCost` conforme benchmark do hardware de produção (equilíbrio segurança × latência de login).
- 🟡 **Logger `pino-pretty` só em dev** (correto). Garantir que produção use saída JSON pura (já condicionado a `NODE_ENV`).

### 3.5 Organização e DevEx

- 🟠 **Lockfile ausente.** O CI usa `npm ci` (exige `package-lock.json`). Gerar e **commitar** o lockfile no primeiro `npm install`.
- 🟡 **Sem `test/` e2e nem cobertura mínima aplicada.** Definir gate de cobertura (≥80% domínio/aplicação — `coding-standards.md`) no CI quando houver mais casos.
- 🟡 **Sem CODEOWNERS/PR template/branch protection.** Configurar no repositório Git para reforçar revisão (processo, não código).

## 4. O que foi adicionado nesta rodada

- Correção dos 4 defeitos bloqueadores (seção 2).
- **CI** (`.github/workflows/ci.yml`): install → build contracts → lint → typecheck → test → migração (smoke) → build apps, com serviço Postgres.
- **`scripts/validate-phase0.sh`**: validação local ponta a ponta.
- **`.editorconfig`** para consistência de formatação.

## 5. Veredito

**Fase 0 aprovada condicionalmente.** A base é sólida e alinhada aos ADRs. Condição para iniciar a Fase 1: (a) o desenvolvedor rodar `scripts/validate-phase0.sh` na máquina e confirmar build/migração verdes; (b) commitar o lockfile. As melhorias 🔴/🟠 de segurança e o wiring de tenant/RLS devem ser as **primeiras tarefas da Fase 1**, antes de qualquer endpoint de negócio persistir dados de tenant.

## 6. Backlog priorizado para a Fase 1 (pré-negócio)

1. Interceptor de `TenantContext` + `SET app.current_tenant` por transação + role não-owner + `FORCE` RLS.
2. `@nestjs/throttler` (global + login).
3. Relay do outbox + interceptor de `audit_log` para eventos de auth.
4. Job de expurgo de refresh tokens expirados.
5. Chaves assimétricas (RS256) para access token.
6. Redis integrado + health indicator.

---

### Histórico

| Data | Versão | Autor | Mudança |
|------|--------|-------|---------|
| 2026-07-05 | 1.0 | CTO/Arquitetura | Auditoria inicial da Fase 0 |
