# ---------------------------------------------------------------------------
# Saídas úteis após o `apply`. Valores sensíveis ficam marcados como sensitive.
# ---------------------------------------------------------------------------

output "alb_dns_name" {
  description = "Endereço do load balancer (aponte os CNAMEs do Cloudflare para cá)."
  value       = aws_lb.this.dns_name
}

output "db_endpoint" {
  description = "Endereço do banco (host:porta)."
  value       = aws_db_instance.this.endpoint
}

output "redis_endpoint" {
  description = "Endereço do Redis primário."
  value       = aws_elasticache_replication_group.this.primary_endpoint_address
}

output "ecr_api_repo" {
  description = "Repositório ECR da imagem da API (usado pelo pipeline)."
  value       = aws_ecr_repository.api.repository_url
}

output "ecr_web_repo" {
  description = "Repositório ECR da imagem do web."
  value       = aws_ecr_repository.web.repository_url
}

output "pod_media_bucket" {
  description = "Bucket S3 das fotos/assinaturas de POD."
  value       = aws_s3_bucket.pod_media.bucket
}

output "app_secret_arn" {
  description = "ARN do segredo com as chaves da aplicação (preencher JWT/KEK)."
  value       = aws_secretsmanager_secret.app_keys.arn
}

# --- Insumos do pipeline de CD (.github/workflows/deploy.yml) ---------------
# O deploy roda uma task ECS one-off de migração e precisa saber ONDE colocá-la
# na rede. Estes outputs são a fonte de verdade desses valores (não são
# sensíveis: IDs de subnet/SG). Alimente-os como *variables* do GitHub Actions
# (Settings → Secrets and variables → Actions → Variables): PRIVATE_SUBNETS e
# APP_SG. Ver docs/infrastructure/terraform-plan-runbook.md.

output "ecs_cluster_name" {
  description = "Nome do cluster ECS (env ECS_CLUSTER do deploy.yml)."
  value       = aws_ecs_cluster.this.name
}

output "private_subnet_ids" {
  description = "IDs das subnets privadas (CD → PRIVATE_SUBNETS, separados por vírgula)."
  value       = join(",", module.vpc.private_subnets)
}

output "app_security_group_id" {
  description = "ID do security group das tarefas de aplicação (CD → APP_SG)."
  value       = aws_security_group.app.id
}
