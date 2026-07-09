import 'package:flutter/material.dart';

/// Tokens da Navix que não cabem no [ColorScheme] do Material (cores de estado,
/// superfície aninhada e durações de animação). Disponível via
/// `Theme.of(context).extension<NavixTokens>()!` e compartilhado com o Web
/// (ver docs/design-tokens.md).
@immutable
class NavixTokens extends ThemeExtension<NavixTokens> {
  const NavixTokens({
    required this.accent,
    required this.success,
    required this.warning,
    required this.danger,
    required this.surfaceAlt,
    required this.line,
    required this.muted,
    required this.motionFast,
    required this.motionBase,
    required this.motionSlow,
  });

  final Color accent;
  final Color success;
  final Color warning;
  final Color danger;
  final Color surfaceAlt;
  final Color line;
  final Color muted;
  final Duration motionFast;
  final Duration motionBase;
  final Duration motionSlow;

  static const dark = NavixTokens(
    accent: Color(0xFF22D3AA),
    success: Color(0xFF22C55E),
    warning: Color(0xFFF59E0B),
    danger: Color(0xFFEF4444),
    surfaceAlt: Color(0xFF1B1B27),
    line: Color(0xFF262636),
    muted: Color(0xFF9AA0B4),
    motionFast: Duration(milliseconds: 120),
    motionBase: Duration(milliseconds: 200),
    motionSlow: Duration(milliseconds: 320),
  );

  static const light = NavixTokens(
    accent: Color(0xFF0FB894),
    success: Color(0xFF16A34A),
    warning: Color(0xFFD97706),
    danger: Color(0xFFDC2626),
    surfaceAlt: Color(0xFFF1F1F6),
    line: Color(0xFFE6E6EE),
    muted: Color(0xFF5B6072),
    motionFast: Duration(milliseconds: 120),
    motionBase: Duration(milliseconds: 200),
    motionSlow: Duration(milliseconds: 320),
  );

  @override
  NavixTokens copyWith({
    Color? accent,
    Color? success,
    Color? warning,
    Color? danger,
    Color? surfaceAlt,
    Color? line,
    Color? muted,
    Duration? motionFast,
    Duration? motionBase,
    Duration? motionSlow,
  }) {
    return NavixTokens(
      accent: accent ?? this.accent,
      success: success ?? this.success,
      warning: warning ?? this.warning,
      danger: danger ?? this.danger,
      surfaceAlt: surfaceAlt ?? this.surfaceAlt,
      line: line ?? this.line,
      muted: muted ?? this.muted,
      motionFast: motionFast ?? this.motionFast,
      motionBase: motionBase ?? this.motionBase,
      motionSlow: motionSlow ?? this.motionSlow,
    );
  }

  @override
  NavixTokens lerp(ThemeExtension<NavixTokens>? other, double t) {
    if (other is! NavixTokens) return this;
    return NavixTokens(
      accent: Color.lerp(accent, other.accent, t)!,
      success: Color.lerp(success, other.success, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      danger: Color.lerp(danger, other.danger, t)!,
      surfaceAlt: Color.lerp(surfaceAlt, other.surfaceAlt, t)!,
      line: Color.lerp(line, other.line, t)!,
      muted: Color.lerp(muted, other.muted, t)!,
      motionFast: t < 0.5 ? motionFast : other.motionFast,
      motionBase: t < 0.5 ? motionBase : other.motionBase,
      motionSlow: t < 0.5 ? motionSlow : other.motionSlow,
    );
  }
}

/// Atalho de acesso aos tokens no contexto.
extension NavixTokensX on BuildContext {
  NavixTokens get tokens => Theme.of(this).extension<NavixTokens>()!;
}
