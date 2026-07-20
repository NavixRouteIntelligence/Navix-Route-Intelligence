import 'package:dio/dio.dart';

import '../../../core/network/dio_failure_mapper.dart';
import '../domain/driver_dashboard_data.dart';

/// Agrega os endpoints com escopo de motorista para o painel do Motorista.
/// Fontes reais: /tracking/me/latest, /deliveries, /pod/summary, /route-plans.
/// Lança [Failure] em erro de rede/servidor.
class DriverDashboardRepository {
  DriverDashboardRepository(this._dio);

  final Dio _dio;

  static const _activeStatuses = {'pending', 'in_route'};

  Future<DriverDashboardData> load() async {
    try {
      final deliveries = _map(await _dio.get<dynamic>('/deliveries', queryParameters: {'pageSize': 100, 'sort': 'createdAt'}));
      final tracking = _map(await _dio.get<dynamic>('/tracking/me/latest'));
      final pod = _map(await _dio.get<dynamic>('/pod/summary'));
      final plans = _map(await _dio.get<dynamic>('/route-plans', queryParameters: {'pageSize': 1}));

      final items = _items(deliveries);
      final delivered = items.where((d) => d['status'] == 'delivered').length;
      final plan = _items(plans).isNotEmpty ? _items(plans).first : null;
      final (first, last) = _journey(items);

      return DriverDashboardData(
        total: _metaTotal(deliveries),
        delivered: delivered,
        next: _nextDelivery(items),
        tracking: _tracking(tracking),
        podToday: (pod['total'] as num?)?.toInt() ?? 0,
        first: first,
        last: last,
        score: plan == null ? null : (plan['score'] as num?)?.toInt(),
        savedKm: _planDouble(plan, ['savings', 'distanceKm']),
        avgSavingsPct: _planDouble(plan, ['savings', 'distancePct']),
        remainingMinutes: plan == null ? null : _planDouble(plan, ['metrics', 'totalTimeMinutes'])?.round(),
        remainingKm: _planDouble(plan, ['metrics', 'totalDistanceKm']),
      );
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Map<String, dynamic> _map(Response<dynamic> res) =>
      res.data is Map<String, dynamic> ? res.data as Map<String, dynamic> : const {};

  int _metaTotal(Map<String, dynamic> json) {
    final meta = json['meta'];
    return meta is Map<String, dynamic> ? (meta['total'] as num?)?.toInt() ?? 0 : 0;
  }

  List<Map<String, dynamic>> _items(Map<String, dynamic> json) {
    final data = json['data'];
    return data is List ? data.whereType<Map<String, dynamic>>().toList() : const [];
  }

  double? _planDouble(Map<String, dynamic>? plan, List<String> path) {
    if (plan == null) return null;
    dynamic node = plan;
    for (final key in path) {
      if (node is Map<String, dynamic>) {
        node = node[key];
      } else {
        return null;
      }
    }
    return (node as num?)?.toDouble();
  }

  /// Abertura da janela de horário de uma entrega (ou null).
  DateTime? _windowStart(Map<String, dynamic> d) {
    final w = d['timeWindow'];
    final s = w is Map<String, dynamic> ? w['start'] as String? : null;
    return s == null ? null : DateTime.tryParse(s);
  }

  /// Próxima entrega ativa, ordenada pela abertura da janela de horário.
  DriverDelivery? _nextDelivery(List<Map<String, dynamic>> items) {
    final active = items.where((d) => _activeStatuses.contains(d['status'])).toList();
    if (active.isEmpty) return null;

    active.sort((a, b) {
      final sa = _windowStart(a), sb = _windowStart(b);
      if (sa == null && sb == null) return 0;
      if (sa == null) return 1;
      if (sb == null) return -1;
      return sa.compareTo(sb);
    });

    return _delivery(active.first);
  }

  /// Primeira e última paradas da jornada de hoje, pela janela de horário.
  /// Considera todas as entregas (entregues inclusive) para emoldurar o dia.
  /// Retorna (null, null) sem janelas; `last` fica null quando há só uma parada.
  (DriverDelivery?, DriverDelivery?) _journey(List<Map<String, dynamic>> items) {
    final withWindow = items.where((d) => _windowStart(d) != null).toList()
      ..sort((a, b) => _windowStart(a)!.compareTo(_windowStart(b)!));
    if (withWindow.isEmpty) return (null, null);
    final first = _delivery(withWindow.first);
    final last = withWindow.length > 1 ? _delivery(withWindow.last) : null;
    return (first, last);
  }

  DriverDelivery _delivery(Map<String, dynamic> d) {
    final addr = d['address'] is Map<String, dynamic> ? d['address'] as Map<String, dynamic> : const {};
    final w = d['timeWindow'] is Map<String, dynamic> ? d['timeWindow'] as Map<String, dynamic> : const {};
    final street = (addr['street'] as String?) ?? '';
    final number = (addr['number'] as String?) ?? '';
    final city = (addr['city'] as String?) ?? '';
    final state = (addr['state'] as String?) ?? '';
    return DriverDelivery(
      id: (d['id'] as String?) ?? '',
      addressLine: [street, number].where((s) => s.isNotEmpty).join(', '),
      cityLine: [city, state].where((s) => s.isNotEmpty).join(' — '),
      priority: (d['priority'] as String?) ?? 'normal',
      status: (d['status'] as String?) ?? 'pending',
      windowStart: DateTime.tryParse((w['start'] as String?) ?? ''),
      windowEnd: DateTime.tryParse((w['end'] as String?) ?? ''),
      latitude: (addr['latitude'] as num?)?.toDouble(),
      longitude: (addr['longitude'] as num?)?.toDouble(),
    );
  }

  DriverTracking _tracking(Map<String, dynamic> json) {
    final data = json['data'];
    if (data is! Map<String, dynamic>) return const DriverTracking();
    return DriverTracking(
      speedKmh: (data['speed'] as num?)?.toDouble(),
      recordedAt: DateTime.tryParse((data['recordedAt'] as String?) ?? ''),
      status: (data['status'] as String?) ?? 'offline',
    );
  }
}
