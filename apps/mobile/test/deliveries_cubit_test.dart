import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:navix_mobile/core/error/failure.dart';
import 'package:navix_mobile/features/deliveries/data/deliveries_repository.dart';
import 'package:navix_mobile/features/deliveries/domain/delivery_summary.dart';
import 'package:navix_mobile/features/deliveries/presentation/deliveries_cubit.dart';

class _MockRepo extends Mock implements DeliveriesRepository {}

const _delivery = DeliverySummary(
  id: 'd-1',
  addressLine: 'Rua A, 10',
  city: 'São Paulo',
  status: DeliveryStatusView.pending,
  priority: DeliveryPriorityView.normal,
  windowStart: null,
  windowEnd: null,
  notes: null,
);

void main() {
  late _MockRepo repo;

  setUp(() => repo = _MockRepo());

  blocTest<DeliveriesCubit, DeliveriesState>(
    'sucesso: loading → success com as entregas',
    build: () {
      when(() => repo.list(status: any(named: 'status'), pageSize: any(named: 'pageSize')))
          .thenAnswer((_) async => const DeliveriesPage(items: [_delivery], total: 1));
      return DeliveriesCubit(repo);
    },
    act: (c) => c.load(),
    expect: () => const [
      DeliveriesState(status: DeliveriesStatus.loading),
      DeliveriesState(status: DeliveriesStatus.success, items: [_delivery], total: 1),
    ],
  );

  blocTest<DeliveriesCubit, DeliveriesState>(
    'lista vazia: loading → success com lista vazia',
    build: () {
      when(() => repo.list(status: any(named: 'status'), pageSize: any(named: 'pageSize')))
          .thenAnswer((_) async => const DeliveriesPage(items: [], total: 0));
      return DeliveriesCubit(repo);
    },
    act: (c) => c.load(),
    expect: () => const [
      DeliveriesState(status: DeliveriesStatus.loading),
      DeliveriesState(status: DeliveriesStatus.success, items: [], total: 0),
    ],
  );

  blocTest<DeliveriesCubit, DeliveriesState>(
    'falha de rede: loading → error com mensagem tipada (nada vaza para a UI)',
    build: () {
      when(() => repo.list(status: any(named: 'status'), pageSize: any(named: 'pageSize')))
          .thenThrow(const NetworkFailure());
      return DeliveriesCubit(repo);
    },
    act: (c) => c.load(),
    expect: () => const [
      DeliveriesState(status: DeliveriesStatus.loading),
      DeliveriesState(status: DeliveriesStatus.error, error: NetworkFailure()),
    ],
  );

  blocTest<DeliveriesCubit, DeliveriesState>(
    'setFilter aplica o filtro e recarrega escopado',
    build: () {
      when(() => repo.list(status: any(named: 'status'), pageSize: any(named: 'pageSize')))
          .thenAnswer((_) async => const DeliveriesPage(items: [_delivery], total: 1));
      return DeliveriesCubit(repo);
    },
    act: (c) => c.setFilter('pending'),
    expect: () => const [
      DeliveriesState(status: DeliveriesStatus.loading, filter: 'pending'),
      DeliveriesState(status: DeliveriesStatus.success, items: [_delivery], total: 1, filter: 'pending'),
    ],
    verify: (_) {
      verify(() => repo.list(status: 'pending', pageSize: any(named: 'pageSize'))).called(1);
    },
  );
}
