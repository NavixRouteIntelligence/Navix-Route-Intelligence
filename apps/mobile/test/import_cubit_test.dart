import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:navix_mobile/core/error/failure.dart';
import 'package:navix_mobile/features/imports/data/import_repository.dart';
import 'package:navix_mobile/features/imports/domain/import_models.dart';
import 'package:navix_mobile/features/imports/presentation/import_cubit.dart';

class _MockRepo extends Mock implements ImportRepository {}

void main() {
  late _MockRepo repo;

  const preview = ImportPreview(
    batch: ImportBatch(
      id: 'batch-1',
      filename: 'rotas.csv',
      fileType: 'csv',
      status: ImportBatchStatus.preview,
      summary: ImportSummary(total: 10, valid: 8, invalid: 1, duplicates: 1, estimatedSavingsKm: 12, estimatedSavingsPct: 15),
    ),
    rows: [
      ImportRow(index: 0, status: ImportRowStatus.valid, addressText: 'Rua A, 100'),
      ImportRow(index: 1, status: ImportRowStatus.invalid, addressText: '', errors: ['Endereço vazio']),
    ],
  );

  const confirmation = ImportConfirmation(createdDeliveries: 8, routePlanId: 'plan-1');
  const history = [
    ImportBatch(id: 'batch-1', filename: 'rotas.csv', fileType: 'csv', status: ImportBatchStatus.imported, summary: ImportSummary(total: 10, valid: 8)),
  ];

  setUp(() => repo = _MockRepo());

  blocTest<ImportCubit, ImportState>(
    'pickAndPreview: busy → passo preview com dados',
    build: () {
      when(() => repo.preview(path: any(named: 'path'), filename: any(named: 'filename'))).thenAnswer((_) async => preview);
      return ImportCubit(repo);
    },
    act: (c) => c.pickAndPreview(path: '/tmp/rotas.csv', filename: 'rotas.csv'),
    expect: () => [
      const ImportState(busy: true),
      const ImportState(step: ImportStep.preview, preview: preview),
    ],
  );

  blocTest<ImportCubit, ImportState>(
    'confirm com sucesso: vai para done e recarrega histórico',
    build: () {
      when(() => repo.confirm('batch-1')).thenAnswer((_) async => confirmation);
      when(() => repo.list(pageSize: any(named: 'pageSize'))).thenAnswer((_) async => history);
      return ImportCubit(repo);
    },
    seed: () => const ImportState(step: ImportStep.preview, preview: preview),
    act: (c) => c.confirm(),
    expect: () => [
      const ImportState(step: ImportStep.preview, preview: preview, busy: true),
      const ImportState(step: ImportStep.done, preview: preview, confirmation: confirmation),
      const ImportState(step: ImportStep.done, preview: preview, confirmation: confirmation, historyLoading: true),
      const ImportState(step: ImportStep.done, preview: preview, confirmation: confirmation, history: history),
    ],
  );

  blocTest<ImportCubit, ImportState>(
    'loadHistory com falha: mensagem de erro',
    build: () {
      when(() => repo.list(pageSize: any(named: 'pageSize'))).thenThrow(const NetworkFailure());
      return ImportCubit(repo);
    },
    act: (c) => c.loadHistory(),
    expect: () => const [
      ImportState(historyLoading: true),
      ImportState(error: 'Sem conexão com o servidor.'),
    ],
  );
}
