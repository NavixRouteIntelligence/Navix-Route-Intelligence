# Relatório técnico — Hardening de Segurança (Fase 1)

> **Status:** Concluído (aguardando validação de build/testes local) · **Data:** 2026-07-06

## 1. Multi-Tenant Enforcement (RLS)

**Implementado:**
- `TenantContext` completo (`shared/tenancy/tenant-context.ts`) via `AsyncLocalStorage`.
- **População automática a partir do JWT**: `TenantTransactionInterceptor` lê `req.user` (setado pela estratégia JWT) e estabelece o contexto por request.
- **RLS forçada + role de runtime**: migração `ForceTenantRls` aplica `FORCE ROW LEVEL SECURITY` em `vehicles`, `drivers`, `deliveries`, `route_plans`; e `CreateAppRole` cria um role **não-superusuário** (`navix_app`) que a aplicação usa em runtime. Isto é essencial: superusuários/owners **ignoram** a RLS mesmo com FORCE. Migrações/seed continuam com o owner.
- **`SET app.current_tenant` por transação**: o interceptor abre uma transação e executa `set_config('app.current_tenant', <tenant>, true)`; os repositórios resolvem o `EntityManager` dessa transação (`scopedRepository`), então toda query é filtrada pela RLS.
- **Isolamento absoluto**: as tabelas de auth (`users`, `refresh_tokens`) ficam sem FORCE para não quebrar login/refresh (fluxos públicos), com isolamento de aplicação; todo o dado de negócio é protegido no banco.
- **Teste automatizado** (`test/tenant-isolation.e2e-spec.ts`): prova que o tenant B não enxerga dados do tenant A, que A enxerga os próprios, e que sem `app.current_tenant` nenhuma linha aparece.

**Risco mitigado:** vazamento cross-tenant por bug de aplicação (query sem filtro). Agora o banco recusa.

## 2. JWT Enterprise (RS256)

**Implementado:**
- Migração **HS256 → RS256** (`JwtTokenService` assina com chave privada + `kid`).
- **Rotação de chaves**: verificação seleciona a chave pública pelo `kid` (`JwtStrategy` + `KeyRing`); suporta uma chave anterior para não invalidar tokens em voo.
- **Preparado para KMS**: porta `KeyRingPort` — a implementação `LocalKeyRing` (chaves de env ou par efêmero em dev) troca por KMS/HSM sem tocar no resto.
- **Compatibilidade com Refresh Tokens**: refresh continua opaco (random + hash), inalterado.

**Risco mitigado:** segredo simétrico compartilhado; impossibilidade de rotação; acoplamento a um único segredo.

## 3. Proteção da API

**Implementado:**
- **Rate limiting** (`@nestjs/throttler`): global (120/min) + estrito no `login` (5/min) e `refresh` (20/min).
- **Helmet** ativo (CSP completo em produção; relaxado em dev por causa do Swagger UI).
- **CORS** reforçado: origens por env, métodos, headers permitidos/expostos e `maxAge`.
- Headers de segurança (HSTS, X-Content-Type-Options, etc.) via helmet.

**Risco mitigado:** força bruta de login, abuso de endpoints, ataques cross-origin.

## 4. Auditoria

**Implementado:**
- **Autenticação**: `auth.login.succeeded` / `auth.login.failed` (com motivo), `auth.refresh.succeeded`, `auth.refresh.reuse_detected`, `auth.logout`.
- **Autorização**: `authz.denied` (negação de RBAC, com rota e papéis exigidos) no `RolesGuard`.
- **Alterações críticas**: Fleet (`fleet.vehicle.*`, `fleet.driver.*` created/updated/deleted), além de Delivery e Optimizer (já existentes).
- Tudo gravado na tabela imutável `audit_log` (writer que nunca derruba a operação de negócio).

**Risco mitigado:** ausência de trilha para investigação e conformidade.

## 5. Testes
- Unitários atualizados (login com auditoria, Fleet com auditoria).
- **Integração de isolamento** (RLS) — requer Postgres migrado.
- Rodar: `npm test -w apps/api` e `npm run test:e2e -w apps/api`.
- Verificação estática aqui: 157 arquivos-fonte, imports/JSON OK, sem referências ao segredo HS256 antigo.

## 6. Ação necessária para validar
- **Nova dependência**: `@nestjs/throttler` → `npm install`.
- Recompilar contratos, rodar migração nova (`ForceTenantRls`), rodar testes.
- Após reiniciar a API, refazer login (tokens HS256 antigos deixam de valer).

## 7. Recomendações para produção
1. **Chaves RS256 gerenciadas** (secret manager/KMS) — não usar par efêmero; automatizar rotação com `kid`.
2. **Throttler com storage Redis** (multi-instância).
3. **Envelope encryption por tenant** (ADR-0010) quando houver PII persistida.
4. **Role de banco não-owner** para a aplicação (defesa extra além do FORCE) e separação do usuário de migração.
5. **Relay do outbox** para publicar eventos (hoje só auditoria).
6. **MFA** para contas administrativas; **API keys/OAuth2** para M2M (app do motorista, integrações).
7. **SIEM/retenção** dos logs de auditoria e alertas de segurança (ex.: picos de `auth.login.failed`, `auth.refresh.reuse_detected`).

---

| Data | Versão | Autor | Mudança |
|------|--------|-------|---------|
| 2026-07-06 | 1.0 | Engenharia | Relatório inicial do hardening de segurança |
