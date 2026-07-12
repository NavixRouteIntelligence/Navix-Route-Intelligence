import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:navix_mobile/core/connectivity/connectivity_service.dart';
import 'package:navix_mobile/core/error/failure.dart';
import 'package:navix_mobile/features/pod/data/pod_queue_store.dart';
import 'package:navix_mobile/features/pod/data/pod_repository.dart';
import 'package:navix_mobile/features/pod/presentation/pod_sync_cubit.dart';

class _MockRepo extends Mock implements PodRepository {}

class _MockQueue extends Mock implements PodQueueStore {}

class _MockConn extends Mock implements ConnectivityService {}

QueuedPod _q(String id) => QueuedPod(
      id: id,
      createdAt: DateTime(2026, 7, 10),
      submission: PodSubmission(deliveryId: 'd-$id', status: 'delivered', label: 'Cliente $id'),
    );

void main() {
  late _MockRepo repo;
  late _MockQueue queue;
  late _MockConn conn;

  setUpAll(() => registerFallbackValue(const PodSubmission(deliveryId: 'x', status: 'delivered')));

  setUp(() {
    repo = _MockRepo();
    queue = _MockQueue();
    conn = _MockConn();
    when(() => conn.onlineChanges).thenAnswer((_) => const Stream<bool>.empty());
  });

  test('syncNow: envia pendentes e remove os enviados', () async {
    var items = [_q('1'), _q('2')];
    when(() => queue.all()).thenAnswer((_) async => items);
    when(() => queue.count()).thenAnswer((_) async => items.length);
    when(() => repo.submit(any())).thenAnswer((_) async {});
    when(() => queue.remove(any())).thenAnswer((invocation) async {
      final id = invocation.positionalArguments.first as String;
      items = items.where((e) => e.id != id).toList();
    });

    final cubit = PodSyncCubit(repo, queue, conn);
    await cubit.syncNow();

    expect(cubit.state.pending, 0);
    expect(cubit.state.syncing, isFalse);
    verify(() => repo.submit(any())).called(2);
    await cubit.close();
  });

  test('syncNow: para na falha de rede e mantém pendentes', () async {
    when(() => queue.all()).thenAnswer((_) async => [_q('1'), _q('2')]);
    when(() => queue.count()).thenAnswer((_) async => 2);
    when(() => repo.submit(any())).thenThrow(const NetworkFailure());

    final cubit = PodSyncCubit(repo, queue, conn);
    await cubit.syncNow();

    expect(cubit.state.pending, 2);
    verifyNever(() => queue.remove(any()));
    await cubit.close();
  });

  test('init: define online e conta pendentes', () async {
    when(() => conn.isOnline()).thenAnswer((_) async => false);
    when(() => queue.count()).thenAnswer((_) async => 3);
    when(() => queue.all()).thenAnswer((_) async => [_q('1'), _q('2'), _q('3')]);

    final cubit = PodSyncCubit(repo, queue, conn);
    await cubit.init();

    expect(cubit.state.online, isFalse);
    expect(cubit.state.pending, 3);
    // offline → não tenta enviar
    verifyNever(() => repo.submit(any()));
    await cubit.close();
  });
}
