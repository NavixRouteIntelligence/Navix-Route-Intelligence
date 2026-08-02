# Multi-região — plano de preparação (UE × BR)

> **O que este documento é:** o plano de como fixar tenants a uma região, o que
> isso muda em banco, roteamento e deploy, os riscos, e os **critérios objetivos**
> que justificam começar. É a peça de preparação da T4.4.
>
> **O que este documento NÃO é:** implementação. Nada aqui cria região, replica
> banco ou muda deploy. Multi-região continua na [Fase 4 do roadmap](../roadmap.md);
> este texto existe para que a decisão de começar seja tomada com números, e para
> que as escolhas feitas **antes** dela não fechem portas.
>
> **Status:** proposta · **Data:** 2026-07-31 · **Base:** leitura do estado atual
> (multi-tenancy, `infra/terraform`, ADR-0003/0010/0012/0016)

---

## 1. Recomendação

**Não começar agora.** Nada no estado atual exige separação regional, e o custo
de operá-la é permanente enquanto o benefício hoje é hipotético. A recomendação
é preparar o terreno com três mudanças baratas (§7) e reavaliar quando um dos
gatilhos de §6 disparar.

A boa notícia do levantamento: o modelo de dados **já foi desenhado com isso em
mente**, e o caminho não exige reescrever o produto. O trabalho está concentrado
em um lugar específico e identificável — os pontos de entrada globais (§4.2).

---

## 2. Ponto de partida real

### 2.1 O que já existe a favor

| Achado | Consequência |
|---|---|
| `tenants.region` (`text NOT NULL DEFAULT 'global'`), desde a `InitPhase0` | A coluna de fixação **já existe**. Nunca foi lida por código nenhum — é um gancho puro, sem semântica atribuída ainda |
| **25 tabelas com RLS forçada** por `tenant_id` (ADR-0012) | O dado operacional já é fisicamente separável por tenant. Um `WHERE tenant_id` existe em toda leitura, então shardar por tenant não muda consulta de negócio |
| Tenant resolvido do **token**, nunca do cliente (ADR-0016, 0085) | O roteamento tem uma fonte única e confiável para decidir a região |
| Deploy inteiro em Terraform (ADR-0079/0080) | Duplicar uma região é parametrizar um módulo, não redescobrir a topologia |

### 2.2 O que trabalha contra

**Nove tabelas sem RLS** — e não por descuido: são os **pontos de entrada
globais**, que precisam resolver *qual* é o tenant antes de haver tenant.

```
users, tenants, roles, user_roles, refresh_tokens,
password_reset_tokens, delivery_tracking_tokens, driver_invites, outbox
```

**E a lista por RLS não basta.** `api_keys` **tem** RLS forçada, mas a política de
`SELECT` carrega um ramo deliberado — *"sem `app.current_tenant`, vê tudo"* — que
existe justamente para o `ApiKeyService.authenticate` poder achar a chave antes
de saber o tenant. Ou seja: procurar pontos de entrada global pela ausência de
RLS **deixaria essa passar**. É o argumento mais forte a favor de §7.3.

É aqui que mora praticamente todo o custo de multi-região. Quatro casos
concretos:

1. **Login resolve o tenant pelo e-mail, globalmente** (ADR-0016), sustentado
   pelo índice único `uq_users_email_lower`. Um índice único **global** não
   sobrevive a bancos independentes por região sem virar um problema de
   coordenação distribuída.
2. **Rastreio público** (ADR-0082) e **convite de motorista** (ADR-0085) resolvem
   o tenant a partir de um token opaco, em tabelas deliberadamente sem RLS. Um
   link emitido na UE precisa funcionar quando aberto do Brasil.
3. **Chave da API pública** (T4.1): `authenticate` procura pelo hash do segredo
   em todas as chaves, sem contexto de tenant. Uma chave entregue a um
   integrador precisa funcionar contra o endereço único da API, seja qual for a
   região do tenant dono dela.
4. **`refresh_tokens`** é global: uma sessão emitida numa região tem de ser
   renovável — ou deliberadamente não ser.

### 2.3 Passivos que o discurso de conformidade já assume

