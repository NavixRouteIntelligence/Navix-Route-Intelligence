import 'package:flutter/material.dart';

import '../theme/navix_tokens.dart';

/// Aba primária: aparece na Bottom Navigation (phone) e na Navigation Rail
/// (tablet), e sua [page] vive num IndexedStack (estado preservado).
class NavTab {
  const NavTab({
    required this.icon,
    required this.selectedIcon,
    required this.label,
    required this.page,
  });

  final IconData icon;
  final IconData selectedIcon;
  final String label;
  final Widget page;
}

/// Item do menu lateral (Drawer). Se [tabIndex] != null, seleciona aquela aba;
/// senão dispara [onTap] (navegação por rota existente ou ação, ex.: logout).
class NavMenuEntry {
  const NavMenuEntry({
    required this.icon,
    required this.label,
    this.tabIndex,
    this.onTap,
    this.danger = false,
  });

  /// Divisória visual no menu (os demais campos são ignorados).
  const NavMenuEntry.divider()
      : icon = Icons.remove,
        label = '',
        tabIndex = null,
        onTap = null,
        danger = true;

  final IconData icon;
  final String label;
  final int? tabIndex;
  final VoidCallback? onTap;
  final bool danger;

  bool get isDivider => label.isEmpty && onTap == null && tabIndex == null;
}

/// Acesso à navegação a partir de qualquer descendente (páginas-aba abrem o
/// Drawer e trocam de aba sem conhecer o shell).
class AdaptiveNavScope extends InheritedWidget {
  const AdaptiveNavScope({required this.state, required super.child, super.key});

  final AdaptiveNavScaffoldState state;

  static AdaptiveNavScaffoldState? maybeOf(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<AdaptiveNavScope>()?.state;

  @override
  bool updateShouldNotify(AdaptiveNavScope oldWidget) => state != oldWidget.state;
}

/// Botão de menu (☰) que abre o Drawer do shell adaptativo. Colocável no
/// AppBar/topo de qualquer página-aba. No-op fora de um [AdaptiveNavScaffold].
class NavMenuButton extends StatelessWidget {
  const NavMenuButton({super.key, this.tooltip});

  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    final nav = AdaptiveNavScope.maybeOf(context);
    if (nav == null) return const SizedBox.shrink();
    return IconButton(
      tooltip: tooltip ?? MaterialLocalizations.of(context).openAppDrawerTooltip,
      icon: const Icon(Icons.menu),
      onPressed: nav.openDrawer,
    );
  }
}

/// Leading inteligente para o AppBar de uma página que serve como **aba** e
/// também pode ser **empurrada**: mostra o botão de voltar quando há rota para
/// voltar (empurrada), senão o botão de menu (aba, abre o Drawer).
class NavLeading extends StatelessWidget {
  const NavLeading({super.key});

  @override
  Widget build(BuildContext context) {
    final canPop = ModalRoute.of(context)?.canPop ?? false;
    return canPop ? const BackButton() : const NavMenuButton();
  }
}

/// **Componente único** de navegação adaptativa (ADR-0072).
/// - Phone (< [breakpoint]): Bottom Navigation + Drawer (botão de menu no topo).
/// - Tablet/largas (≥ [breakpoint]): Navigation Rail fixa à esquerda (substitui
///   a Bottom Navigation); o menu completo continua no Drawer, aberto pelo topo
///   da rail.
///
/// Reutilizado por Motorista e Empresa — só muda a config ([tabs]/[menu]/[header]).
/// Não altera regras de negócio nem estado: as páginas seguem intactas em um
/// IndexedStack; o menu apenas troca de aba ou navega por rotas existentes.
class AdaptiveNavScaffold extends StatefulWidget {
  const AdaptiveNavScaffold({
    required this.tabs,
    required this.menu,
    required this.header,
    this.breakpoint = 840,
    super.key,
  });

  final List<NavTab> tabs;
  final List<NavMenuEntry> menu;

  /// Cabeçalho do menu (avatar, nome, estado) — mesmo widget no Drawer e na rail.
  final Widget header;
  final double breakpoint;

  @override
  State<AdaptiveNavScaffold> createState() => AdaptiveNavScaffoldState();
}

class AdaptiveNavScaffoldState extends State<AdaptiveNavScaffold> {
  final _scaffoldKey = GlobalKey<ScaffoldState>();
  int _index = 0;

  int get currentIndex => _index;

  void selectTab(int index) {
    if (index < 0 || index >= widget.tabs.length) return;
    if (index != _index) setState(() => _index = index);
  }

  void openDrawer() => _scaffoldKey.currentState?.openDrawer();
  void closeDrawer() => _scaffoldKey.currentState?.closeDrawer();

