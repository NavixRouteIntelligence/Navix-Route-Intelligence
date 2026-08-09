import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Cache do último resumo lido (ADR-0122).
///
/// Guardado em armazenamento **seguro**, e não em `SharedPreferences`: o resumo
/// é sobre uma pessoa — quantas entregas fez, quanto tempo esteve ativa — e
/// escrevê-lo em claro no disco seria tratá-lo como preferência de tema.
///
/// Serve a um caso só: abrir a app sem rede e ainda ver o resumo de ontem, com
/// a data que ele tinha. Não é sincronização nem fila de escrita — não há nada
/// para enviar de volta.
class KaizenCache {
  KaizenCache([FlutterSecureStorage? storage])
      : _storage = storage ?? const FlutterSecureStorage();

  static const _key = 'kaizen.daily.last';

  final FlutterSecureStorage _storage;

  Future<void> save(Map<String, dynamic> payload) async {
    await _storage.write(key: _key, value: jsonEncode(payload));
  }

  /// `null` quando não há nada guardado — ou quando o que está guardado deixou
  /// de ser legível. Um cache corrompido não pode impedir a app de abrir.
  Future<Map<String, dynamic>?> read() async {
    final raw = await _storage.read(key: _key);
    if (raw == null) return null;
    try {
      final json = jsonDecode(raw);
      return json is Map<String, dynamic> ? json : null;
    } on FormatException {
      return null;
    }
  }

  /// Sair da sessão apaga o resumo: o dado é da pessoa, não do aparelho.
  Future<void> clear() => _storage.delete(key: _key);
}
