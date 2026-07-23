import 'package:dio/dio.dart';

import '../../../core/network/dio_failure_mapper.dart';
import '../domain/my_route.dart';

/// Lê a rota que a IA preparou. Não dispara otimização: desde a ADR-0074 ela
/// acontece sozinha na confirmação da importação — aqui só se consulta o
/// resultado.
class MyRouteRepository {
  MyRouteRepository(this._dio);

  final Dio _dio;

  /// Mínimo de paradas para existir rota (espelha o backend).
  static const _minStops = 2;

  Future<MyRoute> load() async {
    try {
      // O plano mais recente é a rota vigente; as entregas dão o endereço de
      // cada parada (o plano guarda só coordenadas e a sequência).
      final plans = _map(await _dio.get<dynamic>('/route-plans', queryParameters: {'pageSize': 1}));
      final deliveries =
          _map(await _dio.get<dynamic>('/deliveries', queryParameters: {'pageSize': 100, 'sort': 'createdAt'}));

      final items = _items(deliveries);
      final plan = _items(plans).isNotEmpty ? _items(plans).first : null;

      if (plan == null) {
        // Sem plano: distinguir "poucas entregas" de "a IA ainda não preparou"
        // muda a mensagem que o motorista vê — e nenhuma das duas é erro dele.
        return items.length >= _minStops ? const MyRoute.preparing() : const MyRoute.empty();
      }

      final byId = {for (final d in items) (d['id'] as String? ?? ''): d};
      final planStops = (plan['stops'] as List?)?.whereType<Map<String, dynamic>>().toList() ?? const [];

      return MyRoute(
        status: MyRouteStatus.ready,
        totalStops: planStops.length,
        distanceKm: _nested(plan, ['metrics', 'totalDistanceKm']) ?? 0,
        timeMinutes: _nested(plan, ['metrics', 'totalTimeMinutes']) ?? 0,
        savedKm: _nested(plan, ['savings', 'distanceKm']) ?? 0,
        savedPct: _nested(plan, ['savings', 'distancePct']) ?? 0,
        updatedAt: DateTime.tryParse(plan['createdAt'] as String? ?? '')?.toLocal(),
        groups: (plan['groups'] as List?)?.whereType<Map<String, dynamic>>().map(RouteGroup.fromJson).toList() ??
            const [],
        stops: planStops.map((s) => _stop(s, byId)).toList(),
      );
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  RouteStopInfo _stop(Map<String, dynamic> stop, Map<String, Map<String, dynamic>> byId) {
    final id = stop['deliveryId'] as String? ?? '';
    final delivery = byId[id];
    final address = delivery?['address'];
    final a = address is Map<String, dynamic> ? address : const <String, dynamic>{};
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
      res.data is Map<String, dynamic> ? res.data as Map<String, dynamic> : const {};

  List<Map<String, dynamic>> _items(Map<String, dynamic> body) =>
      (body['data'] as List?)?.whereType<Map<String, dynamic>>().toList() ?? const [];
}
