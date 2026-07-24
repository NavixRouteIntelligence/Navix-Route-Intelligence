# Terraform — Infraestrutura AWS (Frankfurt / eu-central-1)

> **O que é isto:** a "planta" que recria toda a infraestrutura de produção da Navix
> com um comando. É a peça central para fechar o **R2** da Auditoria 5 (que apontava a
> ausência de IaC). Alvo: **AWS eu-central-1 (Frankfurt)**, região única da UE que
> atende Portugal e Brasil sob GDPR/LGPD.
>
> ⚠️ **Base de partida.** Antes do primeiro `apply` em produção, peça a revisão de um
> engenheiro de infraestrutura (ou me chame para acompanhar). Não é para rodar às
> cegas.

## O que este código provisiona

| Arquivo | Cria |
|---------|------|
| `network.tf` | VPC, subnets (pública/privada/banco), NAT, firewalls |
| `database.tf` | RDS PostgreSQL 16 (PostGIS/TimescaleDB), backup + PITR |
| `redis.tf` | ElastiCache Redis 7 (fila BullMQ + tempo real) |
| `ecs.tf` | Cluster Fargate: serviços `api`, `worker`, `web` (escalam separados) |
| `alb.tf` | Load balancer HTTPS + certificado + roteamento por host |
| `storage.tf` | S3 (mídia POD) + ECR (imagens Docker) |
| `secrets.tf` | Secrets Manager (URLs de banco/redis + chaves JWT/KEK) |
| `outputs.tf` | Endereços e ARNs úteis após o `apply` |

## Pré-requisitos (uma vez)

1. Conta AWS + usuário com permissão de administrador para o setup inicial.
2. [Terraform](https://developer.hashicorp.com/terraform/install) e o
   [AWS CLI](https://aws.amazon.com/cli/) instalados e autenticados (`aws configure`).
3. Bootstrap do estado remoto (bucket S3 + tabela DynamoDB) e depois descomente o
   bloco `backend "s3"` em `versions.tf`.

## Como aplicar

> 📖 **Passo a passo completo (com bootstrap do state, apply em duas fases pela imagem
> e validação do certificado):**
> [`docs/infrastructure/terraform-plan-runbook.md`](../../docs/infrastructure/terraform-plan-runbook.md).
> O resumo abaixo assume que você já leu o runbook.

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # ajuste os valores
terraform init
terraform plan                                  # revise o que será criado
terraform apply                                 # cria a infraestrutura
```

## Depois do primeiro apply

1. Pegue `output app_secret_arn` e, no console do **Secrets Manager**, preencha
   `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY` e `ENCRYPTION_KEK` (ver
   `docs/infrastructure/01-piloto-passo-a-passo.md`, passo 5).
2. Conecte no banco e habilite as extensões + role de aplicação
   `NOSUPERUSER NOBYPASSRLS` (ver comentário em `database.tf` e `docs/security.md`).
3. Rode as migrações (o pipeline de deploy faz isso a cada release).
4. Aponte os CNAMEs do Cloudflare para o `output alb_dns_name` (ver
   `docs/infrastructure/02-dominios.md`).

## Ambientes

Use um workspace/tfvars por ambiente: `environment = "staging"` e
`environment = "production"`. Em produção, ligue `db_multi_az = true` (alta
disponibilidade). Staging deve espelhar produção em escala menor.

## Ainda pendente para o GA (fora do escopo desta base)

- Teste de carga (R4) — rodar **depois** que isto estiver de pé, para medir a
  arquitetura real.
- WAF na frente do ALB (ou usar o WAF do Cloudflare).
- Alarmes do CloudWatch → PagerDuty/Slack (parte já coberta pelos alertas Prometheus,
  ADR-0057).
