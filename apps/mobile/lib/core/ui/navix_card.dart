import 'package:flutter/material.dart';

import '../../app/theme/app_spacing.dart';

/// Cartão padrão do Design System (borda sutil + raio consistente).
class NavixCard extends StatelessWidget {
  const NavixCard({super.key, required this.child, this.padding});

  final Widget child;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: padding ?? const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: scheme.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        border: Border.all(color: scheme.outlineVariant),
      ),
      child: child,
    );
  }
}