`security.md` §7 afirma que a **envelope encryption com chave por tenant**
(ADR-0010) sustenta residência de dados e *crypto-shredding*. Esse ADR está
**`Planejado`, não implementado**: hoje a PII está em texto puro e o
`ENCRYPTION_KEK` não é usado por ninguém.

Isso importa para este plano por dois motivos: (a) a chave por tenant é o que
permitiria *crypto-shredding* como alternativa parcial à separação física; e
(b) qualquer conversa comercial sobre residência de dados que se apoie no §7 de
`security.md` está, hoje, apoiada em algo que não existe. **Implementar a
ADR-0010 vale mais, e custa menos, do que multi-região** — e resolve parte do
mesmo problema (§7.1).

Dois componentes também são hoje **in-process** e não sobrevivem nem a múltiplas
réplicas, muito menos a múltiplas regiões: o `DomainEventBus` (ADR-0023/0083) e
o `DelayRiskRegistry` (ADR-0091). Ambos já estão documentados como pendentes de
Redis pub/sub; multi-região só torna a pendência mais cara.

---

## 3. Como fixar um tenant a uma região

### 3.1 O modelo: *pinning*, não replicação

Cada tenant pertence a **exatamente uma** região, decidida na criação e
**imutável na prática**. Nada de replicação ativo-ativo do dado operacional:

- replicar entre UE e BR reintroduz o problema de residência que a separação
  existia para resolver;
- resolução de conflito ativo-ativo é a fonte de bug mais cara que um SaaS pode
  adotar, e o produto não tem nenhum requisito que a justifique.

O valor de `tenants.region` passa de `'global'` para um enum fechado
(`eu-west`, `br-south`, …). Tenants existentes ficam onde estão: `'global'` é o
apelido da região atual até que exista uma segunda.

### 3.2 Quem decide a região

Na criação da organização, por esta ordem:

1. **Escolha explícita do cliente**, quando houver (contrato enterprise, exigência
   regulatória declarada);
2. **País da operação**, se informado no cadastro;
3. **Região do endereço IP** como palpite, apresentado ao usuário para confirmar
   — nunca aplicado em silêncio, porque errar aqui gera uma migração cara.

### 3.3 Mudar de região é uma migração, não uma configuração

Trocar a região de um tenant significa mover **todas** as suas linhas em 25
tabelas, com janela de indisponibilidade e reemissão de tokens públicos. Deve
existir como procedimento operacional documentado, com dono e ensaio — **não**
como um `UPDATE` em `tenants`. Tratar isso como campo editável é o caminho mais
curto para perder dados de um cliente.

---

## 4. O que muda

### 4.1 Banco

**Um cluster Postgres por região, independente.** Sem replicação cruzada do dado
operacional.

- As 25 tabelas com RLS vão inteiras para o cluster da região do tenant. Nenhuma
  consulta de negócio muda: todas já filtram por `tenant_id`.
