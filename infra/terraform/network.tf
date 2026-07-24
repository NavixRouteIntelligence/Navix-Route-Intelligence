# ---------------------------------------------------------------------------
# Rede: VPC com subnets públicas (ALB) e privadas (app + banco + redis).
# Usa o módulo oficial da AWS para manter o código enxuto e auditável.
# ---------------------------------------------------------------------------

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  name = "navix-${var.environment}"
  azs  = slice(data.aws_availability_zones.available.names, 0, 2)
}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.8"

  name = local.name
  cidr = var.vpc_cidr
  azs  = local.azs

  private_subnets = [cidrsubnet(var.vpc_cidr, 4, 0), cidrsubnet(var.vpc_cidr, 4, 1)]
  public_subnets  = [cidrsubnet(var.vpc_cidr, 4, 2), cidrsubnet(var.vpc_cidr, 4, 3)]
  # Subnets isoladas para o banco (sem rota para a internet).
  database_subnets = [cidrsubnet(var.vpc_cidr, 4, 4), cidrsubnet(var.vpc_cidr, 4, 5)]

  enable_nat_gateway     = true
  single_nat_gateway     = var.environment != "production" # 1 NAT em staging (barato)
  one_nat_gateway_per_az = var.environment == "production" # HA em produção

  enable_dns_hostnames = true
  enable_dns_support   = true
}

# --- Grupos de segurança (firewalls internos) ------------------------------

resource "aws_security_group" "alb" {
  name_prefix = "${local.name}-alb-"
  description = "Entrada HTTPS/HTTP do mundo para o load balancer."
  vpc_id      = module.vpc.vpc_id

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    description = "HTTP (redireciona para HTTPS)"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  lifecycle { create_before_destroy = true }
}

resource "aws_security_group" "app" {
  name_prefix = "${local.name}-app-"
  description = "Tarefas ECS (API/worker/web). Só recebem do ALB."
  vpc_id      = module.vpc.vpc_id

  ingress {
    description     = "Tráfego vindo do ALB"
    from_port       = 0
    to_port         = 65535
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  lifecycle { create_before_destroy = true }
}

resource "aws_security_group" "data" {
  name_prefix = "${local.name}-data-"
  description = "Banco e Redis. Só recebem das tarefas da aplicação."
  vpc_id      = module.vpc.vpc_id

  ingress {
    description     = "Postgres"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }
  ingress {
    description     = "Redis"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }
  lifecycle { create_before_destroy = true }
}
