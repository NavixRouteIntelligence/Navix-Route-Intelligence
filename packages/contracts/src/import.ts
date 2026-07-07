/**
 * Contratos do módulo Import Center (ingestão de entregas a partir de arquivos).
 * Preparado para futuras fontes (Shopee/Amazon/Shopify/Woo/APIs/OCR).
 */
import type { DeliveryPriority } from './delivery';

export type ImportFileType = 'csv' | 'xlsx' | 'pdf';
export type ImportBatchStatus = 'preview' | 'imported' | 'failed';
export type ImportRowStatus = 'valid' | 'invalid' | 'duplicate';

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
  /** Se true, dispara o Route Optimizer com as entregas criadas. */
  optimize?: boolean;
}

export interface ConfirmImportResponse {
  batch: ImportBatchView;
  createdDeliveries: number;
  routePlanId: string | null;
}
