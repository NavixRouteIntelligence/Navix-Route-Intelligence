import 'dart:async';

import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:navix_mobile/core/connectivity/connectivity_service.dart';
import 'package:navix_mobile/core/error/failure.dart';
import 'package:navix_mobile/features/driver/data/driver_dashboard_repository.dart';
import 'package:navix_mobile/features/driver/domain/driver_dashboard_data.dart';
import 'package:navix_mobile/features/driver/presentation/driver_dashboard_cubit.dart';

class _MockRepo extends Mock implements DriverDashboardRepository {}

/// Conectividade controlável nos testes (sem tocar a plataforma).
class _FakeConnectivity extends ConnectivityService {
  _FakeConnectivity(this._controller);
  final StreamController<bool> _controller;
  @override
  Future<bool> isOnline() async => true;
  @override
  Stream<bool> get onlineChanges => _controller.stream;
}

void main() {
  late _MockRepo repo;

  // Clock fixo: torna o lastUpdatedAt determinístico nos testes.
  final fixed = DateTime(2026, 7, 20, 12);

  final data = DriverDashboardData(
    total: 12,
    delivered: 4,
    next: DriverDelivery(
      id: 'del-1',
      addressLine: 'Rua Augusta, 1240',
      cityLine: 'São Paulo — SP',
      priority: 'urgent',
      status: 'in_route',
      windowStart: DateTime(2026, 7, 10, 10),
      windowEnd: DateTime(2026, 7, 10, 10, 30),
    ),
    tracking: DriverTracking(speedKmh: 42, recordedAt: DateTime(2026, 7, 10, 9, 40), status: 'en_route'),
    podToday: 3,
    score: 86,
    savedKm: 9.2,
    avgSavingsPct: 12,
    remainingMinutes: 220,
    remainingKm: 18.4,
  );

  DriverDashboardCubit build() => DriverDashboardCubit(repo, clock: () => fixed);

  late StreamController<bool> conn;

  setUp(() {
    repo = _MockRepo();
    conn = StreamController<bool>.broadcast();
  });

  tearDown(() => conn.close());

  test('derivados: progress, remaining, currentIndex', () {
    expect(data.remaining, 8);
    expect(data.currentIndex, 5);
    expect((data.progress * 100).round(), 33);
    expect(data.isEmpty, isFalse);
  });

  blocTest<DriverDashboardCubit, DriverDashboardState>(
    'load com sucesso: loading → success com dados e carimbo de hora',
    build: () {
      when(() => repo.load()).thenAnswer((_) async => data);
      return build();
    },
    act: (c) => c.load(),
    expect: () => [
      const DriverDashboardState(status: DriverDashboardStatus.loading),
      DriverDashboardState(status: DriverDashboardStatus.success, data: data, lastUpdatedAt: fixed),
    ],
  );

  blocTest<DriverDashboardCubit, DriverDashboardState>(
    'load com falha: loading → error com mensagem',
    build: () {
      when(() => repo.load()).thenThrow(const NetworkFailure());
      return build();
    },
    act: (c) => c.load(),
    expect: () => const [
      DriverDashboardState(status: DriverDashboardStatus.loading),
      DriverDashboardState(status: DriverDashboardStatus.error, error: NetworkFailure()),
    ],
  );

  test('journey: primeira e última paradas do dia', () {
    final withJourney = DriverDashboardData(
      total: 3,
      delivered: 1,
      next: null,
      tracking: const DriverTracking(),
      podToday: 0,
      first: DriverDelivery(
        id: 'a',
        addressLine: 'Rua A, 1',
        cityLine: 'Lisboa',
        priority: 'normal',
        status: 'delivered',
        windowStart: DateTime(2026, 7, 10, 8),
      ),
      last: DriverDelivery(
        id: 'c',
        addressLine: 'Rua C, 3',
        cityLine: 'Lisboa',
        priority: 'normal',
        status: 'pending',
        windowStart: DateTime(2026, 7, 10, 18),
      ),
    );
    expect(withJourney.first?.id, 'a');
    expect(withJourney.last?.id, 'c');
  });

  blocTest<DriverDashboardCubit, DriverDashboardState>(
    'load silencioso com sucesso: só success (sem flash de loading)',
    build: () {
      when(() => repo.load()).thenAnswer((_) async => data);
      return build();
    },
    act: (c) => c.load(silent: true),
    expect: () => [
      DriverDashboardState(status: DriverDashboardStatus.success, data: data, lastUpdatedAt: fixed),
    ],
  );

  blocTest<DriverDashboardCubit, DriverDashboardState>(
    'auto refresh: falha silenciosa preserva os últimos dados bons',
    build: () {
      // 1º load OK; 2º (silencioso) falha — o estado bom deve permanecer.
      final answers = <Future<DriverDashboardData> Function()>[
        () async => data,
        () async => throw const NetworkFailure(),
      ];
      var i = 0;
      when(() => repo.load()).thenAnswer((_) => answers[i++ % answers.length]());
      return build();
    },
    act: (c) async {
      await c.load();
      await c.load(silent: true);
    },
    expect: () => [
      const DriverDashboardState(status: DriverDashboardStatus.loading),
      DriverDashboardState(status: DriverDashboardStatus.success, data: data, lastUpdatedAt: fixed),
      // Nenhum estado adicional: a falha silenciosa foi absorvida.
    ],
  );

  blocTest<DriverDashboardCubit, DriverDashboardState>(
    'toggleLive: pausa o tempo real preservando os dados',
    build: () {
      when(() => repo.load()).thenAnswer((_) async => data);
      return build();
    },
    act: (c) async {
      await c.load();
      c.toggleLive(); // pausa
    },
    expect: () => [
      const DriverDashboardState(status: DriverDashboardStatus.loading),
      DriverDashboardState(status: DriverDashboardStatus.success, data: data, lastUpdatedAt: fixed),
      DriverDashboardState(status: DriverDashboardStatus.success, data: data, lastUpdatedAt: fixed, live: false),
    ],
  );

  blocTest<DriverDashboardCubit, DriverDashboardState>(
    'conectividade: fica offline → online=false, preservando os dados em cache',
    build: () {
      when(() => repo.load()).thenAnswer((_) async => data);
      return DriverDashboardCubit(repo, connectivity: _FakeConnectivity(conn), clock: () => fixed);
    },
    act: (c) async {
      await c.load();
      conn.add(false);
      await Future<void>.delayed(Duration.zero);
    },
    expect: () => [
      const DriverDashboardState(status: DriverDashboardStatus.loading),
      DriverDashboardState(status: DriverDashboardStatus.success, data: data, lastUpdatedAt: fixed),
      DriverDashboardState(status: DriverDashboardStatus.success, data: data, lastUpdatedAt: fixed, online: false),
    ],
  );

  blocTest<DriverDashboardCubit, DriverDashboardState>(
    'conectividade: ao reconectar, sincroniza (novo load)',
    build: () {
      when(() => repo.load()).thenAnswer((_) async => data);
      return DriverDashboardCubit(repo, connectivity: _FakeConnectivity(conn), clock: () => fixed);
    },
    act: (c) async {
      await c.load(); // 1º load
      conn.add(false);
      await Future<void>.delayed(Duration.zero);
      conn.add(true); // reconecta → load silencioso (2º)
      await Future<void>.delayed(Duration.zero);
    },
    verify: (c) {
      expect(c.state.online, isTrue);
      verify(() => repo.load()).called(2);
    },
  );
}
