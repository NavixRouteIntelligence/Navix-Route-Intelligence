import 'package:flutter_test/flutter_test.dart';
import 'package:navix_mobile/core/maps/route_stop_marker.dart';
import 'package:navix_mobile/features/route/domain/my_route.dart';
import 'package:navix_mobile/features/route/presentation/route_map_markers.dart';

RouteStopInfo stop(
  String id, {
  int sequence = 1,
  String status = 'pending',
  double? lat = 38.72,
  double? lng = -9.14,
}) =>
    RouteStopInfo(
      sequence: sequence,
      deliveryId: id,
      addressLine: 'Rua $id',
      cityLine: '',
      etaMinutes: 10,
      status: status,
      latitude: lat,
      longitude: lng,
    );

MyRoute route(List<RouteStopInfo> stops, {String? nextId}) => MyRoute(
      status: MyRouteStatus.ready,
      stops: stops,
      next: nextId == null ? null : NextDelivery(id: nextId, label: 'Rua'),
    );

void main() {
  test('a parada destacada no mapa é a que o cartão aponta', () {
    // O critério de aceite da T8.6. Ambos leem `route.next`, que por sua vez
    // vem do `nextDeliveryId` do servidor — há uma fonte só.
    final r = route(
      [
        stop('a', sequence: 1, status: 'delivered'),
        stop('b', sequence: 2),
        stop('c', sequence: 3),
      ],
      nextId: 'b',
    );

    final markers = markersFrom(r);
    final destacada =
        markers.where((m) => m.status == RouteStopStatus.next).toList();

    expect(destacada, hasLength(1));
    expect(destacada.single.deliveryId, r.next!.id);
  });

  test('sem próxima parada, nenhum pino fica destacado', () {
    // Fim do dia: o cartão mostra «tudo concluído» e o mapa não pode continuar
    // a apontar para uma parada.
    final markers = markersFrom(
      route([
        stop('a', status: 'delivered'),
        stop('b', sequence: 2, status: 'delivered'),
      ]),
    );

    expect(markers.any((m) => m.status == RouteStopStatus.next), isFalse);
  });

  test('entregues ficam concluídas e falhadas ficam falhadas', () {
    final markers = markersFrom(
      route(
        [
          stop('a', sequence: 1, status: 'delivered'),
          stop('b', sequence: 2, status: 'failed'),
          stop('c', sequence: 3, status: 'pending'),
        ],
        nextId: 'c',
      ),
    );

    expect(markers[0].status, RouteStopStatus.completed);
    expect(markers[1].status, RouteStopStatus.failed);
    expect(markers[2].status, RouteStopStatus.next);
  });

  test('estado desconhecido do backend lê-se como pendente', () {
    // Um estado novo no servidor não pode rebentar o mapa nem inventar uma
    // conclusão que ninguém declarou.
    final markers = markersFrom(
      route([stop('a', status: 'aguardando_terceiro')]),
    );

    expect(markers.single.status, RouteStopStatus.pending);
  });

  test('o destaque ganha ao estado, para não discordar do cartão', () {
    // Se o servidor apontasse para uma parada já concluída — o que não deve
    // acontecer —, mapa e cartão continuariam a apontar para a mesma. Um pino
    // com a cor errada é menos mau do que duas telas a discordar.
    final markers = markersFrom(
      route([stop('a', status: 'delivered')], nextId: 'a'),
    );

    expect(markers.single.status, RouteStopStatus.next);
  });

  test('parada sem coordenada vira pino não desenhável, não desaparece', () {
    // O mapa filtra; o mapeador não. Assim a contagem de «paradas sem
    // localização» que a tela mostra continua a bater com a rota.
    final markers = markersFrom(
      route([stop('a'), stop('b', sequence: 2, lat: null, lng: null)]),
    );

    expect(markers, hasLength(2));
    expect(markers.last.isPlottable, isFalse);
  });

  test('o número do pino é a sequência da rota, não a posição na lista', () {
    final markers = markersFrom(
      route([stop('x', sequence: 7), stop('y', sequence: 3)]),
    );

    expect(markers.map((m) => m.sequence), [7, 3]);
  });
}