  @override
  Widget build(BuildContext context) {
    // A largura vem do MediaQuery, NÃO de um LayoutBuilder: o LayoutBuilder
    // reconstrói na fase de *layout*, e ter o Scaffold com GlobalKey + o
    // InheritedWidget lá dentro corrompia a lista de elementos inativos ao
    // descartar o Drawer (assert `_elements.contains(element)`). O shell ocupa
    // a janela inteira, então MediaQuery e constraints coincidem.
    final wide = MediaQuery.sizeOf(context).width >= widget.breakpoint;
    final body = IndexedStack(
      index: _index,
      children: widget.tabs.map((t) => t.page).toList(),
    );

    return AdaptiveNavScope(
      state: this,
      child: Scaffold(
        key: _scaffoldKey,
        drawer: _NavDrawer(
          header: widget.header,
          menu: widget.menu,
          currentIndex: _index,
        ),
        body: wide
            ? Row(
                children: [
                  _NavRail(
                    tabs: widget.tabs,
                    index: _index,
                    onSelect: selectTab,
                    onMenu: openDrawer,
                  ),
                  const VerticalDivider(width: 1, thickness: 1),
                  Expanded(child: body),
                ],
              )
            : body,
        bottomNavigationBar: wide
            ? null
            : NavigationBar(
                selectedIndex: _index,
                onDestinationSelected: selectTab,
                destinations: [
                  for (final t in widget.tabs)
                    NavigationDestination(
                      icon: Icon(t.icon),
                      selectedIcon: Icon(t.selectedIcon),
                      label: t.label,
                    ),
                ],
              ),
      ),
    );
  }
}

/// Navigation Rail fixa (tablet): botão de menu no topo (abre o Drawer completo)
/// + as abas primárias. Substitui a Bottom Navigation.
class _NavRail extends StatelessWidget {
  const _NavRail({
    required this.tabs,
    required this.index,
    required this.onSelect,
    required this.onMenu,
  });

  final List<NavTab> tabs;
  final int index;
  final ValueChanged<int> onSelect;
  final VoidCallback onMenu;

  @override
  Widget build(BuildContext context) {
    return NavigationRail(
      selectedIndex: index,
      onDestinationSelected: onSelect,
      labelType: NavigationRailLabelType.all,
      leading: Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: IconButton(
          tooltip: MaterialLocalizations.of(context).openAppDrawerTooltip,
          icon: const Icon(Icons.menu),
          onPressed: onMenu,
        ),
      ),
      destinations: [
        for (final t in tabs)
          NavigationRailDestination(
            icon: Icon(t.icon),
            selectedIcon: Icon(t.selectedIcon),
            label: Text(t.label),
          ),
      ],
    );
  }
}

/// Drawer reutilizável: cabeçalho (avatar/nome/estado) + menu completo. Uma
/// seleção de aba fecha o drawer e troca a aba; uma ação navega por rota.
class _NavDrawer extends StatelessWidget {
  const _NavDrawer({required this.header, required this.menu, required this.currentIndex});

  final Widget header;
  final List<NavMenuEntry> menu;
  final int currentIndex;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final nav = AdaptiveNavScope.maybeOf(context);
    return Drawer(
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(padding: const EdgeInsets.fromLTRB(16, 16, 16, 8), child: header),
            Divider(height: 1, color: t.line),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: 8),
                children: [
                  for (final e in menu)
                    if (e.isDivider)
                      Divider(height: 16, color: t.line)
                    else
                      _NavDrawerTile(
                        entry: e,
                        selected: e.tabIndex != null && e.tabIndex == currentIndex,
                        onTap: () {
                          nav?.closeDrawer();
                          if (e.tabIndex != null) {
                            nav?.selectTab(e.tabIndex!);
                          } else {
                            e.onTap?.call();
                          }
                        },
                      ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _NavDrawerTile extends StatelessWidget {
  const _NavDrawerTile({required this.entry, required this.selected, required this.onTap});

  final NavMenuEntry entry;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final primary = Theme.of(context).colorScheme.primary;
    final color = entry.danger ? t.danger : (selected ? primary : Theme.of(context).colorScheme.onSurface);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      child: Material(
        color: selected ? primary.withValues(alpha: 0.12) : Colors.transparent,
        borderRadius: BorderRadius.circular(12),
        child: ListTile(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          selected: selected,
          leading: Icon(entry.icon, color: color, size: 22),
          title: Text(
            entry.label,
            style: TextStyle(color: color, fontWeight: selected ? FontWeight.w700 : FontWeight.w500),
          ),
          onTap: onTap,
        ),
      ),
    );
  }
}
