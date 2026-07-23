import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Destinatário na entrega (ADR-0076).
 *
 * O nome de quem recebe era coletado na importação e **descartado** ao criar a
 * entrega. É dado de domínio legítimo — uma entrega tem um destinatário — e é o
 * sinal que faltava para classificar o destino: "Av. Paulista 1000" não diz nada,
 * mas "Av. Paulista 1000 / Acme Ltda" diz que é uma empresa.
 *
 * Nulo para as entregas já existentes: sem backfill possível (o dado não foi
 * guardado). O classificador cai na heurística de endereço nesses casos.
 */
export class DeliveryRecipient1720002600000 implements MigrationInterface {
  name = 'DeliveryRecipient1720002600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deliveries" ADD COLUMN "recipient" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deliveries" DROP COLUMN "recipient"`);
  }
}
