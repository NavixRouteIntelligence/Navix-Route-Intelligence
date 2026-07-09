import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Proof of Delivery — tabela `proof_of_delivery`. Um comprovante por entrega
 * (foto/assinatura como data URLs, GPS, observação, status). Escopada por tenant
 * (RLS FORCE + policy) com grant ao role de runtime.
 */
export class ProofOfDelivery1720001100000 implements MigrationInterface {
  name = 'ProofOfDelivery1720001100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE proof_of_delivery (
        id           uuid PRIMARY KEY,
        tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        delivery_id  uuid NOT NULL,
        driver_id    uuid NOT NULL,
        status       text NOT NULL,
        note         text,
        latitude     double precision,
        longitude    double precision,
        photo        text,
        signature    text,
        recorded_at  timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX uq_pod_delivery ON proof_of_delivery (tenant_id, delivery_id);`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_pod_tenant_created ON proof_of_delivery (tenant_id, recorded_at);`,
    );

    await queryRunner.query(`ALTER TABLE proof_of_delivery ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE proof_of_delivery FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON proof_of_delivery
        USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
    `);

    const appUser = process.env.DB_APP_USER ?? 'navix_app';
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON proof_of_delivery TO ${appUser};`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation ON proof_of_delivery;`);
    await queryRunner.query(`DROP TABLE IF EXISTS proof_of_delivery;`);
  }
}
