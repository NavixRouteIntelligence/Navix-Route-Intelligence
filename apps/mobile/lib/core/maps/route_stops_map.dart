import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart';

import '../../app/theme/navix_tokens.dart';
import '../ui/navix_states.dart';
import 'map_bootstrap.dart';
import 'map_config.dart';
import 'route_stop_marker.dart';
import 'stop_marker_painter.dart';

/// O mapa das paradas de uma rota.
///
/// **Não conhece a tela nem o Cubit.** Recebe uma lista de [RouteStopMarker] e
/// devolve pixels; quem os monta a partir do estado é o chamador. É o que
/// permite que a mesma peça sirva a rota do dia, uma rota histórica e a
/// pré-visualização de uma reordenação sem que nenhuma delas conheça as outras.
///
/// ## O que este mapa não desenha
///
/// **Não há linha entre as paradas.** Ligar os pinos por segmentos retos
/// desenharia um percurso que não existe: atravessa quarteirões, rios e
/// sentidos proibidos, e a distância que sugere não é a que se conduz. Enquanto
/// o traçado real não vier do backend, a ausência de linha é a leitura honesta
/// — os pinos dizem *onde*, e a lista ao lado diz *por que ordem*.
class RouteStopsMap extends StatefulWidget {
  const RouteStopsMap({
    super.key,
    required this.stops,
    this.driverPosition,
    this.line,
    this.onStopTap,
    this.isLoading = false,
    this.config,
    this.isSdkReady,
    this.emptyTitle = 'Sem pontos para mostrar',
    this.emptyDescription =
        'Nenhuma parada desta rota tem morada localizável no mapa.',
    this.missingTokenTitle = 'Mapa indisponível',
    this.missingTokenDescription =
        'Esta versão da app foi publicada sem a chave do mapa. '
            'A rota continua disponível na lista.',
    this.sdkUnavailableDescription = 'O mapa não arrancou neste dispositivo. '
        'A rota continua disponível na lista.',
    this.recenterTooltip = 'Enquadrar a rota',
    this.zoomInTooltip = 'Aproximar',
    this.zoomOutTooltip = 'Afastar',
  });

  /// As paradas, na sequência otimizada. As que não têm coordenada válida são
  /// ignoradas — e só elas.
  final List<RouteStopMarker> stops;

  /// Onde o motorista está agora, se se souber.
  final DriverPosition? driverPosition;

  /// O traçado real, no formato do GeoJSON (**longitude primeiro**).
  ///
  /// `null` desenha apenas os pontos. Não há aqui um caminho que ligue os pinos
  /// por retas: uma reta entre paragens atravessa quarteirões e sugere uma
  /// distância que não é a que se conduz (ADR-0125).
  final List<List<double>>? line;

  /// Chamado com o `deliveryId` da parada tocada. O widget não sabe o que
  /// mostrar a seguir — quem o embute é que decide.
  final ValueChanged<String>? onStopTap;

  /// A rota ainda está a ser carregada.
  final bool isLoading;

  /// Injetável para teste. Em produção lê os `--dart-define` do build.
  final MapConfig? config;

  /// Injetável para teste. Em produção pergunta ao [MapBootstrap].
  final bool? isSdkReady;

  final String emptyTitle;
  final String emptyDescription;
  final String missingTokenTitle;
  final String missingTokenDescription;
  final String sdkUnavailableDescription;
  final String recenterTooltip;
  final String zoomInTooltip;
  final String zoomOutTooltip;

  @override
  State<RouteStopsMap> createState() => _RouteStopsMapState();
}

/// Identificadores da fonte e da camada do traçado no estilo do mapa.
const _lineSourceId = 'navix-route-line';
const _lineLayerId = 'navix-route-line-layer';

class _RouteStopsMapState extends State<RouteStopsMap> {
  MapboxMap? _map;
  PointAnnotationManager? _manager;

  /// O que está desenhado agora, indexado por entrega. É a memória contra a
  /// qual o *diff* corre.
  final Map<String, PointAnnotation> _drawn = {};
  List<RouteStopMarker> _rendered = const [];

  PointAnnotation? _driverAnnotation;
  DriverPosition? _renderedDriver;

  /// Uma sincronização de cada vez. Duas atualizações em cima uma da outra
  /// criariam o mesmo pino duas vezes — o `create` é assíncrono e o mapa não
  /// tem noção de identidade nossa.
  bool _syncing = false;
  bool _resyncPending = false;

  /// A câmara só se enquadra sozinha uma vez.
  bool _fitted = false;

  /// Subscrição dos toques nos pinos, cancelada ao sair.
  Cancelable? _tapSubscription;

