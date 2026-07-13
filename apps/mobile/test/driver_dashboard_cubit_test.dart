import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:navix_mobile/core/error/failure.dart';
import 'package:navix_mobile/features/driver/data/driver_dashboard_repository.dart';
import 'package:navix_mobile/features/driver/domain/driver_dashboard_data.dart';
import 'package:navix_mobile/features/driver/presentation/driver_dashboard_cubit.dart';

class _MockRepo extends Mock implements DriverDashboardRepository {}

void main() {
  late _MockRepo repo;

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

  setUp(() => repo = _MockRepo());

  test('derivados: progress, remaining, currentIndex', () {
    expect(data.remaining, 8);
    expect(data.currentIndex, 5);
    expect((data.progress * 100).round(), 33);
    expect(data.isEmpty, isFalse);
  });

  blocTest<DriverDashboardCubit, DriverDashboardState>(
    'load com sucesso: loading → success com dados',
    build: () {
      when(() => repo.load()).thenAnswer((_) async => data);
      return DriverDashboardCubit(repo);
    },
    act: (c) => c.load(),
    expect: () => [
      const DriverDashboardState(status: DriverDashboardStatus.loading),
      DriverDashboardState(status: DriverDashboardStatus.success, data: data),
    ],
  );

  blocTest<DriverDashboardCubit, DriverDashboardState>(
    'load com falha: loading → error com mensagem',
    build: () {
      when(() => repo.load()).thenThrow(const NetworkFailure());
      return DriverDashboardCubit(repo);
    },
    act: (c) => c.load(),
    expect: () => const [
      DriverDashboardState(status: DriverDashboardStatus.loading),
      DriverDashboardState(status: DriverDashboardStatus.error, error: 'Sem conexão com o servidor.'),
    ],
  );
}
