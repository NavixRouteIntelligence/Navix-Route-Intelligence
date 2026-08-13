import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../app/theme/navix_tokens.dart';
import '../../../core/maps/route_stops_map.dart';
import '../../../core/ui/navix_card.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../domain/my_route.dart';
import 'my_route_cubit.dart';
import 'route_map_markers.dart';
import 'stop_details_sheet.dart';

/// Altura do mapa embutido na lista.
///
/// 260 é o que sobra para ele sem empurrar o resumo e a sequência para fora do
/// primeiro ecrã. O mapa é contexto — quem precisa de o ler a sério abre-o.
const double _inlineMapHeight = 260;

/// O mapa da rota dentro da tela «Minha Rota».
///
/// Fica **depois** do cartão principal e antes do resto: a primeira coisa que
/// o motorista lê continua a ser para onde vai agora, e o mapa responde à
/// pergunta seguinte — «onde é isso em relação ao resto do dia».
class RouteMapSection extends StatelessWidget {
  const RouteMapSection({super.key, required this.route});

  final MyRoute route;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final markers = markersFrom(route);
    // As que o mapa **desenha**, e não todas. Com esta contagem a zero o mapa
    // está no estado vazio e já se explica sozinho; um aviso a dizer que falta
    // o traçado por cima disso seria um segundo texto a contradizer o primeiro.
    final desenhaveis = markers.where((m) => m.isPlottable).length;
    final semLocalizacao = route.stops.where((s) => s.latitude == null).length;
    final linha = route.line;

    return NavixCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 8, 4),
            child: Row(
              children: [
                Icon(Icons.map_outlined, size: 18, color: context.tokens.muted),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    l10n.routeMapTitle,
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.open_in_full),
                  tooltip: l10n.routeMapExpand,
                  onPressed: () => _abrirEcraInteiro(context),
                ),
              ],
            ),
          ),
          ClipRRect(
            borderRadius: const BorderRadius.vertical(
              bottom: Radius.circular(16),
            ),
            child: SizedBox(
              height: _inlineMapHeight,
              child: _Map(route: route),
            ),
          ),
          // Contado a partir das paradas, e dito em vez de escondido: uma
          // parada que não aparece no mapa continua a existir na lista, e o
          // motorista tem de saber que o mapa não é a rota toda.
          if (semLocalizacao > 0 && desenhaveis > 0)
            _Nota(l10n.routeMapWithoutLocation(semLocalizacao)),
          // O traçado é aproximado ou não existe — e isso diz-se. Uma linha que
          // salta paragens parece o percurso completo, e a ausência de linha
          // parece a app avariada. Nos dois casos as paragens e a ordem
          // continuam certas, que é o que a nota afirma (ADR-0131).
          if (desenhaveis > 0 && linha == null)
            _Nota(l10n.routeMapNoLine)
          else if (linha != null && linha.isPartial)
            _Nota(
              l10n.routeMapPartialLine(linha.totalStops - linha.coveredStops),
            ),
        ],
      ),
    );
  }

  void _abrirEcraInteiro(BuildContext context) {
    final cubit = context.read<MyRouteCubit>();
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => BlocProvider.value(
          value: cubit,
          child: const _FullScreenMapPage(),
        ),
      ),
    );
  }
}

/// O mapa em si, com o toque ligado à folha de detalhe.
class _Map extends StatelessWidget {
  const _Map({required this.route});

  final MyRoute route;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return RouteStopsMap(
      stops: markersFrom(route),
      line: route.line?.coordinates,
      onStopTap: (deliveryId) => _abrirDetalhe(context, deliveryId),
      emptyTitle: l10n.routeMapEmptyTitle,
      emptyDescription: l10n.routeMapEmptyDesc,
      missingTokenTitle: l10n.routeMapUnavailableTitle,
      missingTokenDescription: l10n.routeMapMissingToken,
      sdkUnavailableDescription: l10n.routeMapSdkUnavailable,
      recenterTooltip: l10n.routeMapRecenter,
      zoomInTooltip: l10n.routeMapZoomIn,
      zoomOutTooltip: l10n.routeMapZoomOut,
    );
  }

  void _abrirDetalhe(BuildContext context, String deliveryId) {
    for (final stop in route.stops) {
      if (stop.deliveryId != deliveryId) continue;
      showStopDetailsSheet(
        context,
        stop: stop,
        isNext: route.next?.id == deliveryId,
      );
      return;
    }
  }
}

/// O mapa em ecrã inteiro.
///
/// Continua a ler o Cubit: uma entrega registada enquanto isto está aberto tem
/// de mover o pino aqui também, senão o motorista fecha o mapa e encontra outra
/// rota — o que faria duvidar da que acabou de ver.
class _FullScreenMapPage extends StatelessWidget {
  const _FullScreenMapPage();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.routeMapTitle),
        leading: IconButton(
          icon: const Icon(Icons.close),
          tooltip: l10n.routeMapClose,
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: BlocBuilder<MyRouteCubit, MyRouteState>(
        buildWhen: (p, c) => p.route != c.route,
        builder: (context, state) => _Map(route: state.route),
      ),
    );
  }
}

/// Uma nota discreta por baixo do mapa.
///
/// `liveRegion` para que quem usa leitor de ecrã a ouça sem a procurar; é
/// informação a considerar, não um erro a interromper.
class _Nota extends StatelessWidget {
  const _Nota(this.texto);

  final String texto;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
        child: Semantics(
          liveRegion: true,
          child: Text(
            texto,
            style: TextStyle(color: context.tokens.muted, fontSize: 12),
          ),
        ),
      );
}
