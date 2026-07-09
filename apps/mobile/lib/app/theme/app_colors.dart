import 'package:flutter/material.dart';

/// Tokens de cor da marca Navix (espelham o Design System do Web).
abstract final class AppColors {
  static const Color primary = Color(0xFF6D4AFF);
  static const Color accent = Color(0xFF22D3AA);
  static const Color success = Color(0xFF16A34A);
  static const Color warning = Color(0xFFF59E0B);
  static const Color danger = Color(0xFFEF4444);

  // Superfícies — claro.
  static const Color lightBg = Color(0xFFF7F7FB);
  static const Color lightSurface = Color(0xFFFFFFFF);
  static const Color lightText = Color(0xFF16161D);

  // Superfícies — escuro.
  static const Color darkBg = Color(0xFF0B0B12);
  static const Color darkSurface = Color(0xFF15151F);
  static const Color darkText = Color(0xFFF3F3F7);
}
