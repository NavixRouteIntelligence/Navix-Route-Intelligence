import 'package:flutter/material.dart';

import '../../app/theme/navix_tokens.dart';
import 'navix_button.dart';

/// Estado vazio reutilizável (ícone + título + descrição + ação opcional).
class NavixEmptyState extends StatelessWidget {
  const NavixEmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.description,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String? description;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 40, color: t.muted),
            const SizedBox(height: 12),
            Text(title, style: Theme.of(context).textTheme.titleMedium, textAlign: TextAlign.center),
            if (description != null) ...[
              const SizedBox(height: 4),
              Text(description!, style: TextStyle(color: t.muted), textAlign: TextAlign.center),
            ],
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 16),
              NavixButton(label: actionLabel!, onPressed: onAction),
            ],
          ],
        ),
      ),
    );
  }
}

/// Estado de erro reutilizável com retry.
class NavixErrorState extends StatelessWidget {
  const NavixErrorState({
    super.key,
    this.title = 'Algo deu errado',
    this.description = 'Não foi possível carregar. Tente novamente.',
    this.retryLabel = 'Tentar novamente',
    this.onRetry,
  });

  final String title;
  final String description;
  final String retryLabel;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline, size: 40, color: t.danger),
            const SizedBox(height: 12),
            Text(title, style: Theme.of(context).textTheme.titleMedium, textAlign: TextAlign.center),
            const SizedBox(height: 4),
            Text(description, style: TextStyle(color: t.muted), textAlign: TextAlign.center),
            if (onRetry != null) ...[
              const SizedBox(height: 16),
              NavixButton(
                label: retryLabel,
                variant: NavixButtonVariant.outline,
                icon: Icons.refresh,
                onPressed: onRetry,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
