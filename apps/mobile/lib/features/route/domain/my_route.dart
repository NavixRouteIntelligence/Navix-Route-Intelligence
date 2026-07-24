import 'package:equatable/equatable.dart';

/// Situação da rota preparada pela IA.
enum MyRouteStatus {
  /// A IA preparou a rota e ela está pronta para execução.
  ready,

  /// Há entregas, mas ainda não há plano — importação recém-confirmada, ou a
  /// preparação falhou e será refeita. Não é erro do utilizador.
  preparing,

  /// Não há entregas suficientes para haver rota (0 ou 1 parada).
  empty,
}

/// Tipo de destino, espelhando `DestinationType` do contrato (ADR-0064).
/// String crua para não quebrar quando o backend acrescentar categorias — o
/// desconhecido cai no rótulo genérico em vez de estourar.
typedef DestinationType = String;

/// **Grupo Inteligente** (ADR-0075): paradas do mesmo tipo de destino,
/// agregadas. Não altera a ordem de execução — é a leitura da sequência da IA
/// por categoria.
class RouteGroup extends Equatable {
  const RouteGroup({
    required this.type,
    required this.order,
    required this.stops,
    required this.sequences,
    required this.distanceKm,
    required this.timeMinutes,
  });

  final DestinationType type;
  final int order;
  final int stops;
  final List<int> sequences;
  final double distanceKm;
  final double timeMinutes;

  factory RouteGroup.fromJson(Map<String, dynamic> j) => RouteGroup(
        type: (j['type'] as String?) ?? 'other',
        order: (j['order'] as num?)?.toInt() ?? 0,
        stops: (j['stops'] as num?)?.toInt() ?? 0,
        sequences: (j['sequences'] as List?)?.whereType<num>().map((n) => n.toInt()).toList() ?? const [],
        distanceKm: (j['distanceKm'] as num?)?.toDouble() ?? 0,
        timeMinutes: (j['timeMinutes'] as num?)?.toDouble() ?? 0,
      );

  @override
  List<Object?> get props => [type, order, stops, sequences, distanceKm, timeMinutes];
}

/// Uma parada da rota, com o endereço já resolvido para exibição.
class RouteStopInfo extends Equatable {
  const RouteStopInfo({
    required this.sequence,
    required this.deliveryId,
    required this.addressLine,
    required this.cityLine,
    required this.etaMinutes,
  });

  final int sequence;
  final String deliveryId;
  final String addressLine;
  final String cityLine;
  final double etaMinutes;

  @override
  List<Object?> get props => [sequence, deliveryId, addressLine, cityLine, etaMinutes];
}

/// A próxima entrega a registrar — a parada pendente mais à frente na rota.
/// É o alvo do POD ("Registrar entrega"): sem ela, não há o que registrar.
class NextDelivery extends Equatable {
  const NextDelivery({required this.id, required this.label});

  final String id;
  final String label;

  @override
  List<Object?> get props => [id, label];
}

/// A rota preparada pela IA, como o motorista a vê.
class MyRoute extends Equatable {
  const MyRoute({
    required this.status,
    this.totalStops = 0,
    this.distanceKm = 0,
    this.timeMinutes = 0,
    this.savedKm = 0,
    this.savedPct = 0,
    this.updatedAt,
    this.groups = const [],
    this.stops = const [],
    this.next,
  });

  const MyRoute.empty() : this(status: MyRouteStatus.empty);
  const MyRoute.preparing() : this(status: MyRouteStatus.preparing);

  final MyRouteStatus status;
  final int totalStops;
  final double distanceKm;
  final double timeMinutes;

  /// Economia prevista contra a ordem original (baseline).
  final double savedKm;
  final double savedPct;

  /// Quando a IA preparou esta rota.
  final DateTime? updatedAt;

  final List<RouteGroup> groups;
  final List<RouteStopInfo> stops;

  /// Próxima entrega pendente; null quando a rota terminou.
  final NextDelivery? next;

  bool get isReady => status == MyRouteStatus.ready;

  /// Paradas de um grupo, na ordem da rota.
  List<RouteStopInfo> stopsOf(RouteGroup group) {
    final wanted = group.sequences.toSet();
    return stops.where((s) => wanted.contains(s.sequence)).toList()
      ..sort((a, b) => a.sequence.compareTo(b.sequence));
  }

  @override
  List<Object?> get props =>
      [status, totalStops, distanceKm, timeMinutes, savedKm, savedPct, updatedAt, groups, stops, next];
}
