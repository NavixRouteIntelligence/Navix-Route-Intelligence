# Segurança — Navix Route Intelligence

> **Status:** Em revisão · **Versão:** 0.4 · **Atualizado:** 2026-07-12

> **Estado de implementação — JÁ IMPLEMENTADO:** RLS forçada nas tabelas de
> negócio + interceptor de tenant por transação (ADR-0012); access token
> **RS256** com key ring e rotação (ADR-0013); senhas em **Argon2id**; refresh
> token hasheado, rotacionado e com **detecção de reuso**; **rate limiting**
> global + login/refresh estritos (ADR-0014); validação de entrada com whitelist;
> headers seguros (helmet), CORS restrito; erros sem vazamento de internals;
> trilha de auditoria (`audit_log`) de auth/authz e alterações críticas. Ver
> [reviews/hardening-report.md](./reviews/hardening-report.md).
>
> **AINDA NÃO IMPLEMENTADO (roadmap) — não presuma que estes controles existem:**
> criptografia em repouso / **envelope encryption por tenant** (ADR-0010) — a PII
> está em **texto puro**; **blacklist de tokens no Redis** e rate limiting em Redis
> (o storage atual é **em memória**, não compartilhado entre instâncias); **MFA**;
> **autenticação M2M** (OAuth2 / API keys — a tabela `api_keys` existe mas não há
> fluxo); **webhooks assinados por HMAC**; **SAST/SCA/DAST e secret scanning no CI**;
> imutabilidade do `audit_log` por *trigger* (hoje é append-only só por convenção);
> hardening de containers (usuário não-root). As seções abaixo descrevem a política
> **alvo**; itens não implementados estão marcados como ⬜.

Segurança é requisito de primeira classe, não uma etapa final. Nenhuma feature é considerada pronta sem atender a este documento. Novas ameaças ou decisões de segurança relevantes viram ADR em [decisions.md](./decisions.md).

## 1. Princípios

- **Secure by design & by default.**
- **Defesa em profundidade** — múltiplas camadas de controle.
- **Menor privilégio** em todo acesso (usuários, serviços, banco).
- **Zero trust** entre serviços e tenants.
- **Privacidade desde a concepção** (LGPD/GDPR).
- Falhas devem ser **seguras** (fail closed).

## 2. Autenticação

- **JWT (access token)** de curta duração + **Refresh Token** de longa duração.
- Access token: expiração curta (15 min), assinado com **RS256** (chave assimétrica do KeyRing, `kid` no cabeçalho para rotação — ADR-0013). Em dev, par efêmero é gerado no boot; em produção, chaves via secret manager/KMS.
- Refresh token: armazenado com **hash** no banco, rotacionado a cada uso (*refresh token rotation*) e revogável.
- **Entrega/armazenamento dos tokens (padrão de produção) — Web e Mobile são separados por endpoints dedicados (ADR-0015), sem acoplamento nem header de modo:**
  - **Web** (`/api/v1/auth/*`): access token **apenas em memória** (nunca em `localStorage`/`sessionStorage`); refresh token em **cookie `HttpOnly` + `Secure` (produção) + `SameSite=Lax`**, com `Path=/api/v1/auth`. O refresh token **nunca** aparece no corpo nem é acessível por JavaScript (mitiga XSS). Refresh em `401` e restauração de sessão usam o cookie (`credentials: 'include'`).
  - **Mobile** (`/api/v1/auth/mobile/*`): modelo **bearer token** — o refresh token trafega no **corpo** (request e response) e é guardado em **armazenamento seguro** do dispositivo. Sem cookie e **sem header especial**. Os dois fluxos reaproveitam os mesmos casos de uso; muda só a forma de entrega do refresh token.
  - **Endpoints de conta compartilhados** (`/auth/me`, `change-password`, `forgot/reset-password`): dependem do access token (Bearer), não da forma de entrega do refresh — servem web e mobile igualmente.
- Detecção de reuso de refresh token → revogar toda a família de tokens.
- Logout revoga o refresh token e **limpa o cookie** no servidor; blacklist de tokens no Redis quando necessário (⬜ roadmap).
- Senhas com **Argon2id** (ou bcrypt com custo adequado); nunca em texto claro.
- MFA previsto para contas administrativas (fase futura).

### 2.1 Autenticação máquina-a-máquina (M2M)

> **Status:** ⬜ **Planejado.** Não há autenticação M2M implementada. A tabela `api_keys` existe no schema, mas não há emissão/validação de API keys nem OAuth2 por dispositivo; o app do motorista usa o mesmo fluxo JWT dos demais usuários.

