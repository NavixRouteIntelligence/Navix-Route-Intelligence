import 'package:dio/dio.dart';

import '../../../core/error/failure.dart';
import '../../../core/network/dio_failure_mapper.dart';
import '../domain/my_route.dart';

/// Como o motorista pediu para reorganizar a rota (ADR-0078).
enum ReorganizeMode {
  /// IA (Recomendado): reotimiza com a estratégia mais forte (`smart`).
  ai,

  /// Manual: preserva exatamente a ordem que o motorista definiu (`manual`).
  manual,
}

/// Lê a rota que a IA preparou e, sob pedido, a reorganiza. A otimização não é
/// mais um botão obrigatório (ADR-0074): acontece sozinha na importação. O
/// "Reorganizar" é a ação secundária — a IA segue como padrão (ADR-0078).
class MyRouteRepository {
  MyRouteRepository(this._dio);

  final Dio _dio;

  /// Mínimo de paradas para existir rota (espelha o backend).
  static const _minStops = 2;

  /// Polling do job de otimização (mesmo backend assíncrono do otimizador).
  static const _pollInterval = Duration(seconds: 1);
  static const _pollTimeout = Duration(seconds: 90);

  /// Reorganiza a rota e **aguarda** o novo plano ficar pronto.
  ///
  /// - [ReorganizeMode.ai]: `smart: true` — a IA reescolhe a ordem.
  /// - [ReorganizeMode.manual]: `strategy: 'manual'` com [order] (deliveryIds na
  ///   sequência escolhida pelo motorista), que o backend preserva.
  ///
  /// Enfileira em `POST /route-plans/mine` (202 + jobId) e faz polling do job
  /// até concluir; quem chama recarrega a rota depois.
  Future<void> reorganize(
    ReorganizeMode mode, {
    required List<String> order,
  }) async {
    try {
      final body = mode == ReorganizeMode.ai
          ? {'deliveryIds': order, 'smart': true}
          : {'deliveryIds': order, 'strategy': 'manual'};
      final res = await _dio.post<dynamic>('/route-plans/mine', data: body);
      final jobId =
          (_map(res)['data'] as Map<String, dynamic>?)?['jobId'] as String?;
      if (jobId != null) await _awaitJob(jobId);
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<void> _awaitJob(String jobId) async {
    final deadline = DateTime.now().add(_pollTimeout);
    while (DateTime.now().isBefore(deadline)) {
      await Future<void>.delayed(_pollInterval);
      final job = _map(
        await _dio.get<dynamic>('/route-plans/jobs/$jobId'),
      )['data'];
      final status =
          job is Map<String, dynamic> ? job['status'] as String? : null;
      if (status == 'succeeded') return;
      if (status == 'failed') {
        throw const ServerFailure('Não foi possível reorganizar a rota.');
      }
    }
    throw const ServerFailure('A reorganização demorou mais que o esperado.');
  }

  Future<MyRoute> load() async {
    try {
      // A rota vigente vem do backend já resolvida para este motorista e para o
      // dia operacional (ADR-0098). Antes daqui saía `/route-plans?pageSize=1`,
      // que é o plano mais recente do **tenant**: numa frota, todo motorista
      // via a rota do último que otimizou. As entregas dão o endereço de cada
      // parada (o plano guarda só coordenadas e a sequência).
      final active = _map(
        await _dio.get<dynamic>('/route-plans/mine/active'),
      );
      final deliveries = _map(
        await _dio.get<dynamic>(
          '/deliveries',
          queryParameters: {'pageSize': 100, 'sort': 'createdAt'},
        ),
      );

      final items = _items(deliveries);
      // `data: null` é a resposta normal de quem ainda não tem rota do dia.
      final data = active['data'];
      final plan = data is Map<String, dynamic> ? data : null;

      if (plan == null) {
        // Sem plano: distinguir "poucas entregas" de "a IA ainda não preparou"
        // muda a mensagem que o motorista vê — e nenhuma das duas é erro dele.
        return items.length >= _minStops
            ? const MyRoute.preparing()
            : const MyRoute.empty();
      }

      final byId = {for (final d in items) (d['id'] as String? ?? ''): d};
      final planStops = (plan['stops'] as List?)
              ?.whereType<Map<String, dynamic>>()
              .toList() ??
          const [];
      final stops = planStops.map((s) => _stop(s, byId)).toList();
      final distanceKm = _nested(plan, ['metrics', 'totalDistanceKm']) ?? 0;
      final timeMinutes = _nested(plan, ['metrics', 'totalTimeMinutes']) ?? 0;
      final savedKm = _nested(plan, ['savings', 'distanceKm']) ?? 0;
      final savedMinutes = _nested(plan, ['savings', 'timeMinutes']) ?? 0;
      final params = plan['params'];
      final vehicleType = params is Map<String, dynamic>
          ? params['vehicleType'] as String?
          : null;

      return MyRoute(
        status: MyRouteStatus.ready,
        totalStops: planStops.length,
        completedStops: stops.where((stop) {
          final status = byId[stop.deliveryId]?['status'] as String?;
          return status == 'delivered' || status == 'failed';
        }).length,
        distanceKm: distanceKm,
        timeMinutes: timeMinutes,
        savedKm: savedKm,
        savedPct: _nested(plan, ['savings', 'distancePct']) ?? 0,
        savedMinutes: savedMinutes,
        savedTimePct: _nested(plan, ['savings', 'timePct']) ?? 0,
        baselineDistanceKm: _nested(plan, ['baseline', 'totalDistanceKm']) ??
            distanceKm + savedKm,
        baselineTimeMinutes: _nested(plan, ['baseline', 'totalTimeMinutes']) ??
            timeMinutes + savedMinutes,
        vehicleType: vehicleType,
        updatedAt: DateTime.tryParse(
          plan['createdAt'] as String? ?? '',
        )?.toLocal(),
        groups: (plan['groups'] as List?)
                ?.whereType<Map<String, dynamic>>()
                .map(RouteGroup.fromJson)
                .toList() ??
            const [],
        stops: stops,
        next: _nextDelivery(stops, byId),
      );
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  /// A primeira parada da rota cuja entrega ainda não foi concluída — o alvo do
  /// "Registrar entrega". Percorre em ordem de sequência (as paradas já vêm
  /// ordenadas do plano).
  NextDelivery? _nextDelivery(
    List<RouteStopInfo> stops,
    Map<String, Map<String, dynamic>> byId,
  ) {
    for (final s in stops) {
      final status = byId[s.deliveryId]?['status'] as String?;
      if (status != 'delivered' && status != 'failed') {
        final label = s.addressLine.isEmpty ? s.cityLine : s.addressLine;
        return NextDelivery(id: s.deliveryId, label: label);
      }
    }
    return null;
  }

  RouteStopInfo _stop(
    Map<String, dynamic> stop,
    Map<String, Map<String, dynamic>> byId,
  ) {
    final id = stop['deliveryId'] as String? ?? '';
    final delivery = byId[id];
    final address = delivery?['address'];
    final a =
        address is Map<String, dynamic> ? address : const <String, dynamic>{};
    final street = (a['street'] as String?) ?? '';
    final number = (a['number'] as String?) ?? '';
    final city = (a['city'] as String?) ?? '';
    final state = (a['state'] as String?) ?? '';

    return RouteStopInfo(
      sequence: (stop['sequence'] as num?)?.toInt() ?? 0,
      deliveryId: id,
      addressLine: [street, number].where((p) => p.isNotEmpty).join(', '),
      cityLine: [city, state].where((p) => p.isNotEmpty).join(' — '),
      etaMinutes: (stop['etaMinutes'] as num?)?.toDouble() ?? 0,
      latitude: (stop['latitude'] as num?)?.toDouble(),
      longitude: (stop['longitude'] as num?)?.toDouble(),
    );
  }

  double? _nested(Map<String, dynamic> root, List<String> path) {
    dynamic current = root;
    for (final key in path) {
      if (current is! Map<String, dynamic>) return null;
      current = current[key];
    }
    return (current as num?)?.toDouble();
  }

  Map<String, dynamic> _map(Response<dynamic> res) =>
      res.data is Map<String, dynamic>
          ? res.data as Map<String, dynamic>
          : const {};

  List<Map<String, dynamic>> _items(Map<String, dynamic> body) =>
      (body['data'] as List?)?.whereType<Map<String, dynamic>>().toList() ??
      const [];
}
