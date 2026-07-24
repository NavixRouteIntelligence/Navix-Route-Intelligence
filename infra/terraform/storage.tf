# ---------------------------------------------------------------------------
# Armazenamento: S3 (mídia de POD) + ECR (registro de imagens Docker).
# ---------------------------------------------------------------------------

# --- S3: fotos e assinaturas do Proof of Delivery ---------------------------
resource "aws_s3_bucket" "pod_media" {
  bucket = "${local.name}-pod-media"
}

resource "aws_s3_bucket_public_access_block" "pod_media" {
  bucket                  = aws_s3_bucket.pod_media.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "pod_media" {
  bucket = aws_s3_bucket.pod_media.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_versioning" "pod_media" {
  bucket = aws_s3_bucket.pod_media.id
  versioning_configuration { status = "Enabled" }
}

# Acesso só por URL assinada (o código já usa HMAC/URLs assinadas — ADR de POD).

# --- ECR: onde o pipeline publica as imagens Docker ------------------------
resource "aws_ecr_repository" "api" {
  name                 = "navix-api"
  image_tag_mutability = "IMMUTABLE"
  image_scanning_configuration { scan_on_push = true }
  encryption_configuration { encryption_type = "KMS" }
}

resource "aws_ecr_repository" "web" {
  name                 = "navix-web"
  image_tag_mutability = "IMMUTABLE"
  image_scanning_configuration { scan_on_push = true }
  encryption_configuration { encryption_type = "KMS" }
}

# Mantém só as 20 imagens mais recentes (controle de custo).
resource "aws_ecr_lifecycle_policy" "api" {
  repository = aws_ecr_repository.api.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Manter 20 imagens"
      selection    = { tagStatus = "any", countType = "imageCountMoreThan", countNumber = 20 }
      action       = { type = "expire" }
    }]
  })
}

resource "aws_ecr_lifecycle_policy" "web" {
  repository = aws_ecr_repository.web.name
  policy     = aws_ecr_lifecycle_policy.api.policy
}
