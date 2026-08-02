# Base Enterprise e white-label

## Estado anterior ao T4.3

- O `tenantId` já é transportado no JWT e aplicado por transação.
- As tabelas de negócio usam RLS com `FORCE ROW LEVEL SECURITY` e o runtime não é owner.
- O RBAC já separa `admin`, `fleet_manager` e `driver`.
- O login resolvia a organização por e-mail globalmente único ou pelo `slug` informado, sem usar o host.
- Nome, logo, cores, domínio próprio e SSO ainda não possuíam modelo por tenant.

## Base entregue

Cada tenant pode manter um nome de exibição, logo HTTPS e as cores primária, secundária e de destaque. A identidade visual é resolvida antes do login pelo subdomínio padrão ou por um domínio próprio previamente verificado. Depois da autenticação, o cliente consulta novamente a configuração pelo tenant do usuário.

As leituras públicas expõem somente os dados necessários para renderizar a marca. Escritas continuam restritas por JWT, papel `admin`, plano Enterprise e RLS. A ausência de configuração ou qualquer falha de resolução degrada para a identidade padrão da Navix.

## Domínio próprio

1. O administrador informa o domínio na tela da empresa.
2. A API devolve o registro TXT `_navix-verification.<domínio>` e seu valor.
3. O token é derivado por HMAC de `tenantId + domínio`, usando o KEK da aplicação; ele não é persistido nem exposto em políticas públicas.
4. A verificação consulta DNS por uma port com timeout.
5. Somente após a confirmação o domínio passa a resolver a marca.

O provisionamento de CNAME, certificado TLS, CDN/edge e renovação de certificado permanece operacional. A API nunca considera um domínio não verificado como ativo.

## SSO corporativo

Existe uma port para início e conclusão de SSO SAML/OIDC. O adaptador padrão falha fechado e nenhuma rota pública de callback é exposta até existir um provedor completo. A evolução deve obrigatoriamente incluir:

- discovery/metadata e allowlist do issuer;
- assinatura e audiência validadas;
- `state`, `nonce` e PKCE quando aplicável;
- proteção contra replay e expiração curta;
- vínculo explícito entre domínio verificado, tenant e configuração SSO;
- JIT provisioning com papel mínimo e auditoria;
- rotação de certificados/segredos e desligamento de emergência.

## Isolamento e SLA: lacunas conscientes

A base atual oferece isolamento lógico forte no banco compartilhado, mas Enterprise pode exigir residência de dados, chave dedicada, schema ou banco por tenant. Essa decisão depende de contrato, região e volume e não foi simulada por esta entrega.

Também permanecem fora do código os compromissos contratuais: disponibilidade, RTO/RPO, suporte, manutenção, retenção, exportação e direito de auditoria. Antes da primeira venda Enterprise, esses itens precisam ser definidos e medidos pela observabilidade de produção.

## Fora do escopo desta base

- aplicativo mobile com binário/ícone por cliente;
- provisionamento automático do edge e TLS;
- implementação de um IdP específico;
- billing e quotas Enterprise;
- isolamento físico dedicado e SLA contratual.
