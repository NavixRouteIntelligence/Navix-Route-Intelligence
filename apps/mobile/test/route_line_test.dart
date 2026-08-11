import 'package:flutter_test/flutter_test.dart';
import 'package:navix_mobile/features/route/domain/my_route.dart';

Map<String, dynamic> resposta({
  Object? coordinates = const [
    [-9.13, 38.72],
    [-9.14, 38.73],
  ],
  int coveredStops = 2,
  int totalStops = 2,
}) =>
    {
      'coordinates': coordinates,
      'provenance': {
        'source': 'directions',
        'profile': 'driving',
        'coveredStops': coveredStops,
        'totalStops': totalStops,
      },
    };

void main() {
  group('leitura do traçado', () {
    test('lê os vértices na ordem, longitude primeiro', () {
      final linha = RouteLine.fromJson(resposta())!;

      expect(linha.coordinates.first, [-9.13, 38.72]);
      expect(linha.coordinates, hasLength(2));
      expect(linha.profile, 'driving');
    });

    test('ausente não é erro', () {
      // O critério de aceite: sem traçado a rota carrega à mesma.
      expect(RouteLine.fromJson(null), isNull);
    });

    test('um ponto só não é linha', () {
      expect(
        RouteLine.fromJson(resposta(coordinates: [
          [-9.13, 38.72],
        ])),
        isNull,
      );
    });

    test('uma coordenada inválida invalida a linha inteira', () {
      // Aparar o ponto mau e ficar com o resto faria a linha saltar um troço —
      // e nada no mapa indicaria que falta um pedaço.
      expect(
        RouteLine.fromJson(resposta(coordinates: [
          [-9.13, 38.72],
          [-9.14, 999.0],
          [-9.15, 38.74],
        ])),
        isNull,
      );
    });

    test('coordenada com um valor só é recusada', () {
      expect(
        RouteLine.fromJson(resposta(coordinates: [
          [-9.13, 38.72],
          [-9.14],
        ])),
        isNull,
      );
    });

    test('NaN e infinito não são coordenadas', () {
      expect(
        RouteLine.fromJson(resposta(coordinates: [
          [-9.13, 38.72],
          [double.nan, 38.73],
        ])),
        isNull,
      );
    });

    test('coordenadas que não são lista não viram linha', () {
      expect(RouteLine.fromJson(resposta(coordinates: 'linha')), isNull);
    });

    test('proveniência em falta não impede ler a linha', () {
      // O desenho é o que interessa; a proveniência é o que a tela usa para se
      // explicar. Perder a segunda não pode custar a primeira.
      final linha = RouteLine.fromJson({
        'coordinates': [
          [-9.13, 38.72],
          [-9.14, 38.73],
        ],
      });

      expect(linha, isNotNull);
      expect(linha!.isPartial, isFalse);
    });
  });

  group('traçado parcial', () {
    test('cobrir menos paragens do que o total é parcial', () {
      final linha = RouteLine.fromJson(
        resposta(coveredStops: 8, totalStops: 10),
      )!;

      expect(linha.isPartial, isTrue);
      expect(linha.totalStops - linha.coveredStops, 2);
    });

    test('cobrir todas não é parcial', () {
      final linha = RouteLine.fromJson(
        resposta(coveredStops: 10, totalStops: 10),
      )!;

      expect(linha.isPartial, isFalse);
    });
  });

  group('a rota sobrevive ao traçado', () {
    test('uma rota sem linha continua a ser uma rota', () {
      const rota = MyRoute(status: MyRouteStatus.ready, totalStops: 3);

      expect(rota.isReady, isTrue);
      expect(rota.line, isNull);
    });
  });
}
