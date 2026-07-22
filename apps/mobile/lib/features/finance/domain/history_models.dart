import 'package:equatable/equatable.dart';

/// Ponto da série financeira: receita/despesa/saldo do período (FASE 3, F3).
class FinancialHistoryPoint extends Equatable {
  const FinancialHistoryPoint({
    required this.period,
    required this.income,
    required this.expense,
    required this.balance,
  });

  final String period; // 'YYYY-MM' ou 'YYYY-MM-DD'
  final double income;
  final double expense;
  final double balance;

  factory FinancialHistoryPoint.fromJson(Map<String, dynamic> j) => FinancialHistoryPoint(
        period: (j['period'] as String?) ?? '',
        income: (j['income'] as num?)?.toDouble() ?? 0,
        expense: (j['expense'] as num?)?.toDouble() ?? 0,
        balance: (j['balance'] as num?)?.toDouble() ?? 0,
      );

  @override
  List<Object?> get props => [period, income, expense, balance];
}

/// Histórico financeiro por período (do mais antigo ao mais recente).
class FinancialHistory extends Equatable {
  const FinancialHistory({this.granularity = 'month', this.points = const []});

  final String granularity;
  final List<FinancialHistoryPoint> points;

  bool get hasData => points.isNotEmpty;

  factory FinancialHistory.fromJson(Map<String, dynamic> j) => FinancialHistory(
        granularity: (j['granularity'] as String?) ?? 'month',
        points: (j['points'] as List?)?.whereType<Map<String, dynamic>>().map(FinancialHistoryPoint.fromJson).toList() ?? const [],
      );

  @override
  List<Object?> get props => [granularity, points];
}
