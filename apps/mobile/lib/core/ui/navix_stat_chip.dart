import 'package:flutter/material.dart';

import '../../app/theme/navix_tokens.dart';

/// Chip de variação (▲/▼) usado nos KPIs. `positive` define a cor.
class NavixStatChip extends StatelessWidget {
  const NavixStatChip({super.key, required this.label, this.positive = true});

  final String label;
  final bool positive;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final color = positive ? t.accent : t.danger;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(positive ? Icons.arrow_upward : Icons.arrow_downward, size: 11, color: color),
          const SizedBox(width: 3),
          Text(
            label,
            style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}
