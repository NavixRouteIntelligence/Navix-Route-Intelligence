import 'package:dio/dio.dart';

import '../../../core/network/dio_failure_mapper.dart';
import '../domain/finance_models.dart';
import '../domain/insights_models.dart';

/// Acesso ao ledger financeiro (FASE 3): resumo (custo/km, lucro/entrega) e
/// lançamentos. Lança [Failure] tipado em erro de rede/servidor.
class FinanceRepository {
  FinanceRepository(this._dio);

  final Dio _dio;

  Future<FinancialSummary> summary() async {
    try {
      final res = await _dio.get<dynamic>('/finance/summary');
      final data = res.data is Map<String, dynamic> ? (res.data as Map<String, dynamic>)['data'] : null;
      return data is Map<String, dynamic> ? FinancialSummary.fromJson(data) : const FinancialSummary();
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<DeliveryInsights> insights() async {
    try {
      final res = await _dio.get<dynamic>('/deliveries/insights');
      final data = res.data is Map<String, dynamic> ? (res.data as Map<String, dynamic>)['data'] : null;
      return data is Map<String, dynamic> ? DeliveryInsights.fromJson(data) : const DeliveryInsights();
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<List<FinancialEntry>> entries() async {
    try {
      final res = await _dio.get<dynamic>('/finance/entries');
      final data = res.data is Map<String, dynamic> ? (res.data as Map<String, dynamic>)['data'] : null;
      if (data is! List) return const [];
      return data.whereType<Map<String, dynamic>>().map(FinancialEntry.fromJson).toList();
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<void> addEntry(NewFinancialEntry entry) async {
    try {
      await _dio.post<dynamic>('/finance/entries', data: entry.toJson());
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<void> deleteEntry(String id) async {
    try {
      await _dio.delete<dynamic>('/finance/entries/$id');
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }
}
