import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:navix_mobile/features/deliveries/presentation/widgets/import_fab.dart';
import 'package:navix_mobile/l10n/gen/app_localizations.dart';

Widget _host(Widget child, {Locale locale = const Locale('pt', 'BR')}) => MaterialApp(
      locale: locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(floatingActionButton: child),
    );

void main() {
  testWidgets('mostra o rótulo localizado (pt-BR) e dispara onPressed ao tocar', (tester) async {
    var taps = 0;
    await tester.pumpWidget(_host(ImportFab(onPressed: () => taps++)));
    await tester.pumpAndSettle();

    expect(find.text('Importar'), findsOneWidget);
    expect(find.byIcon(Icons.upload_file_outlined), findsOneWidget);

    await tester.tap(find.byType(ImportFab));
    expect(taps, 1);
  });

  testWidgets('localiza o rótulo em inglês', (tester) async {
    await tester.pumpWidget(_host(ImportFab(onPressed: () {}), locale: const Locale('en')));
    await tester.pumpAndSettle();

    expect(find.text('Import'), findsOneWidget);
  });
}
