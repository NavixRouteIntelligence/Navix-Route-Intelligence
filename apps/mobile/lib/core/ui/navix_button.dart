import 'package:flutter/material.dart';

enum NavixButtonVariant { primary, outline }

/// Botão do Design System com variantes e estado de carregamento.
class NavixButton extends StatelessWidget {
  const NavixButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.variant = NavixButtonVariant.primary,
    this.icon,
    this.loading = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final NavixButtonVariant variant;
  final IconData? icon;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final child = loading
        ? const SizedBox(
            height: 20,
            width: 20,
            child: CircularProgressIndicator(strokeWidth: 2),
          )
        : Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[Icon(icon, size: 18), const SizedBox(width: 8)],
              Text(label),
            ],
          );

    final effectiveOnPressed = loading ? null : onPressed;

    return switch (variant) {
      NavixButtonVariant.primary => FilledButton(onPressed: effectiveOnPressed, child: child),
      NavixButtonVariant.outline => OutlinedButton(onPressed: effectiveOnPressed, child: child),
    };
  }
}
