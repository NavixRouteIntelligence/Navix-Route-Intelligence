# Segurança — Navix Route Intelligence

> **Status:** Em revisão · **Versão:** 0.2 · **Atualizado:** 2026-07-05

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
- Access token: expiração curta (ex.: 15 min), assinado (RS256/ES256 preferível a HS256).
- Refresh token: armazenado com **hash** no banco, rotacionado a cada uso (*refresh token rotation*) e revogável.
- Detecção de reuso de refresh token → revogar toda a família de tokens.
- Logout revoga o refresh token; blacklist de tokens no Redis quando necessário.
- Senhas com **Argon2id** (ou bcrypt com custo adequado); nunca em texto claro.
- MFA previsto para contas administrativas (fase futura).

### 2.1 Autenticação máquina-a-máquina (M2M)

Usuários finais (app do motorista) e integrações não devem depender do fluxo de senha:

- **App do motorista / dispositivos:** OAuth2 + tokens de curta duração emitidos por dispositivo, revogáveis individualmente.
- **Integrações de terceiros (ERP, WMS):** **API keys** com escopo mínimo, armazenadas com **hash**, com `last_used_at` e rotação/revogação. Nunca logadas.
- **Webhooks de saída:** payload assinado com HMAC (ver [api.md](./api.md)).

## 3. Autorização

- **RBAC** por tenant (papéis: owner, admin, dispatcher, driver, viewer…).
- Autorização checada na camada de aplicação (guards NestJS) **e** reforçada por RLS no banco.
- Toda requisição carrega `tenant_id` + `user_id` + papéis validados a partir do JWT.
- **Isolamento de tenant é inviolável:** nenhum recurso de um tenant é acessível por outro. Testado explicitamente.

## 4. Criptografia

| Dado | Proteção |
|------|----------|
| Em trânsito | TLS 1.2+ obrigatório em todas as conexões |
| Em repouso (PII/sensível) | **AES-256-GCM** com **DEK por tenant** (envelope encryption) |
| Senhas | Argon2id (hash + salt) |
| Refresh tokens / API keys | Hash (SHA-256) antes de persistir |
| Segredos/chaves | Secret manager / KMS, com rotação |

### 4.1 Envelope encryption por tenant (ADR-0010)

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

- **Rate limiting** por IP/tenant/usuário (Redis) e **quotas por plano**.
- **Controle de abuso de endpoints caros:** otimização e bulk import têm quota e enfileiramento por tenant, evitando que um tenant degrade os demais (defesa contra *noisy neighbor* e negação de serviço econômica).
- **CORS** restrito a origens conhecidas.
- **Security headers** (HSTS, CSP, X-Content-Type-Options, etc.).
- Proteção contra **CSRF** quando houver cookies de sessão.
- Idempotência em operações sensíveis; proteção contra replay.
- Sem detalhes internos em mensagens de erro (ver [api.md](./api.md)).

### 7.1 Auditoria e acesso privilegiado

- **Trilha de auditoria imutável** (`audit_log` *append-only*): quem fez o quê, em qual tenant, quando. Sem UPDATE/DELETE.
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
