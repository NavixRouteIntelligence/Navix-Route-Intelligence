import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';

import '../../core/session/session_cubit.dart';
import '../../core/session/session_state.dart';
import '../../features/driver/presentation/location_sharing_cubit.dart';
import '../../l10n/gen/app_localizations.dart';
import '../theme/navix_tokens.dart';

/// Cabeçalho do menu lateral: avatar, nome e estado (Online / Em Rota / Offline).
/// Reusa a sessão (nome/e-mail) e, para o motorista, o compartilhamento de
/// localização (Em Rota). Não introduz estado novo.
class NavHeader extends StatelessWidget {
  const NavHeader({super.key, this.showLiveStatus = false});

  /// Motorista: reflete "Em Rota" quando compartilhando localização.
  final bool showLiveStatus;

  /// Nome de exibição derivado do e-mail (parte antes do @, capitalizada).
  static String _displayName(String? email) {
    if (email == null || email.isEmpty) return '—';
    final local = email.split('@').first.replaceAll(RegExp(r'[._-]+'), ' ').trim();
    if (local.isEmpty) return email;
    return local.split(' ').map((w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}').join(' ');
  }

  static String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts.last.substring(0, 1)).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final session = GetIt.instance<SessionCubit>();
    return BlocBuilder<SessionCubit, SessionState>(
      bloc: session,
      builder: (context, s) {
        final name = _displayName(s.email);
        return Row(
          children: [
            CircleAvatar(
              radius: 26,
              backgroundColor: Theme.of(context).colorScheme.primary,
              child: Text(
                _initials(name),
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 18),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 2),
                  if (s.email != null)
                    Text(s.email!, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: context.tokens.muted)),
                  const SizedBox(height: 6),
                  _StatusPill(showLiveStatus: showLiveStatus),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}

/// Pílula de estado. Online (autenticado), Em Rota (motorista compartilhando
/// localização). Anima a troca com um pulso no ponto.
class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.showLiveStatus});
  final bool showLiveStatus;

  Widget _pill(BuildContext context, {required Color color, required String label, required bool live}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(999)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        _Dot(color: color, animate: live),
        const SizedBox(width: 6),
        Text(label, style: TextStyle(color: color, fontSize: 11.5, fontWeight: FontWeight.w600)),
      ]),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final t = context.tokens;
    if (!showLiveStatus) {
      return _pill(context, color: t.success, label: l10n.statusOnline, live: false);
    }
    return BlocBuilder<LocationSharingCubit, LocationSharingState>(
      bloc: GetIt.instance<LocationSharingCubit>(),
      builder: (context, state) => state.sharing
          ? _pill(context, color: t.accent, label: l10n.statusEnRoute, live: true)
          : _pill(context, color: t.success, label: l10n.statusOnline, live: false),
    );
  }
}

class _Dot extends StatefulWidget {
  const _Dot({required this.color, required this.animate});
  final Color color;
  final bool animate;

  @override
  State<_Dot> createState() => _DotState();
}

class _DotState extends State<_Dot> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1600))..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dot = Container(width: 8, height: 8, decoration: BoxDecoration(color: widget.color, shape: BoxShape.circle));
    if (!widget.animate) return dot;
    return AnimatedBuilder(
      animation: _c,
      builder: (context, child) => SizedBox(
        width: 8,
        height: 8,
        child: Stack(alignment: Alignment.center, clipBehavior: Clip.none, children: [
          Opacity(
            opacity: (1 - _c.value) * 0.6,
            child: Container(
              width: 8 + _c.value * 10,
              height: 8 + _c.value * 10,
              decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: widget.color)),
            ),
          ),
          child!,
        ]),
      ),
      child: dot,
    );
  }
}
