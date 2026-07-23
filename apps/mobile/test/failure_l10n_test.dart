import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:navix_mobile/core/error/failure.dart';
import 'package:navix_mobile/core/error/failure_l10n.dart';
import 'package:navix_mobile/core/location/location_service.dart';
import 'package:navix_mobile/l10n/gen/app_localizations.dart';

/// Resolve o texto de [failure] no [locale] pedido, passando pelo mesmo caminho
/// que a UI usa (`context.failureText`).
Future<String> _text(WidgetTester tester, Failure failure, {Locale locale = const Locale('pt', 'BR')}) async {
  late String result;
  await tester.pumpWidget(MaterialApp(
    locale: locale,
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: Builder(builder: (context) {
      result = context.failureText(failure);
      return const SizedBox.shrink();
    }),
  ));
  await tester.pumpAndSettle();
  return result;
}

/// Uma instância de cada variante — o `switch` de `localizedMessage` é
/// exaustivo sobre a `sealed class`, então esta lista cobre todos os tipos.
const _allFailures = <Failure>[
  NetworkFailure(),
  ServerFailure(),
  UnauthorizedFailure(),
  InvalidCredentialsFailure(),
  ValidationFailure(),
  CacheFailure(),
  LocationFailure(LocationErrorReason.serviceDisabled),
  LocationFailure(LocationErrorReason.permissionDenied),
  LocationFailure(LocationErrorReason.permissionBlocked),
  OptimizationTimeoutFailure(),
  UnknownFailure(),
];

void main() {
  group('localizedMessage', () {
    testWidgets('toda falha tem texto nos 5 locales suportados', (tester) async {
      for (final locale in AppLocalizations.supportedLocales) {
        for (final failure in _allFailures) {
          final text = await _text(tester, failure, locale: locale);
          expect(text, isNotEmpty, reason: '$failure em $locale');
        }
      }
    });

    testWidgets('traduz por locale — nada de português fixo para quem usa en/es', (tester) async {
      expect(await _text(tester, const NetworkFailure(), locale: const Locale('en')),
          'No connection to the server.');
      expect(await _text(tester, const NetworkFailure(), locale: const Locale('es')),
          'Sin conexión con el servidor.');
      expect(await _text(tester, const NetworkFailure(), locale: const Locale('pt', 'BR')),
          'Sem conexão com o servidor.');
      expect(await _text(tester, const NetworkFailure(), locale: const Locale('pt', 'PT')),
          'Sem ligação ao servidor.');
    });

    testWidgets('pt-PT usa o vocabulário europeu, distinto de pt-BR', (tester) async {
      final pt = await _text(tester, const CacheFailure(), locale: const Locale('pt', 'PT'));
      final br = await _text(tester, const CacheFailure(), locale: const Locale('pt', 'BR'));
      expect(pt, contains('guardados'));
      expect(br, contains('salvos'));
    });

    testWidgets('credencial inválida não fala em sessão expirada', (tester) async {
      final invalid = await _text(tester, const InvalidCredentialsFailure(), locale: const Locale('en'));
      final expired = await _text(tester, const UnauthorizedFailure(), locale: const Locale('en'));
      expect(invalid, 'Incorrect email or password.');
      expect(invalid, isNot(expired));
    });

    testWidgets('detalhe do servidor prevalece sobre o texto genérico', (tester) async {
      expect(await _text(tester, const ServerFailure('Rota já otimizada.')), 'Rota já otimizada.');
      expect(await _text(tester, const ValidationFailure('CEP inválido.')), 'CEP inválido.');
    });

    testWidgets('sem detalhe do servidor, cai no texto localizado do tipo', (tester) async {
      expect(await _text(tester, const ServerFailure(), locale: const Locale('en')),
          "The server couldn't complete the request.");
      expect(await _text(tester, const ValidationFailure(), locale: const Locale('en')),
          "Some of the data isn't valid.");
    });

    testWidgets('cada motivo de localização tem a sua orientação', (tester) async {
      final texts = {
        for (final r in LocationErrorReason.values)
          r: await _text(tester, LocationFailure(r), locale: const Locale('en')),
      };
      expect(texts.values.toSet(), hasLength(LocationErrorReason.values.length));
      expect(texts[LocationErrorReason.permissionBlocked], contains('Settings'));
    });
  });
}
