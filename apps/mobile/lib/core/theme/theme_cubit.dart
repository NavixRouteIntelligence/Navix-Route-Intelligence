import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../storage/secure_session_store.dart';

/// Controla o modo de tema (escuro é o padrão) e o persiste.
class ThemeCubit extends Cubit<ThemeMode> {
  ThemeCubit(this._store) : super(ThemeMode.dark);

  final SecureSessionStore _store;

  Future<void> bootstrap() async {
    emit(_fromName(await _store.readThemeName()));
  }

  Future<void> setMode(ThemeMode mode) async {
    emit(mode);
    await _store.setThemeName(_toName(mode));
  }

  ThemeMode _fromName(String name) => switch (name) {
        'light' => ThemeMode.light,
        'system' => ThemeMode.system,
        _ => ThemeMode.dark,
      };

  String _toName(ThemeMode mode) => switch (mode) {
        ThemeMode.light => 'light',
        ThemeMode.system => 'system',
        ThemeMode.dark => 'dark',
      };
}
