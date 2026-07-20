import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DeliveryModule } from '../delivery/delivery.module';
import { CreateFinancialEntryUseCase } from './application/create-financial-entry.use-case';
import { DeleteFinancialEntryUseCase } from './application/delete-financial-entry.use-case';
import { GetFinancialSummaryUseCase } from './application/get-financial-summary.use-case';
import { ListFinancialEntriesUseCase } from './application/list-financial-entries.use-case';
import { DELIVERY_COUNT } from './application/ports/delivery-count.port';
import { FINANCIAL_ENTRY_REPOSITORY } from './domain/ports/financial-entry-repository.port';
import { DeliveryCountGateway } from './infrastructure/gateways/delivery-count.gateway';
import { FinancialEntryOrmEntity } from './infrastructure/persistence/financial-entry.orm-entity';
import { FinancialEntryRepository } from './infrastructure/persistence/financial-entry.repository';
import { FinanceController } from './interface/finance.controller';

/**
 * Módulo Finance (FASE 3 — inteligência financeira do motorista). Ledger de
 * receita/despesa + resumo (custo/km, lucro/entrega). Importa o Delivery para
 * contar entregas via API pública (anti-corrupção).
 */
@Module({
  imports: [TypeOrmModule.forFeature([FinancialEntryOrmEntity]), DeliveryModule],
  controllers: [FinanceController],
  providers: [
    CreateFinancialEntryUseCase,
    ListFinancialEntriesUseCase,
    DeleteFinancialEntryUseCase,
    GetFinancialSummaryUseCase,
    { provide: FINANCIAL_ENTRY_REPOSITORY, useClass: FinancialEntryRepository },
    { provide: DELIVERY_COUNT, useClass: DeliveryCountGateway },
  ],
})
export class FinanceModule {}