- Migrações passam a rodar **N vezes**, uma por região, e podem divergir
  temporariamente durante um deploy. O `navix_migrations` de cada região vira
  uma fonte de verdade separada — e uma nova classe de incidente ("a UE está
  duas migrações à frente do BR").

**O diretório global.** As tabelas de §2.2 precisam de um lar. Duas opções:

| Opção | Como funciona | Custo | Risco |
|---|---|---|---|
| **A. Diretório central** (recomendada) | Um banco pequeno e global guarda `tenants`, `users` (só e-mail → tenant + região) e os tokens públicos. As regiões consultam-no para rotear | Uma dependência global no caminho de login; latência de uma consulta | Ponto único de falha para *autenticação* — mas não para operação: quem já está autenticado segue trabalhando |
| **B. Réplica por região** | Cada região tem cópia do diretório, sincronizada | Sem latência cruzada | Consistência eventual no cadastro; dois cadastros simultâneos do mesmo e-mail em regiões diferentes podem ambos vencer |

A opção A troca disponibilidade por correção, e essa é a troca certa aqui:
e-mail duplicado entre regiões seria um defeito silencioso e permanente,
enquanto uma indisponibilidade do diretório é visível e reparável.

**Consequência incômoda a aceitar:** o diretório central guarda e-mails, que são
PII. Ele fica sujeito ao regime mais restritivo entre as jurisdições atendidas —
provavelmente o GDPR. Isso é aceitável (é o mínimo indispensável para rotear),
mas precisa estar escrito no DPA, não descoberto numa auditoria.

### 4.2 Roteamento

O ponto crítico. Três caminhos, em ordem de dificuldade:

1. **Requisição autenticada** — fácil. O `tenantId` está no JWT; basta o token
   carregar também a `region` e o gateway encaminhar. Como o JWT já é assinado
   com RS256 e verificado por key ring (ADR-0013), a região vem com integridade
   garantida, sem consulta extra.
2. **Login e recuperação de senha** — média. Precisam do diretório global para
   descobrir a região a partir do e-mail, e só então encaminhar.
3. **Entradas públicas por token** (rastreio, convite, **chave de API**) — a mais
   delicada. O token é opaco e resolve o tenant. Duas saídas:
   - **prefixar a região no token** (`eu_<43 chars>`), tornando-o auto-roteável
     sem consulta — mas revelando a região a quem tiver o link, e exigindo
     compatibilidade com os tokens já emitidos;
   - **resolver pelo diretório global**, mantendo o token opaco ao custo de uma
     consulta cruzada.
   A segunda preserva a propriedade que a ADR-0082 comprou (o token não revela
   nada da estrutura interna) e é a recomendada. Para a **chave de API** vale a
   mesma escolha, com um agravante: chaves já entregues a integradores não podem
   mudar de formato sem quebrar contrato — o que reforça resolver pelo
   diretório, e não por prefixo.

Em todos os casos o roteamento acontece **na borda** — um único nome DNS,
`api.navix.pt`, encaminhando por região. Expor `api-eu.` e `api-br.` empurraria
a decisão de roteamento para o cliente, e os apps móveis instalados ficariam
presos à região que conheciam no dia da instalação.

### 4.3 Deploy

O Terraform atual descreve **uma** região: um `aws_ecs_cluster`, um `aws_lb`, um
`aws_db_instance`, um `aws_s3_bucket`, um ElastiCache. Nenhum deles é
parametrizado por região hoje — `var.aws_region` existe, mas é global ao stack.

O que muda:

- extrair a stack regional para um **módulo Terraform** instanciado por região;
- separar o que é **global** (DNS, diretório, WAF/CDN) do que é **regional**;
- o pipeline de CD passa a ter N alvos, com deploy **sequencial** e verificação
  entre eles — nunca simultâneo, para que uma migração ruim não derrube as duas
  regiões ao mesmo tempo;
- observabilidade ganha a dimensão `region` em toda métrica, senão um p95
  degradado numa região se dilui na média da outra;
- os *runbooks* (`docs/runbook.md`) precisam dizer, em cada procedimento, **em
  qual região** ele se aplica.

**Custo de infraestrutura: aproximadamente dobra.** Não é escala — é duplicação.
Duas regiões com metade da carga cada custam mais que uma região com a carga
inteira, porque os mínimos (ALB, NAT, RDS de base) se pagam duas vezes. Isso
precisa entrar em `docs/infrastructure/custo-por-tenant.md` antes da decisão.

---

## 5. Riscos

| Risco | Por que dói | Mitigação |
|---|---|---|
| **Divergência de schema entre regiões** | Migração aplicada numa região e falha noutra deixa o produto com dois comportamentos e nenhum jeito fácil de perceber | Deploy sequencial com gate; alerta comparando `navix_migrations` entre regiões |
| **Roteamento errado no login** | Usuário "não existe" porque foi procurado na região errada — e o suporte não consegue reproduzir | Diretório global como fonte única; nunca inferir região do IP em silêncio |
| **Vazamento entre regiões** | Uma consulta que atravesse regiões destrói exatamente a garantia que justificou o projeto | Sem credencial cruzada: a aplicação de uma região não tem rota de rede nem senha do banco da outra |
| **Token público emitido antes da separação** | Links de rastreio já entregues a destinatários param de funcionar | Diretório global resolve tokens antigos; nunca migrar o esquema de token sem período de convivência |
| **Custo de operar dobra antes da receita** | Duas regiões com poucos tenants cada é o pior dos mundos: custo de escala sem escala | Só começar com os gatilhos de §6 |
| **Migração de tenant entre regiões** | Procedimento raro, complexo e ensaiado uma vez só — falha exatamente quando é urgente | Documentar e **ensaiar** antes de prometer a qualquer cliente |
| **Latência do diretório no login** | Um salto cruzando o Atlântico no caminho mais sensível do produto | Cache de curta duração de e-mail→região; degradação explícita, não silenciosa |

---

## 6. Critérios para começar

Multi-região começa quando **um** destes disparar. Antes disso, é custo sem
contrapartida.

### 6.1 Conformidade (qualquer um basta)

- **Exigência contratual escrita** de residência de dados por um cliente cujo
  contrato justifique o custo anual da segunda região — não uma preferência
  manifestada em conversa comercial;
- **Requisito regulatório** aplicável à operação do cliente (setor público,
  saúde, financeiro) que proíba a saída do dado da jurisdição;
- Um cliente perdido, **documentado**, cuja objeção principal tenha sido
  residência de dados. Um caso é anedota; três são um padrão.

### 6.2 Volume e operação (dois ou mais)

- **≥ 20% da receita recorrente** vinda de uma jurisdição diferente da região
  atual;
- **p95 de latência** consistentemente acima do orçamento para usuários da outra
  jurisdição, com a otimização de rede já esgotada (CDN, keep-alive, região do
  provedor de mapas);
- **Volume que justifique o dobro do custo de infraestrutura** — regra prática:
  a receita da jurisdição remota paga a stack regional inteira com folga de 3×,
  senão a margem some;
- Equipe com **plantão capaz de operar duas regiões**. Duas regiões triplicam,
  não duplicam, a superfície de incidente — há os problemas de cada uma mais os
  de roteamento entre elas.

### 6.3 Pré-condições técnicas (todas, antes de começar)

1. `DomainEventBus` em Redis pub/sub (pendência da ADR-0023/0083);
2. ADR-0010 (envelope encryption por tenant) implementada;
3. Procedimento de migração de tenant entre regiões **escrito e ensaiado**;
4. Observabilidade com dimensão `region` em toda métrica e log.

Começar sem estas quatro é assinar um incidente com data marcada.

---

## 7. O que fazer antes — barato e sem multi-região

Três movimentos que valem por si, independentemente de a segunda região existir,
e que reduzem o custo de fazê-la depois.

### 7.1 Implementar a ADR-0010 (chave por tenant)

O maior retorno da lista. Resolve *crypto-shredding* e "direito ao esquecimento"
de verdade, fecha a lacuna entre o que `security.md` §7 promete e o que existe, e
atende **parte** das objeções de residência sem separar região nenhuma — para
vários clientes, "o dado é ilegível sem uma chave que só você controla" resolve
o problema comercial.

### 7.2 Dar semântica a `tenants.region`

Passar de `'global'` para um enum fechado, gravar a região na criação e
**incluí-la no JWT**. Sem nenhum efeito de roteamento — apenas parar de emitir
tenants sem região definida. É reversível, custa pouco, e evita um *backfill*
adivinhado quando a separação chegar.

### 7.3 Nomear os pontos de entrada globais no código

Hoje eles se descobrem inspecionando o banco — e, como mostra `api_keys`, o
critério óbvio ("não tem RLS") **falha**: aquela tabela tem RLS e mesmo assim é
um ponto de entrada global, por causa de um ramo permissivo na política de
`SELECT`.

Manter em `docs/database.md` uma lista **explícita e comentada** de "o que
resolve tenant antes de haver tenant" faz com que o próximo ponto de entrada
seja uma **decisão** consciente, e não uma descoberta no dia da separação
regional. Custa um parágrafo e é a diferença entre migrar com um mapa e migrar
procurando.

---

## 8. Não-objetivos

Para não haver dúvida sobre o que este plano **não** propõe:

- **Ativo-ativo ou failover automático entre regiões.** Regiões são
  independentes; a queda de uma não é atendida pela outra. Alta disponibilidade
  continua sendo problema **dentro** de cada região (multi-AZ).
- **Replicação do dado operacional entre regiões.** Anularia a residência.
- **Escolha de região pelo usuário final.** É propriedade do tenant, definida na
  criação da organização.
- **Multi-região como estratégia de performance.** Se o problema for latência,
  CDN e otimização de rede resolvem por uma fração do custo. Multi-região é
  resposta a **jurisdição**, não a milissegundos.
