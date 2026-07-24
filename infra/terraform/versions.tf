# ---------------------------------------------------------------------------
# Navix — Infraestrutura como Código (IaC)
# Alvo: AWS eu-central-1 (Frankfurt) — decisão de região única (UE) atende
# Portugal + Brasil sob GDPR/LGPD. Ver docs/infrastructure/README.md.
#
# STATUS: base de partida para fechar o R2 da Auditoria 5. Requer revisão de
# um engenheiro de infraestrutura antes do primeiro `apply` em produção.
# ---------------------------------------------------------------------------

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Estado remoto: guarde o state num bucket S3 versionado + lock em DynamoDB.
  # Crie o bucket/tabela UMA vez à mão (bootstrap) e descomente abaixo.
  # backend "s3" {
  #   bucket         = "navix-tfstate"
  #   key            = "global/terraform.tfstate"
  #   region         = "eu-central-1"
  #   dynamodb_table = "navix-tflock"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "navix"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
