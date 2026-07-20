import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Gestão do motorista (FASE 3, V2) — hodômetro atual do veículo. Base dos
 * lembretes de manutenção por quilometragem ("óleo em ~800 km"). Nullable: nem
 * todo veículo tem leitura informada.
 */
export class VehicleOdometer1720002400000 implements MigrationInterface {
  name = 'VehicleOdometer1720002400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE vehicles ADD COLUMN odometer_km integer;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE vehicles DROP COLUMN IF EXISTS odometer_km;`);
  }
}
