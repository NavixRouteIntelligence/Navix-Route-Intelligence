import 'package:equatable/equatable.dart';

/// Como uma parada aparece no mapa.
///
/// Não é o estado da entrega no domínio — é a leitura visual dela. A distinção
/// importa: [next] não existe no backend, é derivado (a primeira pendente da
/// sequência), e quem monta os pinos é que o decide.
enum RouteStopStatus {
  /// Ainda por fazer. Cor neutra do tema.
  pending,

  /// A próxima a fazer. Destacada — é a única pergunta que o motorista tem
  /// enquanto conduz: «para onde agora».
  next,

  /// Entregue.
  completed,

  /// Tentada e falhada.
  failed,
}

/// Um par de coordenadas que se pode pôr num mapa.
///
/// Mesma regra de `RouteStopInfo.hasNavigableCoordinates`: nulo, infinito,
/// `NaN` ou fora do intervalo geográfico não é posição. Está aqui como função
/// solta para a parada e o motorista partilharem exatamente o mesmo critério —
/// duas cópias desta condição divergiriam, e a que divergisse punha um pino no
/// meio do Atlântico.
bool isPlottableCoordinate(double? latitude, double? longitude) =>
    latitude != null &&
    longitude != null &&
    latitude.isFinite &&
    longitude.isFinite &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180;

/// Onde o motorista está agora.
class DriverPosition extends Equatable {
  const DriverPosition({required this.latitude, required this.longitude});

  final double latitude;
  final double longitude;

  bool get isPlottable => isPlottableCoordinate(latitude, longitude);

  @override
  List<Object?> get props => [latitude, longitude];
}

/// Uma parada como o mapa a desenha, e **nada mais**.
///
/// O tipo é deliberadamente pobre. Fora daqui a parada tem endereço, ETA,
/// janela horária e nome do destinatário; nenhum desses chega ao mapa. A razão
/// é o critério de aceite «o mapa não recria todos os marcadores a cada
/// alteração irrelevante»: se o pino carregasse o ETA, um ETA a mudar de 12
/// para 11 minutos — coisa que acontece a cada atualização — passaria pelo
/// [operator ==] como se o desenho tivesse mudado, e o mapa redesenharia tudo.
///
/// Em vez de filtrar as mudanças irrelevantes no comparador, este tipo torna-as
/// **irrepresentáveis**: só entra aqui o que muda pixels.
class RouteStopMarker extends Equatable {
  const RouteStopMarker({
    required this.deliveryId,
    required this.sequence,
    required this.status,
    this.latitude,
    this.longitude,
  });

  /// Identidade estável do pino entre atualizações. É por ela que o *diff*
  /// distingue «a parada 3 mudou de cor» de «a parada 3 saiu e entrou outra».
  final String deliveryId;

  /// Posição na sequência otimizada, e o número desenhado no pino.
  final int sequence;

  final RouteStopStatus status;

  final double? latitude;
  final double? longitude;

  /// A parada tem coordenadas que se podem pôr num mapa.
  ///
  /// Um endereço que o *geocoder* não resolveu chega aqui com `null` — e o
  /// critério de aceite é que ele não impeça os outros de aparecer.
  bool get isPlottable => isPlottableCoordinate(latitude, longitude);

  @override
  List<Object?> get props => [
        deliveryId,
        sequence,
        status,
        latitude,
        longitude,
      ];
}

/// O que mudou entre dois conjuntos de pinos.
///
/// Existe para o mapa poder tocar só no que mudou. A alternativa — apagar tudo
/// e recriar — é uma linha de código mais curta e pisca o ecrã inteiro a cada
/// atualização de rota, ainda que só uma parada tenha sido concluída.
class MarkerDiff extends Equatable {
  const MarkerDiff({
    required this.added,
    required this.updated,
    required this.removed,
  });

  const MarkerDiff.empty()
      : added = const [],
        updated = const [],
        removed = const [];

  /// Paradas que não estavam no mapa.
  final List<RouteStopMarker> added;

  /// Paradas que já lá estavam e mudaram de desenho — cor, número ou posição.
  final List<RouteStopMarker> updated;

  /// `deliveryId` das paradas que saíram.
  final List<String> removed;

  /// Nada mudou. O mapa não deve fazer chamada nenhuma.
  bool get isEmpty => added.isEmpty && updated.isEmpty && removed.isEmpty;

  bool get isNotEmpty => !isEmpty;

  @override
  List<Object?> get props => [added, updated, removed];
}

/// Compara dois conjuntos de pinos por identidade.
///
/// Paradas sem coordenada válida são descartadas dos **dois** lados antes de
/// comparar. Isso dá uma propriedade que interessa: uma parada que perde a
/// coordenada aparece como [MarkerDiff.removed] e não como um pino a saltar
/// para o meio do oceano.
MarkerDiff diffMarkers(
  List<RouteStopMarker> before,
  List<RouteStopMarker> after,
) {
  final antes = {
    for (final m in before.where((m) => m.isPlottable)) m.deliveryId: m,
  };
  final depois = {
    for (final m in after.where((m) => m.isPlottable)) m.deliveryId: m,
  };

  final added = <RouteStopMarker>[];
  final updated = <RouteStopMarker>[];

  for (final entry in depois.entries) {
    final anterior = antes[entry.key];
    if (anterior == null) {
      added.add(entry.value);
    } else if (anterior != entry.value) {
      updated.add(entry.value);
    }
  }

  final removed = [
    for (final id in antes.keys)
      if (!depois.containsKey(id)) id,
  ];

  return MarkerDiff(added: added, updated: updated, removed: removed);
}
