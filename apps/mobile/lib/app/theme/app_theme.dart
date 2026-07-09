import 'package:flutter/material.dart';

import 'app_colors.dart';
import 'app_spacing.dart';
import 'navix_tokens.dart';

/// ThemeData da Navix (Material 3). **Escuro é o padrão**; o claro é completo.
/// Cores de estado e superfícies extra vêm de [NavixTokens] (ver design-tokens).
abstract final class AppTheme {
  static ThemeData dark() => _base(Brightness.dark);
  static ThemeData light() => _base(Brightness.light);

  static ThemeData _base(Brightness brightness) {
    final isDark = brightness == Brightness.dark;
    final tokens = isDark ? NavixTokens.dark : NavixTokens.light;

    final scheme = ColorScheme.fromSeed(
      seedColor: AppColors.primary,
      brightness: brightness,
    ).copyWith(
      primary: AppColors.primary,
      onPrimary: Colors.white,
      secondary: tokens.accent,
      error: tokens.danger,
      surface: isDark ? AppColors.darkSurface : AppColors.lightSurface,
      onSurface: isDark ? AppColors.darkText : AppColors.lightText,
      onSurfaceVariant: tokens.muted,
      outlineVariant: tokens.line,
    );

    final radius = BorderRadius.circular(AppSpacing.radiusMd);

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: scheme,
      scaffoldBackgroundColor: isDark ? AppColors.darkBg : AppColors.lightBg,
      extensions: [tokens],
      appBarTheme: AppBarTheme(
        backgroundColor: isDark ? AppColors.darkBg : AppColors.lightBg,
        foregroundColor: scheme.onSurface,
        elevation: 0,
        centerTitle: false,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: scheme.surface,
        elevation: 0,
        labelTextStyle: WidgetStateProperty.all(
          const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w500),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(48),
          shape: RoundedRectangleBorder(borderRadius: radius),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(48),
          side: BorderSide(color: tokens.line),
          shape: RoundedRectangleBorder(borderRadius: radius),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: tokens.surfaceAlt,
        border: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: tokens.line)),
        enabledBorder: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: tokens.line)),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppSpacing.radiusSm)),
      ),
    );
  }
}
