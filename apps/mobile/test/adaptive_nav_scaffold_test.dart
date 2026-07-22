import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:navix_mobile/app/shell/adaptive_nav_scaffold.dart';
import 'package:navix_mobile/app/theme/app_theme.dart';
import 'package:navix_mobile/l10n/gen/app_localizations.dart';

/// Cobre o comportamento adaptativo do [AdaptiveNavScaffold] (ADR-0072):
/// Bottom Navigation em telas estreitas, Navigation Rail em telas largas, com
/// o Drawer acessível e preservando o estado das abas (IndexedStack).
Widget _host(Widget child) => MaterialApp(
      theme: AppTheme.dark(),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: child,
    );

AdaptiveNavScaffold _scaffold() => const AdaptiveNavScaffold(
      breakpoint: 840,
      header: SizedBox(key: Key('header')),
      tabs: [
        NavTab(icon: Icons.home_outlined, selectedIcon: Icons.home, label: 'Home', page: Text('page-home')),
        NavTab(icon: Icons.list_outlined, selectedIcon: Icons.list, label: 'List', page: Text('page-list')),
      ],
      menu: [
        NavMenuEntry(icon: Icons.home_outlined, label: 'Home', tabIndex: 0),
        NavMenuEntry(icon: Icons.list_outlined, label: 'List', tabIndex: 1),
      ],
    );

Future<void> _setSize(WidgetTester tester, Size size) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
}

void main() {
  testWidgets('phone: mostra Bottom Navigation e nenhuma Rail', (tester) async {
    await _setSize(tester, const Size(400, 800));
    await tester.pumpWidget(_host(_scaffold()));
    await tester.pumpAndSettle();

    expect(find.byType(NavigationBar), findsOneWidget);
    expect(find.byType(NavigationRail), findsNothing);
  });

  testWidgets('tablet: substitui a Bottom Navigation pela Navigation Rail', (tester) async {
    await _setSize(tester, const Size(1200, 800));
    await tester.pumpWidget(_host(_scaffold()));
    await tester.pumpAndSettle();

    expect(find.byType(NavigationRail), findsOneWidget);
    expect(find.byType(NavigationBar), findsNothing);
  });

  testWidgets('troca de aba pela Bottom Navigation troca a página visível', (tester) async {
    await _setSize(tester, const Size(400, 800));
    await tester.pumpWidget(_host(_scaffold()));
    await tester.pumpAndSettle();

    // IndexedStack mantém ambas as páginas na árvore; a inicial é a visível.
    expect(find.text('page-home'), findsOneWidget);

    await tester.tap(find.text('List'));
    await tester.pumpAndSettle();

    final state = tester.state<AdaptiveNavScaffoldState>(find.byType(AdaptiveNavScaffold));
    expect(state.currentIndex, 1);
  });

  testWidgets('Drawer expõe o header e é aberto pelo botão de menu', (tester) async {
    await _setSize(tester, const Size(400, 800));
    await tester.pumpWidget(_host(_scaffold()));
    await tester.pumpAndSettle();

    final state = tester.state<AdaptiveNavScaffoldState>(find.byType(AdaptiveNavScaffold));
    state.openDrawer();
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('header')), findsOneWidget);
  });
}