  /// O traçado que está desenhado agora. Sem isto, cada reconstrução do widget
  /// reescreveria a mesma linha no estilo.
  List<List<double>>? _drawnLine;

  /// O estilo já tem a fonte e a camada da linha.
  bool _lineReady = false;

  /// Estilo e escala com que os pinos atuais foram pintados. Se o tema ou o
  /// Dynamic Type mudarem, os bitmaps ficam desatualizados e têm de ser
  /// repintados — um pino desenhado para o tema claro fica ilegível no escuro.
  Brightness? _paintedFor;
  double? _paintedScale;

  MapConfig get _config => widget.config ?? MapConfig.fromEnvironment();

  bool get _sdkReady => widget.isSdkReady ?? MapBootstrap.isInitialized;

  List<RouteStopMarker> get _plottable =>
      widget.stops.where((s) => s.isPlottable).toList();

  @override
  void didUpdateWidget(covariant RouteStopsMap oldWidget) {
    super.didUpdateWidget(oldWidget);
    unawaited(_syncLine());
    unawaited(_sync());
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final brightness = Theme.of(context).brightness;
    final scale = MediaQuery.textScalerOf(context).scale(14) / 14;
    if (_paintedFor != null &&
        (_paintedFor != brightness || _paintedScale != scale)) {
      // Repintar tudo é o caminho certo **aqui**: mudou o que desenha cada
      // pino, não quais os pinos. É raro (trocar de tema, mexer no tamanho da
      // letra) e não é o caso que o critério de aceite protege.
      _rendered = const [];
      unawaited(_sync());
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_config.isEnabled) {
      return _MapNotice(
        icon: Icons.map_outlined,
        title: widget.missingTokenTitle,
        description: widget.missingTokenDescription,
      );
    }

    if (!_sdkReady) {
      return _MapNotice(
        icon: Icons.map_outlined,
        title: widget.missingTokenTitle,
        description: widget.sdkUnavailableDescription,
      );
    }

    if (widget.isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_plottable.isEmpty) {
      return NavixEmptyState(
        icon: Icons.location_off_outlined,
        title: widget.emptyTitle,
        description: widget.emptyDescription,
      );
    }

    final dark = Theme.of(context).brightness == Brightness.dark;
    return Stack(
      children: [
        Positioned.fill(
          child: MapWidget(
            key: const ValueKey('route-stops-map'),
            styleUri: dark ? MapboxStyles.DARK : MapboxStyles.LIGHT,
            onMapCreated: _onMapCreated,
            onStyleLoadedListener: (_) => unawaited(_onStyleLoaded(_map!)),
          ),
        ),
        // Controlos em cima à direita, e não em baixo: em baixo vivem o
        // *wordmark* da Mapbox e o botão ⓘ, que não se tapam (ADR-0128) — o ⓘ
        // é o único caminho para o opt-out de telemetria.
        Positioned(
          top: 12,
          right: 12,
          child: Column(
            children: [
              _MapButton(
                icon: Icons.center_focus_strong_outlined,
                tooltip: widget.recenterTooltip,
                onPressed: () => unawaited(_fitToStops()),
              ),
              const SizedBox(height: 8),
              _MapButton(
                icon: Icons.add,
                tooltip: widget.zoomInTooltip,
                onPressed: () => unawaited(_zoomBy(1)),
              ),
              const SizedBox(height: 8),
              _MapButton(
                icon: Icons.remove,
                tooltip: widget.zoomOutTooltip,
                onPressed: () => unawaited(_zoomBy(-1)),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _onMapCreated(MapboxMap map) async {
    _map = map;
  }

  /// O estilo carregou: é aqui que a linha e os pinos entram, **por esta
  /// ordem**.
  ///
  /// A ordem é o que põe o traçado por baixo dos marcadores: o Mapbox empilha
  /// as camadas por ordem de adição, e o gestor de anotações cria a sua própria
  /// camada quando é construído. Criá-lo antes da linha desenharia a linha por
  /// cima dos pinos — e um traçado sobre o número da paragem tapa exatamente o
  /// que se precisa de ler.
  ///
  /// Um estilo pode recarregar (troca de tema, por exemplo), e então tudo isto
  /// volta a correr sobre um estilo limpo.
  Future<void> _onStyleLoaded(MapboxMap map) async {
    _lineReady = false;
    _drawnLine = null;
    await _syncLine();

    if (_manager == null) {
      final manager = await map.annotations.createPointAnnotationManager();
      if (!mounted) return;
      _manager = manager;
      _tapSubscription = manager.tapEvents(onTap: _onAnnotationTap);
    }
    await _sync();
  }

  /// Escreve o traçado no estilo, e só quando ele mudou.
  Future<void> _syncLine() async {
    final map = _map;
    if (map == null || !mounted) return;

    final linha = widget.line;
    if (_listEquals(linha, _drawnLine) && _lineReady) return;

    // A cor é lida **antes** de qualquer `await`: depois de um, este contexto
    // pode já não estar montado.
    final cor = Theme.of(context).colorScheme.primary.toARGB32();

    final geojson = jsonEncode({
      'type': 'Feature',
      'properties': const <String, Object?>{},
      'geometry': {
        'type': 'LineString',
        // Sem traçado a fonte fica com uma linha vazia em vez de ser removida:
        // remover e recriar a camada fá-la-ia saltar para cima dos pinos na
        // próxima vez, porque voltaria a ser a última a entrar no estilo.
        'coordinates': linha ?? const <List<double>>[],
      },
    });

    if (!_lineReady) {
      await map.style
          .addSource(GeoJsonSource(id: _lineSourceId, data: geojson));
      await map.style.addLayer(
        LineLayer(
          id: _lineLayerId,
          sourceId: _lineSourceId,
          lineJoin: LineJoin.ROUND,
          lineCap: LineCap.ROUND,
          lineWidth: 5,
          // Opaca a 85%: a linha tem de se ver sobre o mapa sem apagar os
          // nomes das ruas por baixo dela, que é como o motorista confirma que
          // o traçado passa onde ele pensa.
          lineOpacity: 0.85,
          lineColor: cor,
        ),
      );
      _lineReady = true;
    } else {
      await map.style.setStyleSourceProperty(_lineSourceId, 'data', geojson);
    }

    _drawnLine = linha;
  }

  /// O SDK devolve a anotação tocada, com a identidade **dele**. Traduzimos
  /// para a nossa procurando no mesmo mapa que usámos para a criar — o id do
  /// Mapbox não significa nada fora do mapa.
  void _onAnnotationTap(PointAnnotation annotation) {
    final callback = widget.onStopTap;
    if (callback == null) return;
    for (final entry in _drawn.entries) {
      if (entry.value.id == annotation.id) {
        callback(entry.key);
        return;
      }
    }
  }

  @override
  void dispose() {
    _tapSubscription?.cancel();
    super.dispose();
  }

  /// Aplica ao mapa só o que mudou.
  Future<void> _sync() async {
    final manager = _manager;
    if (manager == null || !mounted) return;

    if (_syncing) {
      _resyncPending = true;
      return;
    }
    _syncing = true;

    try {
      final brightness = Theme.of(context).brightness;
      final media = MediaQuery.of(context);
      final scale = media.textScaler.scale(14) / 14;
      final palette = StopMarkerPalette.of(context);
      final ratio = media.devicePixelRatio;

      final next = _plottable;
      final diff = diffMarkers(_rendered, next);

      if (diff.isNotEmpty) {
        for (final id in diff.removed) {
          final annotation = _drawn.remove(id);
          if (annotation != null) await manager.delete(annotation);
        }

        for (final marker in diff.added) {
          final image = await paintStopMarker(
            sequence: marker.sequence,
            status: marker.status,
            palette: palette,
            textScale: scale,
            devicePixelRatio: ratio,
          );
          _drawn[marker.deliveryId] = await manager.create(
            PointAnnotationOptions(
              geometry: _pointOf(marker.latitude!, marker.longitude!),
              image: image,
              iconSize: 1 / ratio,
              // A próxima parada desenha-se por cima das outras quando se
              // sobrepõem. É a que se precisa de ver.
              symbolSortKey: marker.status == RouteStopStatus.next ? 1000 : 0,
            ),
          );
        }

        for (final marker in diff.updated) {
          final annotation = _drawn[marker.deliveryId];
          if (annotation == null) continue;
          annotation
            ..geometry = _pointOf(marker.latitude!, marker.longitude!)
            ..image = await paintStopMarker(
              sequence: marker.sequence,
              status: marker.status,
              palette: palette,
              textScale: scale,
              devicePixelRatio: ratio,
            )
            ..symbolSortKey = marker.status == RouteStopStatus.next ? 1000 : 0;
          await manager.update(annotation);
        }

        _rendered = next;
        _paintedFor = brightness;
        _paintedScale = scale;
      }

      await _syncDriver(manager, palette, scale, ratio);

      if (!_fitted && next.isNotEmpty) {
        _fitted = true;
        await _fitToStops();
      }
    } finally {
      _syncing = false;
      if (_resyncPending && mounted) {
        _resyncPending = false;
        unawaited(_sync());
      }
    }
  }

  Future<void> _syncDriver(
    PointAnnotationManager manager,
    StopMarkerPalette palette,
    double scale,
    double ratio,
  ) async {
    final position = widget.driverPosition;
    final valid = position != null && position.isPlottable;

    if (!valid) {
      final existing = _driverAnnotation;
      if (existing != null) {
        await manager.delete(existing);
        _driverAnnotation = null;
        _renderedDriver = null;
      }
      return;
    }

    if (_renderedDriver == position && _driverAnnotation != null) return;

    final geometry = _pointOf(position.latitude, position.longitude);
    final existing = _driverAnnotation;
    if (existing != null) {
      // Mover é a operação certa: o motorista mexe-se a cada poucos segundos, e
      // apagar-e-recriar fá-lo-ia piscar durante toda a jornada.
      existing.geometry = geometry;
      await manager.update(existing);
    } else {
      _driverAnnotation = await manager.create(
        PointAnnotationOptions(
          geometry: geometry,
          image: await paintDriverMarker(
            palette: palette,
            textScale: scale,
            devicePixelRatio: ratio,
          ),
          iconSize: 1 / ratio,
          // Sempre por baixo dos pinos numerados: a posição é contexto, as
          // paradas são a tarefa.
          symbolSortKey: -1,
        ),
      );
    }
    _renderedDriver = position;
  }

  /// Enquadra todas as coordenadas válidas, com margem.
  ///
  /// A margem não é estética: sem ela um pino no extremo fica meio cortado pela
  /// borda, e um pino meio cortado lê-se como uma parada que não se percebe
  /// onde está. A de cima é maior porque é onde estão os controlos.
  Future<void> _fitToStops() async {
    final map = _map;
    if (map == null) return;

    final coordinates = [
      for (final m in _plottable) _pointOf(m.latitude!, m.longitude!),
      if (widget.driverPosition?.isPlottable == true)
        _pointOf(
          widget.driverPosition!.latitude,
          widget.driverPosition!.longitude,
        ),
    ];
    if (coordinates.isEmpty) return;

    final camera = await map.cameraForCoordinatesPadding(
      coordinates,
      CameraOptions(padding: null),
      MbxEdgeInsets(top: 72, left: 48, bottom: 48, right: 72),
      // Uma parada só não tem enquadramento — o cálculo devolveria o zoom
      // máximo e o motorista veria o telhado do prédio. 15 é a rua.
      coordinates.length == 1 ? 15 : null,
      null,
    );
    await map.flyTo(camera, MapAnimationOptions(duration: 600));
  }

  Future<void> _zoomBy(double delta) async {
    final map = _map;
    if (map == null) return;
    final state = await map.getCameraState();
    await map.flyTo(
      CameraOptions(zoom: state.zoom + delta, center: state.center),
      MapAnimationOptions(duration: 250),
    );
  }

  /// Comparação por valor de duas linhas. `List` compara por identidade, e sem
  /// isto uma lista igual reconstruída seria sempre «diferente».
  bool _listEquals(List<List<double>>? a, List<List<double>>? b) {
    if (identical(a, b)) return true;
    if (a == null || b == null) return false;
    if (a.length != b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i].length != b[i].length) return false;
      for (var j = 0; j < a[i].length; j++) {
        if (a[i][j] != b[i][j]) return false;
      }
    }
    return true;
  }

  Point _pointOf(double latitude, double longitude) =>
      // Nomeado, e não `Position(lng, lat)`: trocar a ordem produz um ponto
      // perfeitamente válido no hemisfério errado, e nada falha.
      Point(coordinates: Position.named(lat: latitude, lng: longitude));
}

/// Aviso ocupando o lugar do mapa. Fala do mapa e não da rota — a rota está
/// bem, e dizer «erro» aqui faria o motorista duvidar das entregas.
class _MapNotice extends StatelessWidget {
  const _MapNotice({
    required this.icon,
    required this.title,
    required this.description,
  });

  final IconData icon;
  final String title;
  final String description;

  @override
  Widget build(BuildContext context) => NavixEmptyState(
        icon: icon,
        title: title,
        description: description,
      );
}

class _MapButton extends StatelessWidget {
  const _MapButton({
    required this.icon,
    required this.tooltip,
    required this.onPressed,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Tooltip(
      message: tooltip,
      child: Material(
        color: scheme.surface,
        shape: CircleBorder(side: BorderSide(color: context.tokens.line)),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onPressed,
          // 44 pontos é o alvo mínimo tocável, e este é tocado com uma mão só,
          // em movimento, muitas vezes com luva.
          child: SizedBox(
            width: 44,
            height: 44,
            child: Semantics(
              button: true,
              label: tooltip,
              child: Icon(icon, size: 22, color: scheme.onSurface),
            ),
          ),
        ),
      ),
    );
  }
}
