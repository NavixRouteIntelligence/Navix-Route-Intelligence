import 'package:flutter/foundation.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart';

import 'map_config.dart';

/// Inicialização do Mapbox, num sítio só (ADR-0128).
///
/// Chamada uma vez no arranque. Espalhar `MapboxOptions.setAccessToken` pelos
/// widgets faria cada tela poder usar um token diferente — e descobrir isso
/// exigiria ler todas.
///
/// **Falha segura:** sem token, não inicializa e devolve `false`. Não lança: um
/// token de mapa em falta não pode impedir o motorista de ver a rota em lista,
/// registar uma entrega ou navegar pelo Google Maps. O mapa é um extra; a rota
/// não é.
///
/// ## Atribuição e telemetria
///
/// O SDK desenha o *wordmark* da Mapbox e o botão ⓘ sobre o mapa, e **não os
/// escondemos**. Não é só a licença a exigi-lo: o menu do ⓘ é onde vive o
/// *opt-out* de telemetria («Telemetry Settings»), e é o único caminho que a
/// pessoa tem para o alcançar. Esconder o botão por estética removeria a
/// escolha — numa app de trabalho, em que quem a usa já é localizado durante a
/// jornada, isso não é uma decisão de layout.
///
/// A v11 do SDK não expõe o interruptor de telemetria em Dart; ele é do menu
/// nativo. Qualquer widget de mapa desta app tem de manter os dois controlos
/// visíveis.
class MapBootstrap {
  const MapBootstrap._();

  static bool _initialized = false;

  /// `true` quando o mapa fica utilizável neste arranque.
  static bool initialize(MapConfig config) {
    if (!config.isEnabled) {
      // Um aviso só, e só em debug: em produção isto seria ruído a cada
      // arranque, e a informação já está no ecrã de diagnóstico.
      if (kDebugMode) {
        debugPrint(
          'Mapa desativado (${config.unavailableReason}). '
          'Passe --dart-define=MAPBOX_PUBLIC_TOKEN=pk.… para o ativar.',
        );
      }
      return false;
    }

    MapboxOptions.setAccessToken(config.accessToken);
    _initialized = true;
    return true;
  }

  /// O mapa já foi inicializado neste processo.
  static bool get isInitialized => _initialized;

  @visibleForTesting
  static void resetForTest() => _initialized = false;
}
