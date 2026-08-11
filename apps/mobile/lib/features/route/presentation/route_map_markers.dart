import '../../../core/maps/route_stop_marker.dart';
import '../domain/my_route.dart';

/// Converte a rota nos pinos do mapa.
///
/// Existe como função solta, e não como método do widget nem do Cubit, porque é
/// aqui que vive a invariante que a T8.6 pede: **a parada destacada no mapa é a
/// mesma que o cartão principal aponta**. Uma função pura é o sítio onde isso
/// se testa sem montar tela nenhuma.
List<RouteStopMarker> markersFrom(MyRoute route) {
  final nextId = route.next?.id;
  return [
    for (final stop in route.stops)
      RouteStopMarker(
        deliveryId: stop.deliveryId,
        sequence: stop.sequence,
        status: statusOf(stop, nextId),
        latitude: stop.latitude,
        longitude: stop.longitude,
      ),
  ];
}

/// Como a parada [stop] aparece no mapa, sabendo qual é a próxima.
///
/// A ordem dos testes não é arbitrária. «É a próxima» é verificado **primeiro**
/// porque é a única leitura que tem de coincidir com o cartão: o cartão mostra
/// `route.next`, e se aqui um estado o pudesse suplantar, mapa e cartão
/// apontariam para paradas diferentes — que é exatamente o que o critério de
/// aceite proíbe. Na prática o conflito não acontece, porque o servidor deriva
/// `nextDeliveryId` da primeira parada por fazer; mas se um dia acontecer, o
/// desacordo entre as duas leituras seria pior do que um pino com a cor errada.
RouteStopStatus statusOf(RouteStopInfo stop, String? nextDeliveryId) {
  if (nextDeliveryId != null && stop.deliveryId == nextDeliveryId) {
    return RouteStopStatus.next;
  }
  if (stop.hasFailed) return RouteStopStatus.failed;
  if (stop.isDone) return RouteStopStatus.completed;
  return RouteStopStatus.pending;
}
