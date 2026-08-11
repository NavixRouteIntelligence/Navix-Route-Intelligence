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
      totalStops: 2,
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
        // Uma parada mais à frente, que não é a próxima. É nela que se toca no
        // mapa quando se quer ver o que vem depois.
        const RouteStopInfo(
          sequence: 2,
          deliveryId: 'd2',
          addressLine: 'Rua B, 20',
          cityLine: 'Lisboa',
          etaMinutes: 25,
          latitude: 41.1579,
          longitude: -8.6291,
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

  test('navega para uma parada que não é a próxima', () async {
    // O mapa deixa tocar em qualquer pino. Sem isto, tocar na parada 5 abriria
    // a navegação da parada 1.
    final repository = _Repository();
    final navigation = _Navigation();
    when(() => repository.load()).thenAnswer((_) async => route());
    when(() => navigation.open(any())).thenAnswer((_) async => true);
    final cubit = MyRouteCubit(repository, navigation);

    await cubit.load();
    expect(await cubit.navigateToStop('d2'), isTrue);

    final opened = verify(() => navigation.open(captureAny())).captured.single
        as RouteNavigationTarget;
    expect(opened.deliveryId, 'd2');
    expect(opened.latitude, 41.1579);
    await cubit.close();
  });

  test('voltar da navegação do mapa recarrega a rota', () async {
    // Mesma porta que a próxima parada usa: se o mapa tivesse um caminho
    // próprio, regressar da navegação a partir dele mostraria o estado de
    // antes de conduzir.
    final repository = _Repository();
    final navigation = _Navigation();
    when(() => repository.load()).thenAnswer((_) async => route());
    when(() => navigation.open(any())).thenAnswer((_) async => true);
    final cubit = MyRouteCubit(repository, navigation);

    await cubit.load();
    await cubit.navigateToStop('d2');
    await cubit.resumeFromNavigation();

    verify(() => repository.load()).called(2);
    await cubit.close();
  });

  test('parada inexistente não abre nada', () async {
    final repository = _Repository();
    final navigation = _Navigation();
    when(() => repository.load()).thenAnswer((_) async => route());
    final cubit = MyRouteCubit(repository, navigation);

    await cubit.load();

    expect(await cubit.navigateToStop('nao-existe'), isFalse);
    verifyNever(() => navigation.open(any()));
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
