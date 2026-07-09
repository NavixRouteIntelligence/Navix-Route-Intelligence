import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Dados persistidos da sessão (fora os tokens, guardados em chaves próprias).
class StoredUser {
  const StoredUser({
    required this.id,
    required this.tenantId,
    required this.email,
    required this.roles,
  });

  final String id;
  final String tenantId;
  final String email;
  final List<String> roles;

  Map<String, dynamic> toJson() => {
        'id': id,
        'tenantId': tenantId,
        'email': email,
        'roles': roles,
      };

  factory StoredUser.fromJson(Map<String, dynamic> json) => StoredUser(
        id: json['id'] as String,
        tenantId: json['tenantId'] as String,
        email: json['email'] as String,
        roles: (json['roles'] as List<dynamic>).map((e) => e as String).toList(),
      );
}

/// Armazém seguro (Keychain/Keystore) para tokens e sessão. Fonte de verdade dos
/// tokens — consumido pelo interceptor de rede e pelo SessionCubit.
class SecureSessionStore {
  SecureSessionStore([FlutterSecureStorage? storage])
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
            );

  final FlutterSecureStorage _storage;

  static const _kAccess = 'navix.access';
  static const _kRefresh = 'navix.refresh';
  static const _kUser = 'navix.user';
  static const _kBiometric = 'navix.biometric';
  static const _kKeepConnected = 'navix.keepConnected';

  Future<void> saveSession({
    required String accessToken,
    required String refreshToken,
    required StoredUser user,
  }) async {
    await _storage.write(key: _kAccess, value: accessToken);
    await _storage.write(key: _kRefresh, value: refreshToken);
    await _storage.write(key: _kUser, value: jsonEncode(user.toJson()));
  }

  Future<void> updateTokens({required String accessToken, required String refreshToken}) async {
    await _storage.write(key: _kAccess, value: accessToken);
    await _storage.write(key: _kRefresh, value: refreshToken);
  }

  Future<String?> readAccessToken() => _storage.read(key: _kAccess);
  Future<String?> readRefreshToken() => _storage.read(key: _kRefresh);

  Future<StoredUser?> readUser() async {
    final raw = await _storage.read(key: _kUser);
    if (raw == null) return null;
    return StoredUser.fromJson(jsonDecode(raw) as Map<String, dynamic>);
  }

  Future<bool> hasSession() async => (await _storage.read(key: _kRefresh)) != null;

  Future<void> setBiometricEnabled(bool enabled) =>
      _storage.write(key: _kBiometric, value: enabled ? '1' : '0');

  Future<bool> isBiometricEnabled() async => (await _storage.read(key: _kBiometric)) == '1';

  /// "Manter conectado" — quando desligado, a sessão não é restaurada no início.
  Future<void> setKeepConnected(bool value) =>
      _storage.write(key: _kKeepConnected, value: value ? '1' : '0');

  Future<bool> isKeepConnected() async => (await _storage.read(key: _kKeepConnected)) != '0';

  Future<void> clear() async {
    await _storage.delete(key: _kAccess);
    await _storage.delete(key: _kRefresh);
    await _storage.delete(key: _kUser);
    // Preferência de biometria é mantida entre logins do mesmo dispositivo.
  }
}
