import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hardening — força a RLS nas tabelas de negócio. Com FORCE, mesmo o owner da
 * tabela (usuário da aplicação) fica sujeito às políticas: nenhuma linha é
 * visível/alterável sem `app.current_tenant` definido para o tenant correto
 * (definido por transação pelo TenantTransactionInterceptor).
 *
 * As tabelas de auth (users, refresh_tokens) NÃO são forçadas: login/refresh são
 * fluxos públicos que precisam consultar usuários antes de haver contexto de
 * tenant; o isolamento delas é garantido no nível de aplicação (filtro por tenant).
 */
const BUSINESS_TABLES = ['vehicles', 'drivers', 'deliveries', 'route_plans'];

export class ForceTenantRls1720000400000 implements MigrationInterface {
  name = 'ForceTenantRls1720000400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of BUSINESS_TABLES) {
      await queryRunner.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of BUSINESS_TABLES) {
      await queryRunner.query(`ALTER TABLE ${table} NO FORCE ROW LEVEL SECURITY;`);
    }
  }
}
