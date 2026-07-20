import 'package:equatable/equatable.dart';

/// Veículo do motorista (subconjunto do contrato) para a tela de manutenção.
class MaintenanceVehicle extends Equatable {
  const MaintenanceVehicle({
    required this.id,
    required this.plate,
    required this.type,
    this.odometerKm,
  });

  final String id;
  final String plate;
  final String type;
  final int? odometerKm;

  factory MaintenanceVehicle.fromJson(Map<String, dynamic> j) => MaintenanceVehicle(
        id: (j['id'] as String?) ?? '',
        plate: (j['plate'] as String?) ?? '',
        type: (j['type'] as String?) ?? 'car',
        odometerKm: (j['odometerKm'] as num?)?.toInt(),
      );

  @override
  List<Object?> get props => [id, plate, type, odometerKm];
}

/// Registro de manutenção. `type` ∈ oil_change/revision/tires/insurance/inspection/ipo/other.
class MaintenanceRecord extends Equatable {
  const MaintenanceRecord({
    required this.id,
    required this.type,
    required this.performedAt,
    this.odometerKm,
    this.cost,
    this.notes,
    this.nextDueDate,
    this.nextDueOdometerKm,
  });

  final String id;
  final String type;
  final String performedAt; // ISO date
  final int? odometerKm;
  final double? cost;
  final String? notes;
  final String? nextDueDate;
  final int? nextDueOdometerKm;

  factory MaintenanceRecord.fromJson(Map<String, dynamic> j) => MaintenanceRecord(
        id: (j['id'] as String?) ?? '',
        type: (j['type'] as String?) ?? 'other',
        performedAt: (j['performedAt'] as String?) ?? '',
        odometerKm: (j['odometerKm'] as num?)?.toInt(),
        cost: (j['cost'] as num?)?.toDouble(),
        notes: j['notes'] as String?,
        nextDueDate: j['nextDueDate'] as String?,
        nextDueOdometerKm: (j['nextDueOdometerKm'] as num?)?.toInt(),
      );

  @override
  List<Object?> get props =>
      [id, type, performedAt, odometerKm, cost, notes, nextDueDate, nextDueOdometerKm];
}

/// Lembrete de vencimento derivado no backend. `status` ∈ overdue/due_soon/ok.
class MaintenanceReminder extends Equatable {
  const MaintenanceReminder({
    required this.type,
    required this.status,
    this.remainingDays,
    this.remainingKm,
    this.dueDate,
    this.dueOdometerKm,
  });

  final String type;
  final String status;
  final int? remainingDays;
  final int? remainingKm;
  final String? dueDate;
  final int? dueOdometerKm;

  bool get isOverdue => status == 'overdue';
  bool get isDueSoon => status == 'due_soon';

  factory MaintenanceReminder.fromJson(Map<String, dynamic> j) => MaintenanceReminder(
        type: (j['type'] as String?) ?? 'other',
        status: (j['status'] as String?) ?? 'ok',
        remainingDays: (j['remainingDays'] as num?)?.toInt(),
        remainingKm: (j['remainingKm'] as num?)?.toInt(),
        dueDate: j['dueDate'] as String?,
        dueOdometerKm: (j['dueOdometerKm'] as num?)?.toInt(),
      );

  @override
  List<Object?> get props => [type, status, remainingDays, remainingKm, dueDate, dueOdometerKm];
}

/// Payload para criar um registro de manutenção.
class NewMaintenanceRecord {
  const NewMaintenanceRecord({
    required this.type,
    required this.performedAt,
    this.odometerKm,
    this.cost,
    this.notes,
    this.nextDueDate,
    this.nextDueOdometerKm,
  });

  final String type;
  final String performedAt; // ISO date
  final int? odometerKm;
  final double? cost;
  final String? notes;
  final String? nextDueDate;
  final int? nextDueOdometerKm;

  Map<String, dynamic> toJson() => {
        'type': type,
        'performedAt': performedAt,
        if (odometerKm != null) 'odometerKm': odometerKm,
        if (cost != null) 'cost': cost,
        if (notes != null && notes!.trim().isNotEmpty) 'notes': notes!.trim(),
        if (nextDueDate != null) 'nextDueDate': nextDueDate,
        if (nextDueOdometerKm != null) 'nextDueOdometerKm': nextDueOdometerKm,
      };
}
