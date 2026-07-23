/**
 * Contratos do módulo Import Center (ingestão de entregas a partir de arquivos).
 * Preparado para futuras fontes (Shopee/Amazon/Shopify/Woo/APIs/OCR).
 */
import type { DeliveryPriority } from './delivery';

export type ImportFileType = 'csv' | 'xlsx' | 'pdf';
export type ImportBatchStatus = 'preview' | 'imported' | 'failed';
export type ImportRowStatus = 'valid' | 'invalid' | 'duplicate';

/**
 * Conectores de importação — a fonte plugável de onde as entregas chegam.
 * Três famílias: arquivos, captura (scan/imagem) e integrações externas.
 */
export type ConnectorKind = 'file' | 'capture' | 'integration';

/** `available`: pronto para uso. `planned`: ponto de extensão preparado, sem lógica ainda. */
export type ConnectorStatus = 'available' | 'planned';

export type ConnectorId =
  | 'csv'
  | 'xlsx'
  | 'pdf'
  | 'barcode'
  | 'qrcode'
  | 'ocr'
  | 'email'
  | 'api'
  | 'webhook'
  | 'erp';

/** Capacidades declaradas por um conector (usadas por UI e orquestração). */
export interface ConnectorCapabilities {
  /** Recebe upload de arquivo do usuário. */
  fileUpload: boolean;
  /** Puxa dados sob demanda de uma fonte externa. */
  pull: boolean;
  /** Recebe eventos de push (webhook/inbound). */
  push: boolean;
  /** Requer credenciais/configuração por tenant antes de operar. */
  requiresConfig: boolean;
}

/** Descritor público de um conector (catálogo). */
export interface ImportConnectorDescriptor {
  id: ConnectorId;
  kind: ConnectorKind;
  status: ConnectorStatus;
  label: string;
  description: string;
  /** Extensões aceitas (conectores de arquivo). */
  accepts?: string[];
  capabilities: ConnectorCapabilities;
}

/** Classificação heurística do endereço. */
export type AddressCategory = 'residence' | 'commerce' | 'condo' | 'company' | 'unknown';

export const ADDRESS_CATEGORIES: readonly AddressCategory[] = [
  'residence',
  'commerce',
  'condo',
  'company',
  'unknown',
];

export interface ImportRowView {
  index: number;
  status: ImportRowStatus;
  recipient: string | null;
  phone: string | null;
  orderNumber: string | null;
  notes: string | null;
  priority: DeliveryPriority;
  /** Texto de endereço original extraído do arquivo. */
  addressText: string;
  latitude: number | null;
  longitude: number | null;
  addressCategory: AddressCategory;
  geocoded: boolean;
  /** Extraído com baixa confiança (ex.: PDF). */
  lowConfidence: boolean;
  errors: string[];
}

export interface ImportSummary {
  total: number;
  valid: number;
  invalid: number;
  duplicates: number;
  estimatedSavingsKm: number;
  estimatedSavingsPct: number;
}

export interface ImportBatchView {
  id: string;
  tenantId: string;
  filename: string;
  fileType: ImportFileType;
  status: ImportBatchStatus;
  summary: ImportSummary;
  createdDeliveries: number;
  routePlanId: string | null;
  createdAt: string;
  importedAt: string | null;
}

export interface ImportPreviewResponse {
  batch: ImportBatchView;
  rows: ImportRowView[];
}

export interface ConfirmImportRequest {
  /**
   * @deprecated Ignorado desde a IA automática (ADR-0074). A otimização deixou
   * de ser opcional: confirmar a importação **sempre** prepara a rota quando há
   * pelo menos duas entregas georreferenciadas. O campo segue aceito apenas
   * para não quebrar clientes antigos sob `forbidNonWhitelisted`.
   */
  optimize?: boolean;
}

export interface ConfirmImportResponse {
  batch: ImportBatchView;
  createdDeliveries: number;
  routePlanId: string | null;
}
