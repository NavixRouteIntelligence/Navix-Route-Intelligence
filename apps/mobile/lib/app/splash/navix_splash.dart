import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/app_colors.dart';
import '../theme/navix_tokens.dart';
import 'navix_splash_painter.dart';

/// Slogan da marca. Fica **fora do ARB de propósito**: taglines de marca não se
/// traduzem (como "Just Do It"), e traduzi-la enfraqueceria o reconhecimento.
const String kNavixTagline = 'Intelligence in Motion';

/// Duração total da encenação. Dentro da faixa pedida (1,5–2,5 s).
const Duration kSplashDuration = Duration(milliseconds: 2200);

/// Abertura da Navix: o gradiente surge, um ponto de luz percorre uma rota que
/// desenha a marca, a seta de navegação é revelada com brilho, partículas
/// orbitam e o slogan aparece.
///
/// **Uma única [AnimationController]** conduz todos os estágios via [Interval] —
/// um só `Ticker`, nenhum widget por partícula, tudo desenhado num
/// [CustomPainter] (GPU). Com *Reduce Motion* ligado, cai para uma revelação
/// estática e curta, sem movimento.
///
/// Não decide *quando* sair: apenas avisa por [onStorytellingDone]. Quem
/// coordena com o carregamento de dados é o `SplashGate`.
class NavixSplash extends StatefulWidget {
  const NavixSplash({super.key, this.onStorytellingDone, this.duration = kSplashDuration});

  /// Chamado quando a encenação termina (o mínimo de tempo em tela cumprido).
  final VoidCallback? onStorytellingDone;
  final Duration duration;

  @override
  State<NavixSplash> createState() => _NavixSplashState();
}

class _NavixSplashState extends State<NavixSplash> with TickerProviderStateMixin {
  /// Conduz a encenação (0→1, uma vez).
  late final AnimationController _story;

  /// Movimento ambiente contínuo: respiração, órbita e parallax. Separado da
  /// encenação para poder continuar em loop quando os dados demoram — sem
  /// transmitir sensação de espera.
  late final AnimationController _ambient;

  bool _done = false;

  // Criados no initState — nunca num inicializador `late final` preguiçoso.
  // Ver NavixPulseDot: inicialização preguiçosa + dispose derruba a árvore.
  @override
  void initState() {
    super.initState();
    _story = AnimationController(vsync: this, duration: widget.duration)..addStatusListener(_onStoryStatus);
    _ambient = AnimationController(vsync: this, duration: const Duration(seconds: 6));
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Reduce Motion (iOS/Android/Web): entrega a marca sem encenação.
    if (MediaQuery.maybeDisableAnimationsOf(context) ?? false) {
      if (!_done) {
        _story.value = 1;
        _finish(haptics: false);
      }
      return;
    }
    if (!_story.isAnimating && _story.value == 0) {
      _story.forward();
      _ambient.repeat();
    }
  }

  void _onStoryStatus(AnimationStatus status) {
    if (status == AnimationStatus.completed) _finish(haptics: true);
  }

  void _finish({required bool haptics}) {
    if (_done) return;
    _done = true;
    // Háptico discreto de conclusão. É no-op na web e em aparelhos sem motor.
    if (haptics) HapticFeedback.lightImpact();
    widget.onStorytellingDone?.call();
  }

  @override
  void dispose() {
    _story.removeStatusListener(_onStoryStatus);
    _story.dispose();
    _ambient.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tokens = Theme.of(context).extension<NavixTokens>() ?? NavixTokens.dark;
    final palette = SplashPalette(
      background: AppColors.darkBg,
      primary: AppColors.primary,
      accent: tokens.accent,
    );
    final reduced = MediaQuery.maybeDisableAnimationsOf(context) ?? false;

    // Material é necessário porque a splash vive ACIMA do Navigator (via
    // `MaterialApp.builder`): sem ele, todo Text ganha o sublinhado amarelo de
    // depuração do Flutter. Transparente para não interferir no gradiente.
    return Material(
      type: MaterialType.transparency,
      child: ColoredBox(
        color: palette.background,
        child: AnimatedBuilder(
          animation: Listenable.merge([_story, _ambient]),
          builder: (context, _) {
            final t = _story.value;
            final ambient = _ambient.value;

            // Linha do tempo (fatias do mesmo progresso).
            final backdrop = _slice(t, 0.00, 0.20, Curves.easeOut);
            final trace = _slice(t, 0.12, 0.66, Curves.easeInOutCubic);
            final reveal = _slice(t, 0.58, 0.82, Curves.easeOutBack);
            final tagline = _slice(t, 0.74, 1.00, Curves.easeOut);

            // Respiração e parallax: contínuos, seguem depois da encenação.
            final breath = reduced ? 1.0 : 1 + math.sin(ambient * math.pi * 2) * 0.012;
            final parallax = reduced
                ? Offset.zero
                : Offset(
                    math.cos(ambient * math.pi * 2) * 3.0,
                    math.sin(ambient * math.pi * 2 * 0.7) * 2.0,
                  );

            return Opacity(
              opacity: backdrop,
              child: DecoratedBox(
                decoration: BoxDecoration(gradient: palette.backgroundGradient),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    RepaintBoundary(
                      child: Transform.scale(
                        scale: breath * (0.96 + 0.04 * _slice(t, 0.0, 0.6, Curves.easeOut)),
                        child: CustomPaint(
                          painter: NavixSplashPainter(
                            palette: palette,
                            trace: trace,
                            reveal: reveal,
                            orbit: reduced ? 0 : ambient * math.pi * 2,
                            parallax: parallax,
                            particleCount: 14,
                          ),
                        ),
                      ),
                    ),
                    _Tagline(opacity: tagline, lift: (1 - tagline) * 10),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  /// Mapeia [t] global para 0→1 dentro da janela [start, end], com [curve].
  static double _slice(double t, double start, double end, Curve curve) {
    if (t <= start) return 0;
    if (t >= end) return 1;
    return curve.transform((t - start) / (end - start));
  }
}

class _Tagline extends StatelessWidget {
  const _Tagline({required this.opacity, required this.lift});

  final double opacity;
  final double lift;

  @override
  Widget build(BuildContext context) {
    if (opacity <= 0) return const SizedBox.shrink();
    return Align(
      alignment: const Alignment(0, 0.42),
      child: Opacity(
        opacity: opacity,
        child: Transform.translate(
          offset: Offset(0, lift),
          child: Text(
            kNavixTagline,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.86),
              fontSize: 14,
              fontWeight: FontWeight.w500,
              letterSpacing: 2.6,
            ),
          ),
        ),
      ),
    );
  }
}
