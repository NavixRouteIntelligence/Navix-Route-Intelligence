#!/usr/bin/env bash
# ==========================================================================
# Validação da Fase 0 — Navix Route Intelligence
# Executa localmente todos os passos que provam que a infraestrutura
# compila e sobe. Requer: Node >= 20, Docker e acesso ao registro npm.
# Uso:  bash scripts/validate-phase0.sh
# ==========================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

step() { printf '\n\033[1;34m▶ %s\033[0m\n' "$1"; }

step "1/9 · Versão do Node"
node -v

step "2/9 · Instalando dependências (npm ci ou install)"
if [ -f package-lock.json ]; then npm ci; else npm install; fi

step "3/9 · Preparando .env"
[ -f .env ] || cp .env.example .env

step "4/9 · Build do pacote de contratos"
npm run build -w packages/contracts

step "5/9 · Lint"
npm run lint

step "6/9 · Typecheck (contracts + api + web)"
npm run typecheck

step "7/9 · Testes unitários"
npm test

step "8/9 · Subindo infraestrutura (Postgres, Redis, PgBouncer) e migrando"
npm run docker:up
echo "Aguardando Postgres ficar saudável..."
sleep 8
npm run migration:run

step "9/9 · Build das aplicações (api + web)"
npm run build -w apps/api
npm run build -w apps/web

printf '\n\033[1;32m✔ Fase 0 validada com sucesso.\033[0m\n'
echo "Suba a app com:  npm run dev:api  e  npm run dev:web"
echo "Health check:    curl http://localhost:3001/api/v1/health/live  (ou /health/ready)"
