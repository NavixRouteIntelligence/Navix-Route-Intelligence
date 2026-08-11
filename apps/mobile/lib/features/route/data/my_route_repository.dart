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
      // Uma leitura só (ADR-0127). Antes daqui saíam duas chamadas — o plano
      // mais `/deliveries?pageSize=100&sort=createdAt` — que o app cruzava em
      // memória. Uma parada fora dessa página perdia morada e estado, a
      // ordenação era do tenant e não da rota, e o progresso vinha de dois
      // instantes diferentes. Este endpoint devolve as paradas com morada,
      // estado, prioridade e o `nextDeliveryId` já derivados no servidor.
      final current = _map(
        await _dio.get<dynamic>('/route-plans/mine/current'),
      );

      // `data: null` é a resposta normal de quem ainda não tem rota do dia.
      final data = current['data'];
      final plan = data is Map<String, dynamic> ? data : null;

      if (plan == null) {
        // Sem plano: distinguir "poucas entregas" de "a IA ainda não preparou"
        // muda a mensagem que o motorista vê — e nenhuma das duas é erro dele.
        // Só aqui vale a pena contar entregas; no caminho normal ninguém conta.
        return await _withoutPlan();
      }

      final planStops = (plan['stops'] as List?)
              ?.whereType<Map<String, dynamic>>()
              .toList() ??
          const [];
      final stops = planStops.map(_stop).toList();
      final distanceKm = _nested(plan, ['metrics', 'totalDistanceKm']) ?? 0;
      final timeMinutes = _nested(plan, ['metrics', 'totalTimeMinutes']) ?? 0;
      final savedKm = _nested(plan, ['savings', 'distanceKm']) ?? 0;
      final savedMinutes = _nested(plan, ['savings', 'timeMinutes']) ?? 0;
      final params = plan['params'];
      final vehicleType = params is Map<String, dynamic>
          ? params['vehicleType'] as String?
          : null;

      // Entregas fora da rota (ADR-0110): o motorista vê o aviso antes de sair.
      final unassigned = (plan['unassignedStops'] as List?)
              ?.whereType<Map<String, dynamic>>()
              .map(UnassignedStop.fromJson)
              .toList() ??
          const <UnassignedStop>[];

      return MyRoute(
        status: MyRouteStatus.ready,
        unassigned: unassigned,
        // O progresso vem derivado do servidor. Recontá-lo aqui daria dois
        // números que discordam quando a resposta é de um instante e a
        // contagem de outro — e o motorista veria «3 de 8» ao lado de uma
        // barra noutro sítio.
        totalStops:
            (_nested(plan, ['progress', 'total']) ?? planStops.length).toInt(),
        completedStops: ((_nested(plan, ['progress', 'completed']) ?? 0) +
                (_nested(plan, ['progress', 'failed']) ?? 0))
            .toInt(),
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
        next: _nextDelivery(stops, plan),
        // O traçado é desenho: se vier corrompido, a rota carrega à mesma sem
        // linha (ADR-0131).
        line: RouteLine.fromJson(plan['geometry']),
      );
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  /// Sem plano do dia: distinguir «poucas entregas» de «a IA ainda não
  /// preparou». É a única situação que ainda precisa de contar entregas.
  Future<MyRoute> _withoutPlan() async {
    final deliveries = _map(
      await _dio.get<dynamic>(
        '/deliveries',
        queryParameters: {'pageSize': _minStops, 'sort': 'createdAt'},
      ),
    );
    return _items(deliveries).length >= _minStops
        ? const MyRoute.preparing()
        : const MyRoute.empty();
  }

  /// A próxima parada por fazer, **como o servidor a decidiu**.
  ///
  /// O app já não a procura. Duas derivações da mesma coisa — uma no servidor
  /// para o progresso, outra aqui para o botão — divergem no dia em que as
  /// regras mudarem de um lado só, e o motorista veria o cartão a apontar para
  /// uma parada e o mapa a destacar outra. Há uma fonte, e é esta.
  NextDelivery? _nextDelivery(
    List<RouteStopInfo> stops,
    Map<String, dynamic> plan,
  ) {
    final progress = plan['progress'];
    final id = progress is Map<String, dynamic>
        ? progress['nextDeliveryId'] as String?
        : null;
    if (id == null || id.isEmpty) return null;

    for (final s in stops) {
      if (s.deliveryId != id) continue;
      final label = s.addressLine.isEmpty ? s.cityLine : s.addressLine;
      return NextDelivery(id: id, label: label);
    }
    // O servidor aponta para uma parada que não veio na lista. Não inventamos
    // outra: um rótulo vazio é honesto, apontar para a parada errada não é.
    return NextDelivery(id: id, label: '');
  }

  RouteStopInfo _stop(Map<String, dynamic> stop) {
    // A morada vem resolvida do servidor num campo só. `hasLocation: false`
    // significa parada sem localização utilizável — e a coordenada é ignorada
    // nesse caso, para não desenhar um pino num sítio em que ninguém está.
    final address = (stop['addressText'] as String?) ?? '';
    final hasLocation = stop['hasLocation'] as bool? ?? true;

    return RouteStopInfo(
      sequence: (stop['sequence'] as num?)?.toInt() ?? 0,
      deliveryId: stop['deliveryId'] as String? ?? '',
      addressLine: address,
      cityLine: '',
      etaMinutes: (stop['etaMinutes'] as num?)?.toDouble() ?? 0,
      status: (stop['status'] as String?) ?? 'pending',
      priority: (stop['priority'] as String?) ?? 'normal',
      latitude: hasLocation ? (stop['latitude'] as num?)?.toDouble() : null,
      longitude: hasLocation ? (stop['longitude'] as num?)?.toDouble() : null,
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
