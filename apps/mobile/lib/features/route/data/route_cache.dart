import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Cache do último instantâneo da rota (ADR-0134).
///
/// Guardado em armazenamento **seguro**, e não em `SharedPreferences`: uma rota
/// é a lista de moradas dos clientes de alguém. Escrevê-la em claro no disco
/// seria tratar a casa de um cliente como preferência de tema — e é o mesmo
/// critério que a ADR-0122 aplicou ao resumo diário.
///
/// Serve a um caso só: abrir a app sem rede e ainda ver as paragens de hoje e
/// por que ordem. Não é sincronização nem fila de escrita — o motorista não
/// altera a rota offline, e nada daqui volta para o servidor.
class RouteCache {
  RouteCache([FlutterSecureStorage? storage])
      : _storage = storage ?? const FlutterSecureStorage();

  static const _key = 'route.current.last';

  final FlutterSecureStorage _storage;

  Future<void> save(Map<String, dynamic> payload) async {
    // Uma falha de escrita não pode impedir a rota de aparecer: o cache é um
    // extra, e a resposta já está em memória.
    try {
      await _storage.write(key: _key, value: jsonEncode(payload));
    } catch (_) {
      // Sem cache desta vez. Na próxima leitura tenta-se outra vez.
    }
  }

  /// `null` quando não há nada guardado — ou quando o que está guardado deixou
  /// de ser legível. Um cache corrompido não pode impedir a app de abrir.
  Future<Map<String, dynamic>?> read() async {
    try {
      final raw = await _storage.read(key: _key);
      if (raw == null) return null;
      final json = jsonDecode(raw);
      return json is Map<String, dynamic> ? json : null;
    } catch (_) {
      return null;
    }
  }

  /// Sair da sessão apaga a rota: as moradas são dos clientes de quem saiu, e
  /// o aparelho pode ser o mesmo para outra pessoa amanhã.
  Future<void> clear() async {
    try {
      await _storage.delete(key: _key);
    } catch (_) {
      // Nada a fazer: o próximo arranque lê e descarta o que não servir.
    }
  }
}
