import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Procedência da observação coletiva (ADR-0088) — separa o que é medido do que
 * foi relatado, e põe em quarentena o `service_time` contaminado.
 *
 * ## O que estava errado
 *
 * O dwell enviado pelo cliente era contado **do fim da parada anterior** até a
 * conclusão da atual: incluía o deslocamento. Ficava gravado como
 * `service_time` — tempo de atendimento —, mas media **tempo de ciclo**. Como
 * esse mesmo campo alimenta o tempo de serviço do otimizador (ADR-0065), o
 * solver vinha somando o trajeto duas vezes: uma na matriz de distância, outra
 * dentro do "atendimento".
 *
 * ## Por que marcar em vez de apagar
 *
 * As linhas não são lixo: são tempo de ciclo real, medido em campo, que um dia
 * pode servir para outra coisa. Apagar é irreversível e destruiria observação
 * que ninguém consegue recoletar — o percurso daquele dia não volta. Marcar
 * tira o dado do caminho de decisão (a agregação passa a ignorar
 * `client_cycle`) e preserva a chance de reinterpretá-lo.
 */
export class ObservationSource1720003100000 implements MigrationInterface {
  name = 'ObservationSource1720003100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // `derived` como default: daqui em diante o tempo de atendimento é medido
    // no backend a partir do rastro de GPS, não relatado pelo cliente.
    await queryRunner.query(
      `ALTER TABLE collective_observations ADD COLUMN source text NOT NULL DEFAULT 'derived'`,
    );

    // Quarentena do que já existe: todo `service_time` gravado até aqui veio do
    // cliente com a semântica errada.
    await queryRunner.query(
      `UPDATE collective_observations SET source = 'client_cycle' WHERE kind = 'service_time'`,
    );
    // O resto (estacionamento, dica de acesso) é relato de campo e continua
    // válido — não tem semântica de tempo para contaminar.
    await queryRunner.query(
      `UPDATE collective_observations SET source = 'reported' WHERE kind <> 'service_time'`,
    );

    // A agregação filtra por procedência; o índice acompanha.
    await queryRunner.query(
      `CREATE INDEX idx_collective_cell_source ON collective_observations (tenant_id, cell, source, created_at);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_collective_cell_source;`);
    await queryRunner.query(`ALTER TABLE collective_observations DROP COLUMN IF EXISTS source;`);
  }
}
