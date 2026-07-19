import 'package:dio/dio.dart';

import '../../../core/error/failure.dart';
import '../../../core/network/dio_failure_mapper.dart';
import '../domain/optimizer_models.dart';

/// Escopo da otimização — define o endpoint por papel (ADR-0060):
///  - [company]: `POST /route-plans` (admin/dispatcher).
///  - [mine]: `POST /route-plans/mine` (driver). Contrato idêntico ao da empresa;
///    só muda o papel exigido no backend.
enum OptimizerScope { company, mine }

extension on OptimizerScope {
  String get path => this == OptimizerScope.mine ? '/route-plans/mine' : '/route-plans';
}

/// Acesso ao Route Optimizer (/route-plans) e às entregas a otimizar.
class OptimizerRepository {
  OptimizerRepository(this._dio);

  final Dio _dio;

  /// Otimização é **assíncrona** no backend (202 + jobId). O motor enfileira o
  /// job; aqui fazemos o poll até `succeeded` e buscamos o plano final. Sem esse
  /// fluxo, a resposta 202 (`{jobId,status}`) não traz paradas.
  static const _pollAttempts = 40;
  static const _pollInterval = Duration(milliseconds: 500);

  /// Entregas pendentes (candidatas à otimização).
  Future<List<SelectableDelivery>> pendingDeliveries() async {
    try {
      final res = await _dio.get<dynamic>('/deliveries', queryParameters: {'status': 'pending', 'pageSize': 100});
      final data = res.data is Map<String, dynamic> ? (res.data as Map<String, dynamic>)['data'] : null;
      if (data is! List) return const [];
      return data.whereType<Map<String, dynamic>>().map(_toSelectable).toList();
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  /// Otimiza a rota com as entregas escolhidas. [scope] escolhe o endpoint por
  /// papel (empresa × motorista) — o fluxo é o mesmo, não se duplica nada.
  /// Enfileira → aguarda o job → devolve o plano com as paradas ordenadas.
  Future<RoutePlanResult> optimize({
    required List<String> deliveryIds,
    double? averageSpeedKmh,
    double? serviceTimeMinutes,
    OptimizerScope scope = OptimizerScope.company,
  }) async {
    try {
      final res = await _dio.post<dynamic>(scope.path, data: {
        'deliveryIds': deliveryIds,
        if (averageSpeedKmh != null) 'averageSpeedKmh': averageSpeedKmh,
        if (serviceTimeMinutes != null) 'serviceTimeMinutes': serviceTimeMinutes,
      });
      final jobId = _dataOf(res)['jobId'] as String? ?? '';
      if (jobId.isEmpty) throw const ServerFailure('Resposta de otimização sem jobId.');
      final planId = await _awaitPlan(jobId);
      return await _fetchPlan(planId);
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  /// Poll do job até um estado terminal. Lança [Failure] em falha/timeout —
  /// nada de exceção crua para a UI.
  Future<String> _awaitPlan(String jobId) async {
    for (var attempt = 0; attempt < _pollAttempts; attempt++) {
      final res = await _dio.get<dynamic>('/route-plans/jobs/$jobId');
      final data = _dataOf(res);
      switch (data['status'] as String?) {
        case 'succeeded':
          final planId = data['routePlanId'] as String?;
          if (planId != null && planId.isNotEmpty) return planId;
          throw const ServerFailure('Otimização concluída sem plano.');
        case 'failed':
          throw ServerFailure((data['error'] as String?) ?? 'A otimização falhou.');
        default:
          await Future<void>.delayed(_pollInterval);
      }
    }
    throw const ServerFailure('A otimização demorou mais que o esperado. Tente de novo.');
  }

  Future<RoutePlanResult> _fetchPlan(String id) async {
    final res = await _dio.get<dynamic>('/route-plans/$id');
    return RoutePlanResult.fromJson(_dataOf(res));
  }

  Map<String, dynamic> _dataOf(Response<dynamic> res) {
    final body = res.data;
    if (body is Map<String, dynamic> && body['data'] is Map<String, dynamic>) {
      return body['data'] as Map<String, dynamic>;
    }
    return const {};
  }

  SelectableDelivery _toSelectable(Map<String, dynamic> d) {
    final addr = d['address'] is Map<String, dynamic> ? d['address'] as Map<String, dynamic> : const {};
    final street = (addr['street'] as String?) ?? '';
    final number = (addr['number'] as String?) ?? '';
    final city = (addr['city'] as String?) ?? '';
    final state = (addr['state'] as String?) ?? '';
    final lat = (addr['latitude'] as num?)?.toDouble();
    final lng = (addr['longitude'] as num?)?.toDouble();
    return SelectableDelivery(
      id: (d['id'] as String?) ?? '',
      addressLine: [street, number].where((s) => s.isNotEmpty).join(', '),
      cityLine: [city, state].where((s) => s.isNotEmpty).join(' — '),
      priority: (d['priority'] as String?) ?? 'normal',
      geocoded: lat != null && lng != null && !(lat == 0 && lng == 0),
    );
  }
}
