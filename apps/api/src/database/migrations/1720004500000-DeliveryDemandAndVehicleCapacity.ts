import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Peso e volume por entrega, e capacidade em duas dimensões no veículo
 * (ADR-0109).
 *
 * ## O que estava morto
 *
 * A máquina de capacidade existe desde a ADR-0022 — `assessCapacity`,
 * `partitionByCapacity`, paradas não atribuídas —, mas a entrega **não tinha
 * peso nem volume**. O otimizador gravava demanda zero para toda entrega real,
 * então a capacidade nunca era excedida e nenhuma parada jamais ficava de fora
 * por carga. A funcionalidade existia e não valia para o caminho que importa.
 *
 * ## Duas dimensões, e por que a antiga não servia
 *
 * `vehicles.capacity` era um inteiro único cuja unidade o próprio contrato
 * descrevia como "definida pelo tenant (ex.: kg ou volumes)" — ou seja, não dá
 * para saber se 400 é quilo ou metro cúbico. Sem unidade não há comparação
 * possível com a carga. As colunas novas são explícitas e o backfill parte dos
 * defaults por tipo, que é a melhor informação disponível hoje.
 */
export class DeliveryDemandAndVehicleCapacity1720004500000 implements MigrationInterface {
  name = 'DeliveryDemandAndVehicleCapacity1720004500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Entrega: demanda real, opcional (ADR-0109).
    // Nulo é legítimo e frequente: nenhuma entrega existente tem esses dados, e
    // a importação ainda não os traz. A política de ausência é do otimizador —
    // conta como zero e o plano declara quantas foram assim.
    await queryRunner.query(`
      ALTER TABLE deliveries
        ADD COLUMN IF NOT EXISTS weight_kg double precision,
        ADD COLUMN IF NOT EXISTS volume_m3 double precision;
    `);
    await queryRunner.query(`
      ALTER TABLE deliveries
        ADD CONSTRAINT chk_deliveries_weight CHECK (weight_kg IS NULL OR weight_kg > 0),
        ADD CONSTRAINT chk_deliveries_volume CHECK (volume_m3 IS NULL OR volume_m3 > 0);
    `);

    // --- Veículo: capacidade com unidade explícita.
    await queryRunner.query(`
      ALTER TABLE vehicles
        ADD COLUMN IF NOT EXISTS capacity_kg double precision,
        ADD COLUMN IF NOT EXISTS capacity_volume_m3 double precision;
    `);
    // Backfill pelos defaults por tipo — a mesma tabela que o otimizador já
    // usava (`VEHICLE_CAPACITY_DEFAULTS`), agora gravada por veículo e passível
    // de ajuste individual. O `capacity` antigo não é convertido: sem unidade,
    // convertê-lo seria adivinhar.
    await queryRunner.query(`
      UPDATE vehicles SET
        capacity_kg = CASE type
          WHEN 'bicycle' THEN 15 WHEN 'motorcycle' THEN 30 WHEN 'car' THEN 400
          WHEN 'van' THEN 1200 WHEN 'truck' THEN 12000 END,
        capacity_volume_m3 = CASE type
          WHEN 'bicycle' THEN 0.1 WHEN 'motorcycle' THEN 0.2 WHEN 'car' THEN 1.5
          WHEN 'van' THEN 8 WHEN 'truck' THEN 40 END
      WHERE capacity_kg IS NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE vehicles
        ADD CONSTRAINT chk_vehicles_capacity_kg CHECK (capacity_kg IS NULL OR capacity_kg > 0),
        ADD CONSTRAINT chk_vehicles_capacity_volume
          CHECK (capacity_volume_m3 IS NULL OR capacity_volume_m3 > 0);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE vehicles
        DROP CONSTRAINT IF EXISTS chk_vehicles_capacity_kg,
        DROP CONSTRAINT IF EXISTS chk_vehicles_capacity_volume,
        DROP COLUMN IF EXISTS capacity_kg,
        DROP COLUMN IF EXISTS capacity_volume_m3;
    `);
    await queryRunner.query(`
      ALTER TABLE deliveries
        DROP CONSTRAINT IF EXISTS chk_deliveries_weight,
        DROP CONSTRAINT IF EXISTS chk_deliveries_volume,
        DROP COLUMN IF EXISTS weight_kg,
        DROP COLUMN IF EXISTS volume_m3;
    `);
  }
}
