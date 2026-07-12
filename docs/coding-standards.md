# Padrões de código — Navix Route Intelligence

> **Status:** Em revisão · **Versão:** 0.2 · **Atualizado:** 2026-07-05

Regras de engenharia para manter o código limpo, modular, seguro e escalável. Consistência acima de preferência pessoal.

## 1. Linguagem e configuração

- **TypeScript** em modo `strict` (sem `any` implícito, `strictNullChecks` on).
- Proibido `any` sem justificativa; preferir tipos precisos, `unknown` e *type guards*.
- Sem `// @ts-ignore` sem comentário justificando.
- Config de compilador e paths centralizados; imports absolutos via alias.

## 2. Princípios

- **SOLID** aplicado de forma pragmática:
  - **S** — cada classe/módulo com uma responsabilidade.
  - **O** — extensível sem modificar o núcleo (estratégias, injeção).
  - **L** — subtipos substituíveis sem quebrar contratos.
  - **I** — interfaces pequenas e específicas.
  - **D** — depender de abstrações (ports), não de implementações.
- **DRY** — sem código duplicado; extrair para o `shared/kernel` quando reutilizável.
- **KISS / YAGNI** — solução mais simples que resolve; não antecipar complexidade.
- **Clean Architecture** — respeitar a regra de dependência (ver [architecture.md](./architecture.md)).

## 3. Organização

- Um artefato por arquivo; nomes descritivos.
- Domínio livre de dependências de framework.
- Casos de uso finos, orquestrando domínio + ports.
- Nada de lógica de negócio em controllers.
- **Fronteira de módulos (inegociável):** um módulo não importa internals de outro nem acessa suas tabelas — só *ports* públicas e eventos. Reforçado por **lint de dependências** no CI (`eslint-plugin-boundaries`, em `apps/api/.eslintrc.cjs`). **Nota de estado:** o lint hoje bloqueia violações **entre camadas** (domain → application/infra/interface); o **isolamento entre módulos de negócio** ainda é mantido por convenção + gateways anti-corrupção — a regra de lint por módulo é um endurecimento pendente (ver [architecture.md](./architecture.md) §4).
- Publicação de eventos **sempre via outbox** (ADR-0006), nunca publicação direta pós-commit.
- Mudanças de comportamento arriscadas ficam atrás de **feature flags**.

## 4. Nomenclatura

| Elemento | Convenção | Exemplo |
|----------|-----------|---------|
| Arquivos | `kebab-case` | `plan-routes.use-case.ts` |
| Classes / Tipos / Interfaces | `PascalCase` | `RoutePlan`, `RouteRepository` |
| Variáveis / funções | `camelCase` | `optimizeRoute` |
| Constantes | `UPPER_SNAKE_CASE` | `MAX_PAGE_SIZE` |
| Enums | `PascalCase` (membros também) | `DeliveryStatus.Planned` |

- Sufixos por papel: `.use-case.ts`, `.repository.ts`, `.controller.ts`, `.entity.ts`, `.dto.ts`, `.mapper.ts`.
- Nomes refletem a **linguagem ubíqua** do domínio (DDD).

## 5. Tratamento de erros

- Erros de domínio explícitos (classes/`Result`), não strings soltas.
- Distinguir erro esperado (validação/negócio) de inesperado (bug/infra).
- Nunca engolir exceções; logar com contexto (`tenant_id`, `request_id`).
- Erros de API padronizados (ver [api.md](./api.md)); sem vazamento de detalhes internos.

## 6. Assíncrono

- `async/await` sempre; evitar `.then` encadeado.
- Tratar rejeições; nada de *promise* solta.
- Consumidores de fila **idempotentes**, com retry/backoff (ver [architecture.md](./architecture.md)).

## 7. Testes

- **Pirâmide de testes:** muitos unitários, integração por módulo, poucos e2e.
- Domínio testado isolado de infraestrutura.
- Casos de segurança e **isolamento de tenant** testados explicitamente.
- Nomes de teste descritivos (dado/quando/então).
- **Meta de cobertura:** ≥ 80% no domínio e aplicação (ajustável por ADR).
- Sem lógica condicional complexa nos testes; um comportamento por teste.
- Testes determinísticos (sem dependência de rede/tempo real — usar fakes/clocks).

## 8. Qualidade automatizada

- **ESLint** + **Prettier** obrigatórios; pipeline falha em violação.
- **Type-check** no CI.
- **SAST/SCA** (ver [security.md](./security.md)).
- Sem *warnings* ignorados silenciosamente.

## 9. Git e commits

- **Conventional Commits**: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`, `perf:`, `sec:`.
- Branches: `feat/…`, `fix/…`, `chore/…`.
- Main protegida; merge via PR com revisão.
- PRs pequenos e focados; descrição com contexto e impacto.

## 10. Code review — checklist

- [ ] Respeita a arquitetura e a regra de dependência.
- [ ] Sem duplicação; abstrações no lugar certo.
- [ ] Nomes claros e alinhados ao domínio.
- [ ] Entrada validada; autorização e tenant verificados.
- [ ] Erros tratados e padronizados.
- [ ] Testes cobrindo caminhos felizes e de falha.
- [ ] Sem segredos, sem dados sensíveis em logs.
- [ ] Documentação atualizada quando necessário.

## 11. Documentação no código

- Código autoexplicativo; comentar o **porquê**, não o **o quê**.
- APIs públicas com TSDoc quando agregar valor.
- Decisões relevantes viram ADR em [decisions.md](./decisions.md).

## 12. Performance e escalabilidade

- Evitar N+1; medir antes de otimizar.
- Paginar toda listagem (ver [api.md](./api.md)).
- Operações pesadas em workers/filas, não no request.
- Cache com invalidação clara (ver [database.md](./database.md)).

---

### Histórico

| Data | Versão | Autor | Mudança |
|------|--------|-------|---------|
| 2026-07-05 | 0.1 | Engenharia | Estrutura inicial |
| 2026-07-05 | 0.2 | CTO | Regra de fronteira de módulos (lint), eventos via outbox, feature flags |
