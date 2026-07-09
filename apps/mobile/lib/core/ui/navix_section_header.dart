import 'package:flutter/material.dart';

import '../../app/theme/navix_tokens.dart';

/// Cabeçalho de seção (título + trailing opcional).
class NavixSectionHeader extends StatelessWidget {
  const NavixSectionHeader({super.key, required this.title, this.trailing, this.icon});

  final String title;
  final Widget? trailing;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          if (icon != null) ...[
            Icon(icon, size: 18, color: context.tokens.accent),
            const SizedBox(width: 8),
          ],
          Expanded(
            child: Text(
              title,
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
            ),
          ),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}