Usuários finais (app do motorista) e integrações não devem depender do fluxo de senha:

- **App do motorista / dispositivos:** OAuth2 + tokens de curta duração emitidos por dispositivo, revogáveis individualmente.
- **Integrações de terceiros (ERP, WMS):** **API keys** com escopo mínimo, armazenadas com **hash**, com `last_used_at` e rotação/revogação. Nunca logadas.
- **Webhooks de saída:** payload assinado com HMAC (ver [api.md](./api.md)).

## 3. Autorização

- **RBAC** por tenant (papéis: owner, admin, dispatcher, driver, viewer…).
- Autorização checada na camada de aplicação (guards NestJS) **e** reforçada por **RLS forçada** no banco.
- Toda requisição carrega `tenant_id` + `user_id` + papéis validados a partir do JWT; o `TenantTransactionInterceptor` define `app.current_tenant` por transação (ADR-0012).
- **Isolamento de tenant é inviolável:** `FORCE ROW LEVEL SECURITY` nas tabelas de negócio garante que nenhum recurso de um tenant seja acessível por outro, mesmo com bug de aplicação. Provado por teste de integração (`test/tenant-isolation.e2e-spec.ts`).

## 4. Criptografia

| Dado | Proteção |
|------|----------|
| Em trânsito | TLS 1.2+ obrigatório em todas as conexões |
| Em repouso (PII/sensível) | **AES-256-GCM** com **DEK por tenant** (envelope encryption) — ⬜ *planejado (ADR-0010); hoje a PII está em texto puro* |
| Senhas | Argon2id (hash + salt) |
| Refresh tokens / API keys | Hash (SHA-256) antes de persistir |
| Segredos/chaves | Secret manager / KMS, com rotação |

### 4.1 Envelope encryption por tenant (ADR-0010)

> **Status:** ⬜ **Planejado / não implementado.** `ENCRYPTION_KEK` é validada no ambiente, mas não há cifragem de campo no código. Toda a subseção abaixo descreve o alvo.

Cada tenant possui uma **DEK** (Data Encryption Key) própria, protegida por uma **KEK** no KMS. Vantagens: menor raio de exposição, suporte a residência de dados e **crypto-shredding** — destruir a DEK torna os dados daquele tenant irrecuperáveis, atendendo ao "direito ao esquecimento".

- Chaves de criptografia **nunca** no código nem no repositório.
- Rotação de chaves e *key versioning* nos dados criptografados (o registro guarda a versão da chave usada).

## 5. OWASP Top 10 — controles

| Risco | Mitigação |
|-------|-----------|
| **A01 Broken Access Control** | RBAC + RLS, testes de isolamento de tenant, negação por padrão |
| **A02 Cryptographic Failures** | TLS, AES-256, Argon2id, sem dados sensíveis em logs |
| **A03 Injection** | Queries parametrizadas/ORM, validação de entrada, sem SQL dinâmico |
| **A04 Insecure Design** | Threat modeling, este documento, revisões de arquitetura |
| **A05 Security Misconfiguration** | Config tipada/validada, headers seguros, hardening de containers |
| **A06 Vulnerable Components** | Auditoria de dependências (SCA), atualização contínua, lockfiles |
| **A07 Auth Failures** | Rotação de refresh, rate limit em login, bloqueio de força bruta |
| **A08 Data Integrity Failures** | Assinatura de artefatos, verificação de integridade, CI confiável |
| **A09 Logging & Monitoring Failures** | Logs de segurança, alertas, trilha de auditoria |
| **A10 SSRF** | Allowlist de destinos, validação de URLs de provedores externos |

## 6. Validação de entrada

- **Toda** entrada validada nos DTOs (class-validator) na borda da aplicação.
- Whitelisting de campos; rejeição de propriedades desconhecidas.
- Sanitização contra XSS onde houver renderização.
- Limites de tamanho de payload e de paginação (ver [api.md](./api.md)).

## 7. Proteções de API

