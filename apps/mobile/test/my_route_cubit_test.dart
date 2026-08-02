import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:navix_mobile/features/route/data/my_route_repository.dart';
import 'package:navix_mobile/features/route/domain/my_route.dart';
import 'package:navix_mobile/features/route/domain/route_navigation.dart';
import 'package:navix_mobile/features/route/presentation/my_route_cubit.dart';

class _Repository extends Mock implements MyRouteRepository {}

class _Navigation extends Mock implements RouteNavigationLauncher {}

const _target = RouteNavigationTarget(
  deliveryId: 'd1',
  latitude: 38.7223,
  longitude: -9.1393,
);

MyRoute route({double? latitude = 38.7223, double? longitude = -9.1393}) =>
    MyRoute(
      status: MyRouteStatus.ready,
      totalStops: 1,
      stops: [
        RouteStopInfo(
          sequence: 1,
          deliveryId: 'd1',
          addressLine: 'Rua A, 10',
          cityLine: 'Lisboa',
          etaMinutes: 8,
          latitude: latitude,
          longitude: longitude,
        ),
      ],
      next: const NextDelivery(id: 'd1', label: 'Rua A, 10'),
    );

void main() {
  setUpAll(() => registerFallbackValue(_target));

  test('abre a próxima parada e atualiza a rota ao regressar', () async {
    final repository = _Repository();
    final navigation = _Navigation();
    when(() => repository.load()).thenAnswer((_) async => route());
    when(() => navigation.open(any())).thenAnswer((_) async => true);
    final cubit = MyRouteCubit(repository, navigation);

    await cubit.load();
    expect(await cubit.navigateToNext(), isTrue);
    await cubit.resumeFromNavigation();

    final opened = verify(() => navigation.open(captureAny())).captured.single
        as RouteNavigationTarget;
    expect(opened.deliveryId, 'd1');
    verify(() => repository.load()).called(2);
    await cubit.close();
  });

  test('não abre mapa sem coordenadas válidas', () async {
    final repository = _Repository();
    final navigation = _Navigation();
    when(() => repository.load())
        .thenAnswer((_) async => route(latitude: null));
    final cubit = MyRouteCubit(repository, navigation);

    await cubit.load();

    expect(await cubit.navigateToNext(), isFalse);
    verifyNever(() => navigation.open(any()));
    await cubit.close();
  });
}
