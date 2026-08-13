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
        sequences: (j['sequences'] as List?)
                ?.whereType<num>()
                .map((n) => n.toInt())
                .toList() ??
            const [],
        distanceKm: (j['distanceKm'] as num?)?.toDouble() ?? 0,
        timeMinutes: (j['timeMinutes'] as num?)?.toDouble() ?? 0,
      );

  @override
  List<Object?> get props => [
        type,
        order,
        stops,
        sequences,
        distanceKm,
        timeMinutes,
      ];
}

/// Uma parada da rota, com o endereço já resolvido para exibição.
class RouteStopInfo extends Equatable {
  const RouteStopInfo({
    required this.sequence,
    required this.deliveryId,
    required this.addressLine,
    required this.cityLine,
    required this.etaMinutes,
    this.status = 'pending',
    this.priority = 'normal',
    this.latitude,
    this.longitude,
  });

  final int sequence;
  final String deliveryId;
  final String addressLine;
  final String cityLine;
  final double etaMinutes;

  /// Estado da entrega, no vocabulário do backend (`pending`, `in_transit`,
  /// `delivered`, `failed`, …). String crua e não `enum`, pela mesma razão de
  /// [DestinationType]: um estado novo no backend não pode rebentar a tela do
  /// motorista — cai no rótulo genérico.
  final String status;

  /// Prioridade da entrega (`low`, `normal`, `high`, `urgent`).
  final String priority;

  final double? latitude;
  final double? longitude;

  /// A entrega já não está por fazer — entregue ou falhada.
  bool get isDone => status == 'delivered' || status == 'failed';

  bool get hasFailed => status == 'failed';

  bool get hasNavigableCoordinates =>
      latitude?.isFinite == true &&
      longitude?.isFinite == true &&
      latitude! >= -90 &&
      latitude! <= 90 &&
      longitude! >= -180 &&
      longitude! <= 180;

  @override
  List<Object?> get props => [
        sequence,
        deliveryId,
        addressLine,
        cityLine,
        etaMinutes,
        status,
        priority,
        latitude,
        longitude,
      ];
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

/// Entrega deixada de fora da rota, e por quê (ADR-0110).
class UnassignedStop extends Equatable {
  const UnassignedStop({required this.deliveryId, required this.reason});

  final String deliveryId;

  /// `capacity`, `isolated` ou `disconnected` — o vocabulário do backend.
  final String reason;

  factory UnassignedStop.fromJson(Map<String, dynamic> json) => UnassignedStop(
        deliveryId: json['deliveryId'] as String? ?? '',
        reason: json['reason'] as String? ?? 'capacity',
      );

  @override
  List<Object?> get props => [deliveryId, reason];
}

/// O traçado real da rota, quando o servidor o conseguiu obter (ADR-0131).
///
/// **Ausente não é erro.** Sem traçado o mapa mostra os pontos, que continuam
/// verdadeiros. Não existe uma versão «aproximada» desta linha: uma reta entre
/// paragens atravessa quarteirões e rios e sugere uma distância que não é a que
/// se conduz (ADR-0125).
class RouteLine extends Equatable {
  const RouteLine({
    required this.coordinates,
    required this.profile,
    required this.coveredStops,
    required this.totalStops,
  });

  /// Vértices da linha, no formato do GeoJSON: **longitude primeiro**.
  final List<List<double>> coordinates;

  final String profile;

  /// Paragens por onde a linha passa, contra o total do plano.
  final int coveredStops;
  final int totalStops;

  /// A linha salta paragens — as que não têm localização utilizável. É o que a
  /// tela tem de dizer: sem o aviso, ela parece o percurso completo.
  bool get isPartial => coveredStops < totalStops;

  /// Lê o traçado da resposta, ou devolve `null`.
  ///
  /// Recusa em vez de aparar: uma coordenada inválida no meio da lista faria a
  /// linha saltar para o oceano e a câmara enquadrar meio globo. Uma linha que
  /// não se consegue ler por inteiro não é meia linha — é nenhuma.
  static RouteLine? fromJson(Object? raw) {
    if (raw is! Map<String, dynamic>) return null;

    final pontos = raw['coordinates'];
    if (pontos is! List) return null;

    final coordenadas = <List<double>>[];
    for (final ponto in pontos) {
      if (ponto is! List || ponto.length < 2) return null;
      final lng = (ponto[0] as num?)?.toDouble();
      final lat = (ponto[1] as num?)?.toDouble();
      if (lng == null || lat == null) return null;
      if (!lng.isFinite || !lat.isFinite) return null;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
      coordenadas.add([lng, lat]);
    }
    // Um ponto só não é uma linha.
    if (coordenadas.length < 2) return null;

    final proveniencia = raw['provenance'];
    final p = proveniencia is Map<String, dynamic>
        ? proveniencia
        : const <String, dynamic>{};

    return RouteLine(
      coordinates: coordenadas,
      profile: (p['profile'] as String?) ?? 'driving',
      coveredStops: (p['coveredStops'] as num?)?.toInt() ?? coordenadas.length,
      totalStops: (p['totalStops'] as num?)?.toInt() ?? coordenadas.length,
    );
  }

