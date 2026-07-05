-- ==========================================================================
-- Navix Route Intelligence — inicialização do PostgreSQL
-- Executado automaticamente pelo container na PRIMEIRA subida (superuser).
-- Cria extensões que exigem privilégio elevado. As TABELAS são criadas
-- pelas migrações do TypeORM (ver apps/api/src/database/migrations).
-- ==========================================================================

-- Suporte geoespacial (coordenadas, rotas, consultas espaciais).
CREATE EXTENSION IF NOT EXISTS postgis;

-- Funções criptográficas e geração de UUID/valores aleatórios.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Observação: telemetria de posições (TimescaleDB) entra na Fase 2 (ADR-0009).
-- A extensão será adicionada aqui quando o serviço de tracking for implementado.
