import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:navix_mobile/core/error/failure.dart';
import 'package:navix_mobile/features/optimizer/data/optimizer_repository.dart';
import 'package:navix_mobile/features/optimizer/domain/editable_stop.dart';
import 'package:navix_mobile/features/optimizer/domain/optimizer_models.dart';
import 'package:navix_mobile/features/optimizer/presentation/manual_route_cubit.dart';

class _MockRepo extends Mock implements OptimizerRepository {}

EditableStop _stop(String id, {bool locked = false}) => EditableStop(
      id: id,
      label: 'Rua $id',
      cityLine: 'Lisboa',
      latitude: 38.7 + id.hashCode % 10 * 0.001,
      longitude: -9.1,
      priority: 'normal',
      locked: locked,
    );

void main() {
  late _MockRepo repo;

  final stops = [_stop('a'), _stop('b'), _stop('c')];
  const result = RoutePlanResult(
    id: 'plan-1',
    metrics: RouteMetrics(),
    baseline: RouteMetrics(),
    savings: RouteSavings(),
    score: 80,
    stops: [],
  );

  setUp(() {
    repo = _MockRepo();
    registerFallbackValue(<EditableStop>[]);
    registerFallbackValue(OptimizerScope.mine);
  });

  ManualRouteCubit build() => ManualRouteCubit(repo);

  blocTest<ManualRouteCubit, ManualRouteState>(
    'load: loading → ready com as paradas ativas',
    build: () {
      when(() => repo.activeStops()).thenAnswer((_) async => stops);
      return build();
    },
    act: (c) => c.load(),
    expect: () => [
      const ManualRouteState(status: ManualRouteStatus.loading),
      ManualRouteState(status: ManualRouteStatus.ready, stops: stops),
    ],
  );

  blocTest<ManualRouteCubit, ManualRouteState>(
    'reorder: move a parada para a nova posição',
    build: () {
      when(() => repo.activeStops()).thenAnswer((_) async => stops);
      return build();
    },
    act: (c) async {
      await c.load();
      c.reorder(0, 2); // onReorderItem: newIndex já ajustado (destino final)
    },
    verify: (c) => expect(c.state.stops.map((s) => s.id).toList(), ['b', 'c', 'a']),
  );

  blocTest<ManualRouteCubit, ManualRouteState>(
    'toggleLock: alterna a trava de uma parada',
    build: () {
      when(() => repo.activeStops()).thenAnswer((_) async => stops);
      return build();
    },
    act: (c) async {
      await c.load();
      c.toggleLock('b');
    },
    verify: (c) {
      expect(c.state.stops.firstWhere((s) => s.id == 'b').locked, isTrue);
      expect(c.state.lockedCount, 1);
    },
  );

  blocTest<ManualRouteCubit, ManualRouteState>(
    'saveManualOrder: envia strategy=manual e conclui em success',
    build: () {
      when(() => repo.activeStops()).thenAnswer((_) async => stops);
      when(() => repo.optimizeStops(
            stops: any(named: 'stops'),
            strategy: any(named: 'strategy'),
            smart: any(named: 'smart'),
            scope: any(named: 'scope'),
          )).thenAnswer((_) async => result);
      return build();
    },
    act: (c) async {
      await c.load();
      await c.saveManualOrder();
    },
    verify: (c) {
      expect(c.state.status, ManualRouteStatus.success);
      verify(() => repo.optimizeStops(
            stops: any(named: 'stops'),
            strategy: 'manual',
            scope: OptimizerScope.mine,
          )).called(1);
    },
  );

  blocTest<ManualRouteCubit, ManualRouteState>(
    'reoptimizeRespectingLocks: envia smart=true (modo inteligente, respeitando travas)',
    build: () {
      when(() => repo.activeStops()).thenAnswer((_) async => stops);
      when(() => repo.optimizeStops(
            stops: any(named: 'stops'),
            strategy: any(named: 'strategy'),
            smart: any(named: 'smart'),
            scope: any(named: 'scope'),
          )).thenAnswer((_) async => result);
      return build();
    },
    act: (c) async {
      await c.load();
      await c.reoptimizeRespectingLocks();
    },
    verify: (c) => verify(() => repo.optimizeStops(
          stops: any(named: 'stops'),
          strategy: null,
          smart: true,
          scope: OptimizerScope.mine,
        )).called(1),
  );

  blocTest<ManualRouteCubit, ManualRouteState>(
    'falha no envio: volta a ready com mensagem de erro (não perde as paradas)',
    build: () {
      when(() => repo.activeStops()).thenAnswer((_) async => stops);
      when(() => repo.optimizeStops(
            stops: any(named: 'stops'),
            strategy: any(named: 'strategy'),
            scope: any(named: 'scope'),
          )).thenThrow(const NetworkFailure());
      return build();
    },
    act: (c) async {
      await c.load();
      await c.saveManualOrder();
    },
    verify: (c) {
      expect(c.state.status, ManualRouteStatus.ready);
      expect(c.state.error, 'Sem conexão com o servidor.');
      expect(c.state.stops, stops);
    },
  );
}