  @override
  List<Object?> get props => [coordinates, profile, coveredStops, totalStops];
}

/// A rota preparada pela IA, como o motorista a vê.
class MyRoute extends Equatable {
  const MyRoute({
    required this.status,
    this.totalStops = 0,
    this.completedStops = 0,
    this.distanceKm = 0,
    this.timeMinutes = 0,
    this.savedKm = 0,
    this.savedPct = 0,
    this.savedMinutes = 0,
    this.savedTimePct = 0,
    this.baselineDistanceKm = 0,
    this.baselineTimeMinutes = 0,
    this.vehicleType,
    this.updatedAt,
    this.groups = const [],
    this.stops = const [],
    this.next,
    this.unassigned = const [],
    this.line,
    this.fromCache = false,
    this.mapEnabled = true,
  });

  const MyRoute.empty() : this(status: MyRouteStatus.empty);
  const MyRoute.preparing() : this(status: MyRouteStatus.preparing);

  final MyRouteStatus status;

  /// Entregas que **não** entraram nesta rota, com o motivo (ADR-0110).
  ///
  /// Vazio na rota completa. Quando há alguma, o motorista precisa saber antes
  /// de sair: descobrir na doca que uma entrega ficou para trás é o pior
  /// momento possível.
  final List<UnassignedStop> unassigned;

  /// A rota deixou entregas para trás.
  bool get isPartial => unassigned.isNotEmpty;

  final int totalStops;
  final int completedStops;
  final double distanceKm;
  final double timeMinutes;

  /// Economia prevista contra a ordem original (baseline).
  final double savedKm;
  final double savedPct;
  final double savedMinutes;
  final double savedTimePct;
  final double baselineDistanceKm;
  final double baselineTimeMinutes;
  final String? vehicleType;

  /// Quando a IA preparou esta rota.
  final DateTime? updatedAt;

  final List<RouteGroup> groups;
  final List<RouteStopInfo> stops;

  /// Próxima entrega pendente; null quando a rota terminou.
  final NextDelivery? next;

  /// Traçado real, ou `null` quando não se conseguiu (ADR-0131).
  final RouteLine? line;

  /// Esta rota veio do instantâneo guardado, e não do servidor (ADR-0134).
  ///
  /// A tela tem de o dizer: as paragens e a ordem continuam a ser as que a IA
  /// preparou, mas uma entrega registada por outro caminho não está aqui. Uma
  /// rota desatualizada apresentada como atual é pior do que uma tela de erro.
  final bool fromCache;

  /// O mapa está ligado para este motorista (ADR-0134).
  ///
  /// `true` por omissão, e de propósito: uma resposta anterior ao piloto não
  /// traz o campo, e nessa altura o mapa já aparecia. Desligar por omissão
  /// faria uma app nova esconder o mapa contra um servidor antigo.
  final bool mapEnabled;

  bool get isReady => status == MyRouteStatus.ready;
  int get remainingStops {
    final remaining = totalStops - completedStops;
    return remaining < 0 ? 0 : remaining;
  }

  double get completionRatio => totalStops == 0
      ? 0
      : (completedStops / totalStops).clamp(0.0, 1.0).toDouble();

  bool get usesDefaultFuelEstimate => vehicleType == null;

  double get fuelSavedLiters {
    final consumption = switch (vehicleType) {
      'bicycle' => 0.0,
      'motorcycle' => 3.0,
      'van' => 11.0,
      'truck' => 28.0,
      _ => 8.0,
    };
    final distance = savedKm < 0 ? 0 : savedKm;
    return distance * consumption / 100;
  }

  /// Paradas de um grupo, na ordem da rota.
  List<RouteStopInfo> stopsOf(RouteGroup group) {
    final wanted = group.sequences.toSet();
    return stops.where((s) => wanted.contains(s.sequence)).toList()
      ..sort((a, b) => a.sequence.compareTo(b.sequence));
  }

  @override
  List<Object?> get props => [
        status,
        totalStops,
        completedStops,
        distanceKm,
        timeMinutes,
        savedKm,
        savedPct,
        savedMinutes,
        savedTimePct,
        baselineDistanceKm,
        baselineTimeMinutes,
        vehicleType,
        updatedAt,
        groups,
        stops,
        next,
        unassigned,
        line,
        fromCache,
        mapEnabled,
      ];
}
