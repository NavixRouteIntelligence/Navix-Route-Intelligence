import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:mocktail/mocktail.dart';
import 'package:navix_mobile/app/theme/app_theme.dart';
import 'package:navix_mobile/core/security/biometric_service.dart';
import 'package:navix_mobile/features/auth/presentation/login_page.dart';
import 'package:navix_mobile/l10n/gen/app_localizations.dart';

class _MockBiometric extends Mock implements BiometricService {}

void main() {
  setUp(() {
    final biometric = _MockBiometric();
    when(biometric.isAvailable).thenAnswer((_) async => true);
    GetIt.instance.registerSingleton<BiometricService>(biometric);
  });

  tearDown(() => GetIt.instance.reset());

  testWidgets('apresenta a nova receção sem perder as ações de acesso', (
    tester,
  ) async {
    tester.view
      ..physicalSize = const Size(390, 844)
      ..devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.dark(),
        locale: const Locale('pt', 'BR'),
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: AppLocalizations.supportedLocales,
        home: const LoginPage(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Olá, seja bem-vindo(a) à Navix'), findsOneWidget);
    expect(
      find.text('Sua rota, mais inteligente. Cada entrega, mais simples.'),
      findsOneWidget,
    );
    expect(find.text('Não possui conta?'), findsOneWidget);
    expect(find.text('Criar conta'), findsOneWidget);
    expect(find.text('Recebi um convite'), findsOneWidget);
    expect(find.byIcon(Icons.alternate_email_rounded), findsOneWidget);
    expect(find.byIcon(Icons.visibility_off_outlined), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
