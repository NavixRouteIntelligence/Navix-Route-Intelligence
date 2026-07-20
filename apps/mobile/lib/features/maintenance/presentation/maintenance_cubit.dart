import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/error/failure.dart';
import '../data/maintenance_repository.dart';
import '../domain/maintenance_models.dart';

enum MaintenanceStatus { loading, ready, empty, error }

class MaintenanceState extends Equatable {
  const MaintenanceState({
    this.status = MaintenanceStatus.loading,
    this.vehicle,
    this.records = const [],
    this.reminders = const [],
    this.busy = false,
    this.error,
  });

  final MaintenanceStatus status;
  final MaintenanceVehicle? vehicle;
  final List<MaintenanceRecord> records;
  final List<MaintenanceReminder> reminders;

  /// Uma mutação (adicionar/apagar/hodômetro) está em andamento.
  final bool busy;
  final String? error;

  MaintenanceState copyWith({
    MaintenanceStatus? status,
    MaintenanceVehicle? vehicle,
    List<MaintenanceRecord>? records,
    List<MaintenanceReminder>? reminders,
    bool? busy,
    String? error,
    bool clearError = false,
  }) {
    return MaintenanceState(
      status: status ?? this.status,
      vehicle: vehicle ?? this.vehicle,
      records: records ?? this.records,
      reminders: reminders ?? this.reminders,
      busy: busy ?? this.busy,
      error: clearError ? null : (error ?? this.error),
    );
  }

  @override
  List<Object?> get props => [status, vehicle, records, reminders, busy, error];
}

/// Gerencia a tela de manutenção do veículo (FASE 3, V3). Carrega veículo +
/// registros + lembretes e aplica mutações, recarregando os derivados.
class MaintenanceCubit extends Cubit<MaintenanceState> {
  MaintenanceCubit(this._repository) : super(const MaintenanceState());

  final MaintenanceRepository _repository;

  Future<void> load() async {
    emit(const MaintenanceState(status: MaintenanceStatus.loading));
    try {
      final vehicle = await _repository.myVehicle();
      if (vehicle == null) {
        emit(const MaintenanceState(status: MaintenanceStatus.empty));
        return;
      }
      final records = await _repository.records(vehicle.id);
      final reminders = await _repository.reminders(vehicle.id);
      emit(MaintenanceState(
        status: MaintenanceStatus.ready,
        vehicle: vehicle,
        records: records,
        reminders: reminders,
      ));
    } on Failure catch (f) {
      emit(MaintenanceState(status: MaintenanceStatus.error, error: f.message));
    } catch (_) {
      emit(const MaintenanceState(status: MaintenanceStatus.error, error: 'Erro inesperado.'));
    }
  }

  Future<void> addRecord(NewMaintenanceRecord record) => _mutate(
        (vehicleId) => _repository.addRecord(vehicleId, record),
      );

  Future<void> deleteRecord(String id) => _mutate(
        (vehicleId) => _repository.deleteRecord(vehicleId, id),
      );

  Future<void> updateOdometer(int odometerKm) => _mutate(
        (vehicleId) => _repository.updateOdometer(vehicleId, odometerKm),
      );

  /// Executa a mutação e recarrega registros + lembretes (a rota muda). Erros
  /// viram mensagem sem perder os dados atuais.
  Future<void> _mutate(Future<void> Function(String vehicleId) action) async {
    final vehicle = state.vehicle;
    if (vehicle == null || state.busy) return;
    emit(state.copyWith(busy: true, clearError: true));
    try {
      await action(vehicle.id);
      final records = await _repository.records(vehicle.id);
      final reminders = await _repository.reminders(vehicle.id);
      final refreshed = await _repository.myVehicle();
      emit(state.copyWith(
        busy: false,
        records: records,
        reminders: reminders,
        vehicle: refreshed ?? vehicle,
      ));
    } on Failure catch (f) {
      emit(state.copyWith(busy: false, error: f.message));
    } catch (_) {
      emit(state.copyWith(busy: false, error: 'Não foi possível salvar.'));
    }
  }
}
