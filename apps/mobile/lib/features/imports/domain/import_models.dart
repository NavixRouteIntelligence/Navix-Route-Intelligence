import 'package:equatable/equatable.dart';

/// Espelho tipado (parcial) dos contratos do módulo Import Center usado na UI.

enum ImportFileType { csv, xlsx, pdf }

enum ImportBatchStatus { preview, imported, failed }

enum ImportRowStatus { valid, invalid, duplicate }

ImportBatchStatus _batchStatus(String? s) => switch (s) {
      'imported' => ImportBatchStatus.imported,
      'failed' => ImportBatchStatus.failed,
      _ => ImportBatchStatus.preview,
    };

ImportRowStatus _rowStatus(String? s) => switch (s) {
      'invalid' => ImportRowStatus.invalid,
      'duplicate' => ImportRowStatus.duplicate,
      _ => ImportRowStatus.valid,
    };

class ImportSummary extends Equatable {
  const ImportSummary({
    this.total = 0,
    this.valid = 0,
    this.invalid = 0,
    this.duplicates = 0,
    this.estimatedSavingsKm = 0,
    this.estimatedSavingsPct = 0,
  });

  final int total;
  final int valid;
  final int invalid;
  final int duplicates;
  final double estimatedSavingsKm;
  final double estimatedSavingsPct;

  factory ImportSummary.fromJson(Map<String, dynamic> j) => ImportSummary(
        total: (j['total'] as num?)?.toInt() ?? 0,
        valid: (j['valid'] as num?)?.toInt() ?? 0,
        invalid: (j['invalid'] as num?)?.toInt() ?? 0,
        duplicates: (j['duplicates'] as num?)?.toInt() ?? 0,
        estimatedSavingsKm: (j['estimatedSavingsKm'] as num?)?.toDouble() ?? 0,
        estimatedSavingsPct: (j['estimatedSavingsPct'] as num?)?.toDouble() ?? 0,
      );

  @override
  List<Object?> get props => [total, valid, invalid, duplicates, estimatedSavingsKm, estimatedSavingsPct];
}

class ImportBatch extends Equatable {
  const ImportBatch({
    required this.id,
    required this.filename,
    required this.fileType,
    required this.status,
    required this.summary,
    this.createdDeliveries = 0,
    this.routePlanId,
    this.createdAt,
  });

  final String id;
  final String filename;
  final String fileType;
  final ImportBatchStatus status;
  final ImportSummary summary;
  final int createdDeliveries;
  final String? routePlanId;
  final DateTime? createdAt;

  factory ImportBatch.fromJson(Map<String, dynamic> j) => ImportBatch(
        id: (j['id'] as String?) ?? '',
        filename: (j['filename'] as String?) ?? '—',
        fileType: (j['fileType'] as String?) ?? 'csv',
        status: _batchStatus(j['status'] as String?),
        summary: j['summary'] is Map<String, dynamic>
            ? ImportSummary.fromJson(j['summary'] as Map<String, dynamic>)
            : const ImportSummary(),
        createdDeliveries: (j['createdDeliveries'] as num?)?.toInt() ?? 0,
        routePlanId: j['routePlanId'] as String?,
        createdAt: DateTime.tryParse((j['createdAt'] as String?) ?? ''),
      );

  @override
  List<Object?> get props => [id, filename, fileType, status, summary, createdDeliveries, routePlanId, createdAt];
}

class ImportRow extends Equatable {
  const ImportRow({
    required this.index,
    required this.status,
    required this.addressText,
    this.recipient,
    this.priority = 'normal',
    this.geocoded = false,
    this.lowConfidence = false,
    this.errors = const [],
  });

  final int index;
  final ImportRowStatus status;
  final String addressText;
  final String? recipient;
  final String priority;
  final bool geocoded;
  final bool lowConfidence;
  final List<String> errors;

  factory ImportRow.fromJson(Map<String, dynamic> j) => ImportRow(
        index: (j['index'] as num?)?.toInt() ?? 0,
        status: _rowStatus(j['status'] as String?),
        addressText: (j['addressText'] as String?) ?? '',
        recipient: j['recipient'] as String?,
        priority: (j['priority'] as String?) ?? 'normal',
        geocoded: j['geocoded'] as bool? ?? false,
        lowConfidence: j['lowConfidence'] as bool? ?? false,
        errors: (j['errors'] as List?)?.whereType<String>().toList() ?? const [],
      );

  @override
  List<Object?> get props => [index, status, addressText, recipient, priority, geocoded, lowConfidence, errors];
}

/// Resultado de /imports/preview e /imports/:id (lote + linhas).
class ImportPreview extends Equatable {
  const ImportPreview({required this.batch, required this.rows});

  final ImportBatch batch;
  final List<ImportRow> rows;

  factory ImportPreview.fromJson(Map<String, dynamic> j) => ImportPreview(
        batch: j['batch'] is Map<String, dynamic>
            ? ImportBatch.fromJson(j['batch'] as Map<String, dynamic>)
            : const ImportBatch(id: '', filename: '—', fileType: 'csv', status: ImportBatchStatus.preview, summary: ImportSummary()),
        rows: (j['rows'] as List?)?.whereType<Map<String, dynamic>>().map(ImportRow.fromJson).toList() ?? const [],
      );

  @override
  List<Object?> get props => [batch, rows];
}

/// Resultado de /imports/:id/confirm.
class ImportConfirmation extends Equatable {
  const ImportConfirmation({required this.createdDeliveries, this.routePlanId});

  final int createdDeliveries;
  final String? routePlanId;

  factory ImportConfirmation.fromJson(Map<String, dynamic> j) => ImportConfirmation(
        createdDeliveries: (j['createdDeliveries'] as num?)?.toInt() ?? 0,
        routePlanId: j['routePlanId'] as String?,
      );

  @override
  List<Object?> get props => [createdDeliveries, routePlanId];
}
