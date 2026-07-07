import type {
  AddressCategory,
  ImportBatchStatus,
  ImportFileType,
  ImportRowStatus,
} from '@navix/contracts';

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

export const ROW_STATUS: Record<ImportRowStatus, { label: string; tone: Tone }> = {
  valid: { label: 'Válida', tone: 'success' },
  invalid: { label: 'Inválida', tone: 'danger' },
  duplicate: { label: 'Duplicada', tone: 'warning' },
};

export const BATCH_STATUS: Record<ImportBatchStatus, { label: string; tone: Tone }> = {
  preview: { label: 'Pré-visualização', tone: 'neutral' },
  imported: { label: 'Importada', tone: 'success' },
  failed: { label: 'Falhou', tone: 'danger' },
};

export const ADDRESS_CATEGORY_LABEL: Record<AddressCategory, string> = {
  residence: 'Residência',
  commerce: 'Comércio',
  condo: 'Condomínio',
  company: 'Empresa',
  unknown: 'Indefinido',
};

export const FILE_TYPE_LABEL: Record<ImportFileType, string> = {
  csv: 'CSV',
  xlsx: 'Excel',
  pdf: 'PDF',
};
