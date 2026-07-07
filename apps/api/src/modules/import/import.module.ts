import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DeliveryModule } from '../delivery/delivery.module';
import { OptimizerModule } from '../optimizer/optimizer.module';
import { ConfirmImportUseCase } from './application/confirm-import.use-case';
import { GetImportUseCase } from './application/get-import.use-case';
import { ListImportsUseCase } from './application/list-imports.use-case';
import { ParserRegistry } from './application/parser-registry';
import { PreviewImportUseCase } from './application/preview-import.use-case';
import { ADDRESS_CLASSIFIER } from './domain/ports/address-classifier.port';
import { DELIVERY_CREATOR } from './domain/ports/delivery-creator.port';
import { FILE_PARSERS } from './domain/ports/file-parser.port';
import { GEOCODER } from './domain/ports/geocoder.port';
import { IMPORT_BATCH_REPOSITORY } from './domain/ports/import-batch-repository.port';
import { ROUTE_ESTIMATOR } from './domain/ports/route-estimator.port';
import { HeuristicAddressClassifier } from './infrastructure/classification/heuristic-address-classifier';
import { DeliveryCreatorGateway } from './infrastructure/gateways/delivery-creator.gateway';
import { RouteEstimatorGateway } from './infrastructure/gateways/route-estimator.gateway';
import { MapboxGeocoder } from './infrastructure/geocoding/mapbox-geocoder';
import { CsvParser } from './infrastructure/parsing/csv.parser';
import { PdfParser } from './infrastructure/parsing/pdf.parser';
import { XlsxParser } from './infrastructure/parsing/xlsx.parser';
import { ImportBatchOrmEntity } from './infrastructure/persistence/import-batch.orm-entity';
import { ImportBatchRepository } from './infrastructure/persistence/import-batch.repository';
import { ImportController } from './interface/import.controller';

/**
 * Import Center. Parsers registrados como multi-provider (Strategy) — novas
 * fontes (Shopee, Amazon, Shopify, Woo, APIs, OCR) entram só adicionando aqui.
 * Consome as APIs públicas de Delivery e Optimizer via portas anti-corrupção.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ImportBatchOrmEntity]), DeliveryModule, OptimizerModule],
  controllers: [ImportController],
  providers: [
    PreviewImportUseCase,
    ConfirmImportUseCase,
    GetImportUseCase,
    ListImportsUseCase,
    ParserRegistry,
    CsvParser,
    XlsxParser,
    PdfParser,
    {
      provide: FILE_PARSERS,
      useFactory: (csv: CsvParser, xlsx: XlsxParser, pdf: PdfParser) => [csv, xlsx, pdf],
      inject: [CsvParser, XlsxParser, PdfParser],
    },
    { provide: GEOCODER, useClass: MapboxGeocoder },
    { provide: ADDRESS_CLASSIFIER, useClass: HeuristicAddressClassifier },
    { provide: DELIVERY_CREATOR, useClass: DeliveryCreatorGateway },
    { provide: ROUTE_ESTIMATOR, useClass: RouteEstimatorGateway },
    { provide: IMPORT_BATCH_REPOSITORY, useClass: ImportBatchRepository },
  ],
})
export class ImportModule {}
