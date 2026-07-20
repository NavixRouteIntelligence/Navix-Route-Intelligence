import 'package:equatable/equatable.dart';

/// Lançamento do ledger financeiro. `type` ∈ income/expense; `category` ∈
/// fuel/maintenance/toll/delivery/other.
class FinancialEntry extends Equatable {
  const FinancialEntry({
    required this.id,
    required this.type,
    required this.category,
    required this.amount,
    required this.occurredAt,
    this.odometerKm,
    this.liters,
    this.notes,
  });

  final String id;
  final String type;
  final String category;
  final double amount;
  final String occurredAt; // ISO date
  final int? odometerKm;
  final double? liters;
  final String? notes;

  bool get isIncome => type == 'income';

  factory FinancialEntry.fromJson(Map<String, dynamic> j) => FinancialEntry(
        id: (j['id'] as String?) ?? '',
        type: (j['type'] as String?) ?? 'expense',
        category: (j['category'] as String?) ?? 'other',
        amount: (j['amount'] as num?)?.toDouble() ?? 0,
        occurredAt: (j['occurredAt'] as String?) ?? '',
        odometerKm: (j['odometerKm'] as num?)?.toInt(),
        liters: (j['liters'] as num?)?.toDouble(),
        notes: j['notes'] as String?,
      );

  @override
  List<Object?> get props => [id, type, category, amount, occurredAt, odometerKm, liters, notes];
}

/// Resumo financeiro do período (custo/km e lucro/entrega derivados no backend).
class FinancialSummary extends Equatable {
  const FinancialSummary({
    this.totalIncome = 0,
    this.totalExpense = 0,
    this.balance = 0,
    this.distanceKm,
    this.costPerKm,
    this.deliveries = 0,
    this.profitPerDelivery,
  });

  final double totalIncome;
  final double totalExpense;
  final double balance;
  final double? distanceKm;
  final double? costPerKm;
  final int deliveries;
  final double? profitPerDelivery;

  factory FinancialSummary.fromJson(Map<String, dynamic> j) => FinancialSummary(
        totalIncome: (j['totalIncome'] as num?)?.toDouble() ?? 0,
        totalExpense: (j['totalExpense'] as num?)?.toDouble() ?? 0,
        balance: (j['balance'] as num?)?.toDouble() ?? 0,
        distanceKm: (j['distanceKm'] as num?)?.toDouble(),
        costPerKm: (j['costPerKm'] as num?)?.toDouble(),
        deliveries: (j['deliveries'] as num?)?.toInt() ?? 0,
        profitPerDelivery: (j['profitPerDelivery'] as num?)?.toDouble(),
      );

  @override
  List<Object?> get props =>
      [totalIncome, totalExpense, balance, distanceKm, costPerKm, deliveries, profitPerDelivery];
}

/// Payload para criar um lançamento.
class NewFinancialEntry {
  const NewFinancialEntry({
    required this.type,
    required this.category,
    required this.amount,
    required this.occurredAt,
    this.odometerKm,
    this.liters,
    this.notes,
  });

  final String type;
  final String category;
  final double amount;
  final String occurredAt;
  final int? odometerKm;
  final double? liters;
  final String? notes;

  Map<String, dynamic> toJson() => {
        'type': type,
        'category': category,
        'amount': amount,
        'occurredAt': occurredAt,
        if (odometerKm != null) 'odometerKm': odometerKm,
        if (liters != null) 'liters': liters,
        if (notes != null && notes!.trim().isNotEmpty) 'notes': notes!.trim(),
      };
}
