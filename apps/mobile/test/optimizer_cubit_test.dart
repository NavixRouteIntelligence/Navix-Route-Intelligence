import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:navix_mobile/core/error/failure.dart';
import 'package:navix_mobile/features/optimizer/data/optimizer_repository.dart';
import 'package:navix_mobile/features/optimizer/domain/optimizer_models.dart';
import 'package:navix_mobile/features/optimizer/presentation/optimizer_cubit.dart';

class _MockRepo extends Mock implements OptimizerRepository {}

void main() {
  late _MockRepo repo;

  const deliveries = [
    SelectableDelivery(id: 'd1', addressLine: 'Rua A, 1', cityLine: 'SP', priority: 'urgent', geocoded: true),
    SelectableDelivery(id: 'd2', addressLine: 'Rua B, 2', cityLine: 'SP', priority: 'normal', geocoded: true),
    SelectableDelivery(id: 'd3', addressLine: 'Rua C, 3', cityLine: 'SP', priority: 'low', geocoded: false),
  ];

  const result = RoutePlanResult(
    id: 'plan-1',
    metrics: RouteMetrics(totalDistanceKm: 20, totalTimeMinutes: 60, stops: 2),
    baseline: RouteMetrics(totalDistanceKm: 26, totalTimeMinutes: 80, stops: 2),
    savings: RouteSavings(distanceKm: 6, timeMinutes: 20, distancePct: 23, timePct: 25),
    score: 86,
    stops: [
      RouteStop(sequence: 1, deliveryId: 'd1', etaMinutes: 10, cumulativeDistanceKm: 5),
      RouteStop(sequence: 2, deliveryId: 'd2', etaMinutes: 30, cumulativeDistanceKm: 20),
    ],
  );

  setUp(() => repo = _MockRepo());

  test('loadDeliveries: pré-seleciona geocodificadas e conta ignoradas', () async {
    when(() => repo.pendingDeliveries()).thenAnswer((_) async => deliveries);
    final cubit = OptimizerCubit(repo);
    await cubit.loadDeliveries();
    expect(cubit.state.deliveries.length, 3);
    expect(cubit.state.selected, {'d1', 'd2'}); // d3 sem geocodificação
    expect(cubit.state.ignoredCount, 1);
    expect(cubit.state.canOptimize, isTrue);
  });

  test('toggle: adiciona/remove seleção', () async {
    when(() => repo.pendingDeliveries()).thenAnswer((_) async => deliveries);
    final cubit = OptimizerCubit(repo);
    await cubit.loadDeliveries();
    cubit.toggle('d1');
    expect(cubit.state.selected.contains('d1'), isFalse);
    cubit.toggle('d1');
    expect(cubit.state.selected.contains('d1'), isTrue);
  });

  test('optimize sucesso: vai para resultado com o plano', () async {
    when(() => repo.pendingDeliveries()).thenAnswer((_) async => deliveries);
    when(() => repo.optimize(deliveryIds: any(named: 'deliveryIds'), averageSpeedKmh: any(named: 'averageSpeedKmh'), serviceTimeMinutes: any(named: 'serviceTimeMinutes')))
        .thenAnswer((_) async => result);
    final cubit = OptimizerCubit(repo);
    await cubit.loadDeliveries();
    await cubit.optimize();
    expect(cubit.state.step, OptimizerStep.result);
    expect(cubit.state.result?.score, 86);
    expect(cubit.addressOf('d1'), 'Rua A, 1');
  });

  test('optimize falha: mensagem de erro', () async {
    when(() => repo.pendingDeliveries()).thenAnswer((_) async => deliveries);
    when(() => repo.optimize(deliveryIds: any(named: 'deliveryIds'), averageSpeedKmh: any(named: 'averageSpeedKmh'), serviceTimeMinutes: any(named: 'serviceTimeMinutes')))
        .thenThrow(const NetworkFailure());
    final cubit = OptimizerCubit(repo);
    await cubit.loadDeliveries();
    await cubit.optimize();
    expect(cubit.state.step, OptimizerStep.deliveries); // não avançou
    expect(cubit.state.error, 'Sem conexão com o servidor.');
  });
}
