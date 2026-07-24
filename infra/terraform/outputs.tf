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
