import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:mocktail/mocktail.dart';
import 'package:navix_mobile/app/theme/app_theme.dart';
import 'package:navix_mobile/core/connectivity/connectivity_service.dart';
import 'package:navix_mobile/core/location/location_service.dart';
import 'package:navix_mobile/features/driver/data/tracking_repository.dart';
import 'package:navix_mobile/features/pod/data/pod_queue_store.dart';
import 'package:navix_mobile/features/pod/data/pod_repository.dart';
import 'package:navix_mobile/features/pod/presentation/pod_capture_cubit.dart';
import 'package:navix_mobile/features/pod/presentation/pod_capture_sheet.dart';
import 'package:navix_mobile/features/pod/presentation/pod_sync_cubit.dart';
import 'package:navix_mobile/l10n/gen/app_localizations.dart';
import 'package:signature/signature.dart';

class _MockPodRepo extends Mock implements PodRepository {}

class _MockQueue extends Mock implements PodQueueStore {}

class _MockTracking extends Mock implements TrackingRepository {}

class _MockConn extends Mock implements ConnectivityService {}

/// Sem GPS — é o cenário do simulador e de um telemóvel sem permissão. O POD
/// não exige localização, então não deve bloquear o "Confirmar".
class _NoLocation implements LocationService {
  @override
  Future<LocationSample> current() async => throw Exception('sem GPS');
}

void main() {
  setUp(() {
    final conn = _MockConn();
    when(() => conn.onlineChanges)
        .thenAnswer((_) => const Stream<bool>.empty());

    GetIt.instance
      ..registerFactory<PodCaptureCubit>(
        () => PodCaptureCubit(
            _MockPodRepo(), _NoLocation(), _MockTracking(), _MockQueue()),
      )
      ..registerSingleton<PodSyncCubit>(
          PodSyncCubit(_MockPodRepo(), _MockQueue(), conn));
  });

  tearDown(() => GetIt.instance.reset());

  Future<void> openSheet(WidgetTester tester) async {
    // A folha usa ListView (lazy): na superfície padrão de teste (800x600) o
    // "Confirmar" fica abaixo da dobra e sequer é construído. Uma tela alta,
    // como a de um telemóvel real, garante que todos os elementos existam.
    tester.view.physicalSize = const Size(1000, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.dark(),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Builder(
          builder: (context) => Scaffold(
            body: ElevatedButton(
              onPressed: () =>
                  showPodCaptureSheet(context, deliveryId: 'del-1'),
              child: const Text('abrir'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('abrir'));
    await tester.pumpAndSettle();
  }

  FilledButton confirmButton(WidgetTester tester) =>
      tester.widget<FilledButton>(
        find.widgetWithText(FilledButton, 'Confirmar'),
      );

  testWidgets('Confirmar começa desabilitado (sem foto nem assinatura)',
      (tester) async {
    await openSheet(tester);

    expect(confirmButton(tester).onPressed, isNull);
    expect(find.text('Adicione foto ou assinatura para confirmar a entrega.'),
        findsOneWidget);
  });

  // O bug que isto trava: o SignatureController avisa a cada traço, mas nada
  // reconstruía a folha — o "Confirmar" lia `_sig.isNotEmpty` no build e
  // continuava desabilitado com a assinatura já desenhada. Na prática só
  // habilitava tirando foto, e assinar sozinho (que a tela oferece) não
  // fechava a entrega. Sem câmera no simulador, era um beco sem saída.
  testWidgets('assinar (sem foto) habilita o Confirmar', (tester) async {
    await openSheet(tester);
    expect(confirmButton(tester).onPressed, isNull);

    // Desenha um traço sobre a área de assinatura.
    final center = tester.getCenter(find.byType(Signature));
    final gesture = await tester.startGesture(center);
    await tester.pump();
    await gesture.moveTo(center + const Offset(30, 12));
    await tester.pump();
    await gesture.moveTo(center + const Offset(60, -12));
    await tester.pump();
    await gesture.up();
    await tester.pumpAndSettle();

    expect(
      confirmButton(tester).onPressed,
      isNotNull,
      reason:
          'a assinatura é prova suficiente; o botão tem de habilitar sozinho',
    );
    expect(find.text('Adicione foto ou assinatura para confirmar a entrega.'),
        findsNothing);
  });

  testWidgets('Limpar volta a desabilitar o Confirmar', (tester) async {
    await openSheet(tester);

    final center = tester.getCenter(find.byType(Signature));
    final gesture = await tester.startGesture(center);
    await tester.pump();
    await gesture.moveTo(center + const Offset(40, 10));
    await tester.pump();
    await gesture.up();
    await tester.pumpAndSettle();
    expect(confirmButton(tester).onPressed, isNotNull);

    await tester.tap(find.text('Limpar'));
    await tester.pumpAndSettle();

    expect(confirmButton(tester).onPressed, isNull);
  });
}
