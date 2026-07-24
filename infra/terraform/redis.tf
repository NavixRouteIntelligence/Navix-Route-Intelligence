# ---------------------------------------------------------------------------
# Redis: ElastiCache. Usado pela fila BullMQ (worker de otimização) e pelos
# tickets de SSE / hub de tempo real (ADR-0053, R1 já corrigido no código).
# ---------------------------------------------------------------------------

resource "aws_elasticache_subnet_group" "this" {
  name       = "${local.name}-redis"
  subnet_ids = module.vpc.private_subnets
}

resource "random_password" "redis_auth" {
  length  = 32
  special = false
}

resource "aws_elasticache_replication_group" "this" {
  replication_group_id = "${local.name}-redis"
  description          = "Navix Redis (fila + tempo real)"

  engine         = "redis"
  engine_version = "7.1"
  node_type      = var.redis_node_type
  port           = 6379

  # HA em produção: 1 primário + 1 réplica com failover automático.
  num_cache_clusters         = var.environment == "production" ? 2 : 1
  automatic_failover_enabled = var.environment == "production"
  multi_az_enabled           = var.environment == "production"

  subnet_group_name  = aws_elasticache_subnet_group.this.name
  security_group_ids = [aws_security_group.data.id]

  # Criptografia em trânsito e em repouso + senha.
  transit_encryption_enabled = true
  at_rest_encryption_enabled = true
  auth_token                 = random_password.redis_auth.result

  snapshot_retention_limit = 7
  snapshot_window          = "01:00-02:00"

  lifecycle { ignore_changes = [auth_token] }
}
