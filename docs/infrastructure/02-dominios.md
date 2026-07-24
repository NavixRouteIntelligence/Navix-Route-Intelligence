# Domínios — Registro e Configuração

> **Objetivo:** registrar os domínios da Navix e apontá-los para os serviços.
> Tudo por site, sem comandos.

---

## 1. Quais domínios registrar

Como você atende **Portugal e Brasil** e mira SaaS global, registre três:

| Domínio | Para quê | Onde registrar |
|---------|----------|----------------|
| **navix.pt** | Portugal / mercado europeu | Cloudflare Registrar |
| **navix.com.br** | Brasil (exige CNPJ) | **Registro.br** (obrigatório para `.com.br`) |
| **navix.com** | Marca global / e-mails / futuro | Cloudflare Registrar |

> Se `navix` estiver ocupado num deles, me peça para checar alternativas
> (`navixapp`, `getnavix`, `navix.io`, `navixlog`…). Não confirmo disponibilidade sem
> checar na hora.

**Por que Cloudflare Registrar:** vende o domínio a **preço de custo** (sem
remarcação), inclui **privacidade de WHOIS grátis**, e já entrega DNS, proteção contra
ataque (DDoS), certificado HTTPS e CDN no mesmo painel — tudo no plano gratuito.

O `.com.br` **precisa** ser registrado no Registro.br (com CNPJ); depois apontamos o
DNS dele para o Cloudflare para gerenciar tudo num lugar só.

---

## 2. Estrutura de subdomínios (decidida)

Um domínio, vários "endereços" para cada parte do sistema:

| Endereço | Aponta para | Papel |
|----------|-------------|-------|
| `app.navix.pt` | Web (Render/Fargate) | Painel da empresa |
| `api.navix.pt` | API (Render/Fargate) | O "cérebro" que o app e o site chamam |
| `track.navix.pt` | Web (rota pública) | **Rastreamento do destinatário** — a lacuna de CX que a auditoria apontou; já deixamos o endereço reservado |
| `status.navix.pt` | Página de status | Avisa clientes se houver instabilidade |
| `*.navix.pt` (curinga) | Web | **Um subdomínio por empresa cliente** (ex.: `transportadora-x.navix.pt`) — casa com "login sem digitar Tenant ID" do beta-roadmap |

O mesmo padrão vale para `navix.com.br` (para clientes que preferirem a marca brasileira).

---

## 3. Passo a passo (Cloudflare)

1. Em **dash.cloudflare.com** → **Domain Registration** → **Register Domain**.
   Procure `navix.pt` e `navix.com`, adicione ao carrinho e finalize (privacidade de
   WHOIS já vem ligada).
2. O domínio aparece em **Websites**. Abra-o → **DNS** → **Records** e crie:
   - Tipo `CNAME`, nome `api`, destino = o endereço do serviço API do Render
     (algo como `navix-api.onrender.com`). Proxy: **ligado** (nuvem laranja).
   - Tipo `CNAME`, nome `app`, destino = o endereço do serviço Web do Render.
   - Tipo `CNAME`, nome `track`, destino = o serviço Web (mesma app, rota pública).
   - Tipo `CNAME`, nome `*` (curinga), destino = o serviço Web.
3. Em cada serviço do Render, aba **Settings → Custom Domains**, adicione o endereço
   correspondente (`api.navix.pt`, `app.navix.pt`…). O Render confirma e emite o
   HTTPS automaticamente.
4. **SSL/TLS** no Cloudflare: deixe em modo **Full (strict)**.

## 4. Passo a passo (.com.br — Registro.br)

1. Em **registro.br**, faça login com a conta da empresa (CNPJ) e registre
   `navix.com.br`.
2. Em **Editar DNS / Alterar servidores DNS**, troque os servidores para os **dois
   nameservers do Cloudflare** (o Cloudflare mostra quais são quando você adiciona o
   domínio lá em **Add a site**).
3. A partir daí, gerencie os registros do `.com.br` dentro do Cloudflare, igual ao
   `.pt`.

> A propagação de DNS pode levar de alguns minutos a algumas horas. Normal.

---

## 5. E-mail (opcional, mas recomendado)

Para ter `contato@navix.pt`, use **Google Workspace** ou **Zoho Mail** e adicione os
registros `MX` que eles indicarem no DNS do Cloudflare. Configure também `SPF`,
`DKIM` e `DMARC` (o provedor de e-mail te dá os valores) — isso evita que seus
e-mails caiam em spam.
