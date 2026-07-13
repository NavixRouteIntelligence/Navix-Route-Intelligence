import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/error/failure.dart';
import '../data/import_repository.dart';
import '../domain/import_models.dart';

/// Passos do fluxo de importação.
enum ImportStep { upload, preview, done }

class ImportState extends Equatable {
  const ImportState({
    this.step = ImportStep.upload,
    this.busy = false,
    this.optimize = false,
    this.preview,
    this.confirmation,
    this.history = const [],
    this.historyLoading = false,
    this.error,
  });

  final ImportStep step;
  final bool busy; // upload/preview/confirm em andamento
  final bool optimize; // otimizar rota após importar
  final ImportPreview? preview;
  final ImportConfirmation? confirmation;
  final List<ImportBatch> history;
  final bool historyLoading;
  final String? error;

  ImportState copyWith({
    ImportStep? step,
    bool? busy,
    bool? optimize,
    ImportPreview? preview,
    ImportConfirmation? confirmation,
    List<ImportBatch>? history,
    bool? historyLoading,
    String? error,
    bool clearError = false,
  }) {
    return ImportState(
      step: step ?? this.step,
      busy: busy ?? this.busy,
      optimize: optimize ?? this.optimize,
      preview: preview ?? this.preview,
      confirmation: confirmation ?? this.confirmation,
      history: history ?? this.history,
      historyLoading: historyLoading ?? this.historyLoading,
      error: clearError ? null : (error ?? this.error),
    );
  }

  @override
  List<Object?> get props => [step, busy, optimize, preview, confirmation, history, historyLoading, error];
}

class ImportCubit extends Cubit<ImportState> {
  ImportCubit(this._repository) : super(const ImportState());

  final ImportRepository _repository;

  Future<void> loadHistory() async {
    emit(state.copyWith(historyLoading: true, clearError: true));
    try {
      final batches = await _repository.list();
      emit(state.copyWith(history: batches, historyLoading: false));
    } on Failure catch (f) {
      emit(state.copyWith(historyLoading: false, error: f.message));
    } catch (_) {
      emit(state.copyWith(historyLoading: false));
    }
  }

  Future<void> pickAndPreview({required String path, required String filename}) async {
    emit(state.copyWith(busy: true, clearError: true));
    try {
      final preview = await _repository.preview(path: path, filename: filename);
      emit(state.copyWith(busy: false, step: ImportStep.preview, preview: preview));
    } on Failure catch (f) {
      emit(state.copyWith(busy: false, error: f.message));
    } catch (_) {
      emit(state.copyWith(busy: false, error: 'Não foi possível ler o arquivo.'));
    }
  }

  void toggleOptimize(bool value) => emit(state.copyWith(optimize: value));

  Future<void> confirm() async {
    final batch = state.preview?.batch;
    if (batch == null) return;
    emit(state.copyWith(busy: true, clearError: true));
    try {
      final result = await _repository.confirm(batch.id, optimize: state.optimize);
      emit(state.copyWith(busy: false, step: ImportStep.done, confirmation: result));
      await loadHistory();
    } on Failure catch (f) {
      emit(state.copyWith(busy: false, error: f.message));
    } catch (_) {
      emit(state.copyWith(busy: false, error: 'Não foi possível confirmar a importação.'));
    }
  }

  /// Volta ao início para uma nova importação (mantém histórico).
  void reset() {
    emit(ImportState(history: state.history));
  }
}
