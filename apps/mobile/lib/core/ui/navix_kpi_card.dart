import 'package:flutter/material.dart';

import '../../app/theme/navix_tokens.dart';
import 'navix_card.dart';
import 'navix_stat_chip.dart';

/// Cartão de KPI: ícone + rótulo, valor grande e chip de variação opcional.
class NavixKpiCard extends StatelessWidget {
  const NavixKpiCard({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    this.iconColor,
    this.deltaLabel,
    this.deltaPositive = true,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color? iconColor;
  final String? deltaLabel;
  final bool deltaPositive;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final color = iconColor ?? Theme.of(context).colorScheme.primary;
    return NavixCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, size: 16, color: color),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 12, color: t.muted),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            value,
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700, height: 1.1),
          ),
          if (deltaLabel != null) ...[
            const SizedBox(height: 8),
            NavixStatChip(label: deltaLabel!, positive: deltaPositive),
          ],
        ],
      ),
    );
  }
}