- **Rate limiting** global + limites estritos em login/refresh (`@nestjs/throttler`), com **storage Redis** (contagem compartilhada entre instâncias) e fallback para memória. ✅ *Implementado.* Rate limit por tenant/usuário e **quotas por plano** seguem ⬜ *roadmap*.
- **Controle de abuso de endpoints caros:** otimização e bulk import têm quota e enfileiramento por tenant, evitando que um tenant degrade os demais (defesa contra *noisy neighbor* e negação de serviço econômica). ⬜ *Planejado — depende de fila (§8 da arquitetura).*
- **CORS** restrito a origens conhecidas.
- **Security headers** (HSTS, CSP, X-Content-Type-Options, etc.).
- Proteção contra **CSRF** quando houver cookies de sessão.
- Idempotência em operações críticas via `Idempotency-Key` (POD, tracking, import, otimização — ADR-0017), atômica com a operação e escopada por tenant. ✅ *Implementado.*
- Sem detalhes internos em mensagens de erro (ver [api.md](./api.md)).

### 7.1 Auditoria e acesso privilegiado

- **Trilha de auditoria** (`audit_log`): quem fez o quê, em qual tenant, quando. ✅ *Gravação implementada.* O caráter **append-only / imutável** (sem UPDATE/DELETE) é hoje **por convenção da aplicação**; a imutabilidade forçada no banco (trigger/revogação de privilégios) é ⬜ *roadmap*.
- **Acesso privilegiado (operadores Navix)** segue *least privilege*, com **break-glass** auditado e temporário para suporte/incidentes — nunca acesso permanente a dados de tenants.
- Ações administrativas sensíveis exigem reautenticação/MFA.

## 8. Gestão de segredos

- Variáveis de ambiente / secret manager; nunca commitados.
- `.env` no `.gitignore`; `.env.example` sem valores reais.
- Rotação periódica; segredos distintos por ambiente.
- Scanner de segredos no CI para bloquear vazamentos.

## 9. Privacidade e conformidade (LGPD / GDPR)

- Base legal e minimização de dados coletados.
- Direitos do titular: acesso, correção, exclusão, portabilidade.
- Retenção definida por tipo de dado (ver [database.md](./database.md)).
- Residência de dados por região para clientes que exigirem (fase de escala global).
- Registro de tratamento e trilhas de auditoria.

## 10. Segurança no ciclo de desenvolvimento (SSDLC)

> **Status:** 🟡 **Parcial (ampliado).** O CI (`.github/workflows/ci.yml`) roda: lint, typecheck, **testes unitários com cobertura obrigatória** (API + Web), **testes E2E** contra Postgres + Redis reais (com migrações e RLS forçada), **SCA** (`npm audit` — gate rígido em *critical* de produção + relatório completo), **secret scan** (gitleaks) e **build das imagens Docker**. Qualquer teste que falhe reprova a pipeline. **Ainda ⬜ roadmap:** SAST, DAST/pentest e escaneamento das imagens de container (ex.: Trivy). Branch protegida/sem push direto na main é política de processo (fora do repositório).

- **SAST** e **SCA** no CI; **DAST** e **pentests** periódicos.
- Revisão de código com foco em segurança (checklist).
- Branch protegida; sem *push* direto na main.
- Escaneamento de imagens de container.
- Secret scanning e dependabot/renovate.

## 11. Resposta a incidentes

- Plano de resposta com papéis e severidades definidos.
- Detecção via alertas de logs/métricas de segurança.
- Comunicação e notificação conforme obrigações legais.
- Post-mortem sem culpa e ações corretivas rastreadas.

## 12. Checklist de segurança por feature

- [ ] Entrada validada e sanitizada.
- [ ] Autorização (RBAC) e isolamento de tenant verificados.
- [ ] Dados sensíveis criptografados e fora dos logs.
- [ ] Erros não vazam detalhes internos.
- [ ] Rate limit / abuso considerados.
- [ ] Testes de segurança/isolamento incluídos.
- [ ] Dependências novas auditadas.

---

### Histórico

| Data | Versão | Autor | Mudança |
|------|--------|-------|---------|
| 2026-07-05 | 0.1 | Engenharia | Estrutura inicial |
| 2026-07-05 | 0.2 | CTO | Envelope encryption por tenant, M2M/API keys, audit log imutável, controle de abuso, break-glass |
| 2026-07-06 | 0.3 | Engenharia | Hardening implementado: RLS forçada + interceptor de tenant, RS256/key ring, throttler, CORS reforçado, auditoria de auth/authz e alterações críticas |
| 2026-07-12 | 0.4 | Arquitetura | Alinhamento doc↔código: callout do que já existe vs. roadmap; marcação ⬜ em cripto em repouso, Redis/blacklist, M2M, SSDLC e imutabilidade do audit_log |
| 2026-07-12 | 0.5 | Engenharia | Auth de produção: refresh token em cookie HttpOnly+Secure+SameSite (web), access token só em memória, fim do uso de localStorage; modo bearer para mobile |
