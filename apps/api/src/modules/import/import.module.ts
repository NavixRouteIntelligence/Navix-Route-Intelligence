import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DeliveryModule } from '../delivery/delivery.module';
import { OptimizerModule } from '../optimizer/optimizer.module';
import { ConfirmImportUseCase } from './application/confirm-import.use-case';
import { ConnectorRegistry } from './application/connector-registry';
import { GetImportUseCase } from './application/get-import.use-case';
import { ListConnectorsUseCase } from './application/list-connectors.use-case';
import { ListImportsUseCase } from './application/list-imports.use-case';
import { PreviewImportUseCase } from './application/preview-import.use-case';
import { CONNECTOR_REGISTRY } from './domain/connectors/connector-registry.port';
import {
  IMPORT_CONNECTORS,
  type ImportConnector,
} from './domain/connectors/import-connector.port';
import { ADDRESS_CLASSIFIER } from './domain/ports/address-classifier.port';
import { DELIVERY_CREATOR } from './domain/ports/delivery-creator.port';
import { GEOCODER } from './domain/ports/geocoder.port';
import { IMPORT_BATCH_REPOSITORY } from './domain/ports/import-batch-repository.port';
import { ROUTE_ESTIMATOR } from './domain/ports/route-estimator.port';
import { HeuristicAddressClassifier } from './infrastructure/classification/heuristic-address-classifier';
import {
  CSV_DESCRIPTOR,
  PDF_DESCRIPTOR,
  XLSX_DESCRIPTOR,
} from './infrastructure/connectors/file/file-connectors.catalog';
import { FileImportConnector } from './infrastructure/connectors/file/file-import.connector';
import { PLANNED_CONNECTOR_DESCRIPTORS } from './infrastructure/connectors/planned/planned-connectors.catalog';
import { PlannedConnector } from './infrastructure/connectors/planned/planned.connector';
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
 * Import Center. A ingestão é plugável por **conectores** (ver domain/connectors):
 * - `file` (CSV/Excel/PDF): disponíveis, adaptam os FileParser.
 * - `capture` (Barcode/QR/OCR) e `integration` (E-mail/API/Webhook/ERP):
 *   registrados como `planned` — ponto de extensão pronto, sem lógica ainda.
 *
 * Novos conectores entram apenas somando itens ao provider IMPORT_CONNECTORS;
 * casos de uso e contrato não mudam. Consome Delivery e Optimizer via portas
 * anti-corrupção.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ImportBatchOrmEntity]), DeliveryModule, OptimizerModule],
  controllers: [ImportController],
  providers: [
    PreviewImportUseCase,
    ConfirmImportUseCase,
    GetImportUseCase,
    ListImportsUseCase,
    ListConnectorsUseCase,
    CsvParser,
    XlsxParser,
    PdfParser,
    // Fábrica de conectores: arquivo (disponíveis) + planejados (stubs).
    {
      provide: IMPORT_CONNECTORS,
      useFactory: (csv: CsvParser, xlsx: XlsxParser, pdf: PdfParser): ImportConnector[] => [
        new FileImportConnector(CSV_DESCRIPTOR, csv),
        new FileImportConnector(XLSX_DESCRIPTOR, xlsx),
        new FileImportConnector(PDF_DESCRIPTOR, pdf),
        ...PLANNED_CONNECTOR_DESCRIPTORS.map((d) => new PlannedConnector(d)),
      ],
      inject: [CsvParser, XlsxParser, PdfParser],
    },
    { provide: CONNECTOR_REGISTRY, useClass: ConnectorRegistry },
    { provide: GEOCODER, useClass: MapboxGeocoder },
    { provide: ADDRESS_CLASSIFIER, useClass: HeuristicAddressClassifier },
    { provide: DELIVERY_CREATOR, useClass: DeliveryCreatorGateway },
    { provide: ROUTE_ESTIMATOR, useClass: RouteEstimatorGateway },
    { provide: IMPORT_BATCH_REPOSITORY, useClass: ImportBatchRepository },
  ],
})
export class ImportModule {}
