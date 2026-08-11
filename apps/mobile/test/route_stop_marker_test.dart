import 'package:flutter_test/flutter_test.dart';
import 'package:navix_mobile/core/maps/route_stop_marker.dart';

RouteStopMarker pin(
  String id, {
  int sequence = 1,
  RouteStopStatus status = RouteStopStatus.pending,
  double? lat = 38.72,
  double? lng = -9.14,
}) =>
    RouteStopMarker(
      deliveryId: id,
      sequence: sequence,
      status: status,
      latitude: lat,
      longitude: lng,
    );

void main() {
  group('coordenadas', () {
    test('morada não localizada não vai ao mapa', () {
      expect(pin('a', lat: null, lng: null).isPlottable, isFalse);
      expect(pin('a', lat: 38.72, lng: null).isPlottable, isFalse);
    });

    test('NaN e infinito não são posições', () {
      expect(pin('a', lat: double.nan, lng: -9.14).isPlottable, isFalse);
      expect(
        pin('a', lat: 38.72, lng: double.infinity).isPlottable,
        isFalse,
      );
    });

    test('fora do intervalo geográfico não é posição', () {
      expect(pin('a', lat: 91, lng: 0).isPlottable, isFalse);
      expect(pin('a', lat: 0, lng: -181).isPlottable, isFalse);
    });

    test('a origem é uma coordenada válida', () {
      // 0,0 fica no Atlântico e é o valor por omissão de meio sistema — mas é
      // geograficamente válido. Descartá-lo aqui seria a app a adivinhar, e o
      // sítio de corrigir um zero indevido é a origem do dado, não o mapa.
      expect(pin('a', lat: 0, lng: 0).isPlottable, isTrue);
    });

    test('uma parada sem coordenada não impede as outras', () {
      final visiveis = [
        pin('a'),
        pin('b', lat: null, lng: null),
        pin('c'),
      ].where((m) => m.isPlottable).toList();

      expect(visiveis.map((m) => m.deliveryId), ['a', 'c']);
    });
  });

  group('diffMarkers', () {
    test('conjuntos iguais não produzem trabalho nenhum', () {
      // Este é o critério de aceite: nada mudou, o mapa não toca em nada.
      final antes = [pin('a', sequence: 1), pin('b', sequence: 2)];
      final depois = [pin('a', sequence: 1), pin('b', sequence: 2)];

      expect(diffMarkers(antes, depois).isEmpty, isTrue);
    });

    test('a ordem da lista não é uma mudança', () {
      final antes = [pin('a', sequence: 1), pin('b', sequence: 2)];
      final depois = [pin('b', sequence: 2), pin('a', sequence: 1)];

      expect(diffMarkers(antes, depois).isEmpty, isTrue);
    });

    test('uma entrega concluída mexe só no pino dela', () {
      final antes = [pin('a', sequence: 1), pin('b', sequence: 2)];
      final depois = [
        pin('a', sequence: 1, status: RouteStopStatus.completed),
        pin('b', sequence: 2),
      ];

      final diff = diffMarkers(antes, depois);
      expect(diff.added, isEmpty);
      expect(diff.removed, isEmpty);
      expect(diff.updated.map((m) => m.deliveryId), ['a']);
    });

    test('parada nova entra sem tocar nas antigas', () {
      final diff = diffMarkers(
        [pin('a', sequence: 1)],
        [pin('a', sequence: 1), pin('b', sequence: 2)],
      );

      expect(diff.added.map((m) => m.deliveryId), ['b']);
      expect(diff.updated, isEmpty);
      expect(diff.removed, isEmpty);
    });

    test('parada que sai é removida por id', () {
      final diff = diffMarkers(
        [pin('a', sequence: 1), pin('b', sequence: 2)],
        [pin('a', sequence: 1)],
      );

      expect(diff.removed, ['b']);
      expect(diff.added, isEmpty);
    });

    test('mudar de posição é uma atualização, não uma troca de pino', () {
      final diff = diffMarkers(
        [pin('a')],
        [pin('a', lat: 41.15, lng: -8.61)],
      );

      expect(diff.updated.map((m) => m.deliveryId), ['a']);
      expect(diff.added, isEmpty);
      expect(diff.removed, isEmpty);
    });

    test('perder a coordenada tira o pino em vez de o mudar de sítio', () {
      final diff = diffMarkers(
        [pin('a')],
        [pin('a', lat: null, lng: null)],
      );

      expect(diff.removed, ['a']);
      expect(diff.updated, isEmpty);
    });

    test('parada inválida dos dois lados nunca aparece no diff', () {
      final diff = diffMarkers(
        [pin('a'), pin('z', lat: null, lng: null)],
        [pin('a'), pin('z', lat: null, lng: null)],
      );

      expect(diff.isEmpty, isTrue);
    });

    test('renumerar a sequência repinta o número', () {
      // Reordenar a rota muda o número desenhado, e o pino tem de o mostrar.
      final diff = diffMarkers(
        [pin('a', sequence: 3)],
        [pin('a', sequence: 1)],
      );

      expect(diff.updated.single.sequence, 1);
    });
  });

  group('posição do motorista', () {
    test('coordenada inválida não vira marcador', () {
      const p = DriverPosition(latitude: double.nan, longitude: -9.14);
      expect(p.isPlottable, isFalse);
    });

    test('a mesma posição compara como igual', () {
      // É o que evita mover o marcador do motorista a cada rebuild.
      expect(
        const DriverPosition(latitude: 38.72, longitude: -9.14),
        const DriverPosition(latitude: 38.72, longitude: -9.14),
      );
    });
  });
}
