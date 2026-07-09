import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:navix_mobile/core/error/failure.dart';
import 'package:navix_mobile/features/dashboard/data/dashboard_repository.dart';
import 'package:navix_mobile/features/dashboard/domain/dashboard_data.dart';
import 'package:navix_mobile/features/dashboard/presentation/dashboard_cubit.dart';

class _MockRepo extends Mock implements DashboardRepository {}

void main() {
  late _MockRepo repo;

  const data = DashboardData(
    deliveries: DeliveryCounts(total: 5, delivered: 3, pending: 2),
    routesTotal: 2,
    avgScore: 80,
    savedKm: 10,
    perfSeries: [1, 2, 3],
    pod: PodCounts(total: 3, delivered: 2, absent: 1),
    fleet: [],
  );

  setUp(() => repo = _MockRepo());

  blocTest<DashboardCubit, DashboardState>(
    'load com sucesso: loading → success com dados',
    build: () {
      when(() => repo.load()).thenAnswer((_) async => data);
      return DashboardCubit(repo);
    },
    act: (c) => c.load(),
    expect: () => const [
      DashboardState(status: DashboardStatus.loading),
      DashboardState(status: DashboardStatus.success, data: data),
    ],
  );

  blocTest<DashboardCubit, DashboardState>(
    'load com falha: loading → error com mensagem',
    build: () {
      when(() => repo.load()).thenThrow(const NetworkFailure());
      return DashboardCubit(repo);
    },
    act: (c) => c.load(),
    expect: () => const [
      DashboardState(status: DashboardStatus.loading),
      DashboardState(status: DashboardStatus.error, error: 'Sem conexão com o servidor.'),
    ],
  );
}
