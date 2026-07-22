import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/error/failure.dart';
import '../data/finance_repository.dart';
import '../domain/finance_models.dart';
import '../domain/insights_models.dart';

enum FinanceStatus { loading, ready, error }

class FinanceState extends Equatable {
  const FinanceState({
    this.status = FinanceStatus.loading,
    this.summary = const FinancialSummary(),
    this.entries = const [],
    this.insights = const DeliveryInsights(),
    this.busy = false,
    this.error,
  });

  final FinanceStatus status;
  final FinancialSummary summary;
  final List<FinancialEntry> entries;
  final DeliveryInsights insights;
  final bool busy;
  final String? error;

  FinanceState copyWith({
    FinanceStatus? status,
    FinancialSummary? summary,
    List<FinancialEntry>? entries,
    DeliveryInsights? insights,
    bool? busy,
    String? error,
    bool clearError = false,
  }) {
    return FinanceState(
      status: status ?? this.status,
      summary: summary ?? this.summary,
      entries: entries ?? this.entries,
      insights: insights ?? this.insights,
      busy: busy ?? this.busy,
      error: clearError ? null : (error ?? this.error),
    );
  }

  @override
  List<Object?> get props => [status, summary, entries, insights, busy, error];
}

/// Gerencia as finanças do motorista (FASE 3, F1b). `load` carrega resumo +
/// lançamentos (tela completa); `loadSummary` só o resumo (card do painel).
class FinanceCubit extends Cubit<FinanceState> {
  FinanceCubit(this._repository) : super(const FinanceState());

  final FinanceRepository _repository;

  Future<void> load() async {
    emit(const FinanceState(status: FinanceStatus.loading));
    try {
      final summary = await _repository.summary();
      final entries = await _repository.entries();
      final insights = await _repository.insights();
      emit(FinanceState(status: FinanceStatus.ready, summary: summary, entries: entries, insights: insights));
    } on Failure catch (f) {
      emit(FinanceState(status: FinanceStatus.error, error: f.message));
    } catch (_) {
      emit(const FinanceState(status: FinanceStatus.error, error: 'Erro inesperado.'));
    }
  }

  /// Só o resumo — para o card compacto no painel do Motorista.
  Future<void> loadSummary() async {
    try {
      final summary = await _repository.summary();
      emit(state.copyWith(status: FinanceStatus.ready, summary: summary));
    } on Failure catch (f) {
      emit(state.copyWith(status: FinanceStatus.error, error: f.message));
    } catch (_) {
      emit(state.copyWith(status: FinanceStatus.error, error: 'Erro inesperado.'));
    }
  }

  Future<void> addEntry(NewFinancialEntry entry) => _mutate(() => _repository.addEntry(entry));
  Future<void> deleteEntry(String id) => _mutate(() => _repository.deleteEntry(id));

  Future<void> _mutate(Future<void> Function() action) async {
    if (state.busy) return;
    emit(state.copyWith(busy: true, clearError: true));
    try {
      await action();
      final summary = await _repository.summary();
      final entries = await _repository.entries();
      emit(state.copyWith(busy: false, summary: summary, entries: entries));
    } on Failure catch (f) {
      emit(state.copyWith(busy: false, error: f.message));
    } catch (_) {
      emit(state.copyWith(busy: false, error: 'Não foi possível salvar.'));
    }
  }
}
