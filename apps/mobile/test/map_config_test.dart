import 'package:flutter_test/flutter_test.dart';
import 'package:navix_mobile/core/maps/map_config.dart';

/// Guarda a regra que impede a fatura aberta (ADR-0128): o token que entra no
/// binário é público e só público.
void main() {
  MapConfig com(String token) =>
      MapConfig(accessToken: token, environment: 'dev');

  group('MapConfig', () {
    test('token público válido ativa o mapa', () {
      expect(com('pk.eyJ1IjoibmF2aXgiLCJhIjoiY2wifQ.abc').isEnabled, isTrue);
    });

    // Sem `defaultValue` no dart-define, um build mal configurado fica sem
    // token — e o mapa não aparece, em vez de aparecer na conta de outro
    // ambiente.
    test('sem token, o mapa fica desativado e diz porquê', () {
      final c = com('');

      expect(c.isEnabled, isFalse);
      expect(c.unavailableReason, MapUnavailableReason.missingToken);
    });

    // Um `sk.` é um token **secreto**: chama Directions e Matrix, que custam
    // por pedido. Dentro de um binário, é uma fatura aberta.
    test('token secreto é recusado, não usado', () {
      final c = com('sk.eyJ1IjoibmF2aXgiLCJhIjoiY2wifQ.segredo');

      expect(c.isEnabled, isFalse);
      expect(c.unavailableReason, MapUnavailableReason.invalidToken);
    });

    test('qualquer coisa que não seja `pk.` é recusada', () {
      for (final t in ['tk.abc', 'Bearer pk.abc', 'abc', 'PK.ABC']) {
        expect(com(t).isEnabled, isFalse, reason: t);
      }
    });

    // Um `pk.` truncado por um dart-define mal escapado não passa por válido.
    test('token demasiado curto não conta como válido', () {
      expect(com('pk.abc').isEnabled, isFalse);
    });

    test('o ambiente acompanha a configuração, para o diagnóstico', () {
      expect(
          const MapConfig(accessToken: '', environment: 'staging').environment,
          'staging');
    });

    test('a leitura do ambiente não inventa token', () {
      // Sem `--dart-define` no processo de teste, o token é vazio: é
      // exatamente o que se quer que aconteça num build mal configurado.
      expect(MapConfig.fromEnvironment().isEnabled, isFalse);
    });
  });
}
