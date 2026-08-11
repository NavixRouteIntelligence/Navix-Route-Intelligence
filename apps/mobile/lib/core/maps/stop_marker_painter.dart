import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../../app/theme/navix_tokens.dart';
import 'route_stop_marker.dart';

/// As cores do mapa, já resolvidas a partir do tema.
///
/// O pintor recebe cores e não um [BuildContext] de propósito: assim é uma
/// função pura de pixels, que se testa sem árvore de widgets e não muda de
/// resultado por causa de quem o chamou.
@immutable
class StopMarkerPalette {
  const StopMarkerPalette({
    required this.pending,
    required this.next,
    required this.completed,
    required this.failed,
    required this.driver,
    required this.outline,
  });

  /// Deriva a paleta do tema em vigor, claro ou escuro.
  factory StopMarkerPalette.of(BuildContext context) {
    final tokens = context.tokens;
    final scheme = Theme.of(context).colorScheme;
    return StopMarkerPalette(
      pending: scheme.primary,
      next: tokens.accent,
      completed: tokens.success,
      failed: tokens.danger,
      driver: scheme.primary,
      // O anel é a superfície do tema: branco no claro, quase-preto no escuro.
      // É ele que separa o pino do tile por baixo — sem ele, o verde de uma
      // parada concluída desaparece sobre um parque e o vermelho sobre um
      // telhado. O contraste que interessa aqui é contra o **mapa**, que não
      // controlamos, e não contra o fundo da app.
      outline: scheme.surface,
    );
  }

  final Color pending;
  final Color next;
  final Color completed;
  final Color failed;
  final Color driver;
  final Color outline;

  Color forStatus(RouteStopStatus status) => switch (status) {
        RouteStopStatus.pending => pending,
        RouteStopStatus.next => next,
        RouteStopStatus.completed => completed,
        RouteStopStatus.failed => failed,
      };
}

/// Diâmetro do pino em pontos lógicos, antes da escala de tipo.
const double _baseDiameter = 34;

/// A próxima parada é desenhada maior. Não é ênfase decorativa: é a única
/// pergunta que o motorista tem enquanto conduz, e tem de ganhar a um ecrã com
/// vinte pinos.
const double _nextDiameter = 46;

/// Limite da escala de tipo aplicada ao pino.
///
/// O pino **cresce** com o Dynamic Type — se o número não acompanhasse o resto
/// do sistema, quem aumenta o texto por precisar dele ficaria com o mapa como a
/// única superfície ilegível da app. Mas cresce até 1.6 e não mais: a partir daí
/// os pinos começam a tapar-se uns aos outros e o mapa deixa de mostrar onde as
/// paradas estão, que é o seu único trabalho.
const double _maxTextScale = 1.6;

double _clampScale(double scale) =>
    scale.isFinite ? scale.clamp(1.0, _maxTextScale).toDouble() : 1.0;

/// Diâmetro final de um pino, em pontos lógicos.
@visibleForTesting
double stopMarkerDiameter({
  required RouteStopStatus status,
  required double textScale,
}) {
  final base = status == RouteStopStatus.next ? _nextDiameter : _baseDiameter;
  return base * _clampScale(textScale);
}

/// Razão de contraste entre duas cores, na definição do WCAG.
@visibleForTesting
double contrastRatio(Color a, Color b) {
  final la = a.computeLuminance();
  final lb = b.computeLuminance();
  final claro = la > lb ? la : lb;
  final escuro = la > lb ? lb : la;
  return (claro + 0.05) / (escuro + 0.05);
}

/// Cor do número: a que **ganha em contraste** contra o preenchimento.
///
/// A primeira versão disto era um limiar de luminância, e estava errada. O
/// verde-água da próxima parada tem luminância 0.50 — logo abaixo do limiar —,
/// e por isso recebia número branco: 1.9:1, ilegível, precisamente no pino que
/// existe para ser lido de relance a conduzir. Medir os dois candidatos e ficar
/// com o melhor não tem limiar para acertar, e continua certo numa paleta que
/// ainda não existe.
@visibleForTesting
Color labelColorOn(Color fill) {
  const escuro = Color(0xFF10101A);
  return contrastRatio(fill, Colors.white) >= contrastRatio(fill, escuro)
      ? Colors.white
      : escuro;
}

/// Desenha o pino numerado de uma parada e devolve o PNG.
///
/// [devicePixelRatio] entra no tamanho do bitmap, não no do pino: o desenho sai
/// à resolução do ecrã e é reduzido na apresentação, senão fica desfocado nos
/// ecrãs densos, que são todos.
Future<Uint8List> paintStopMarker({
  required int sequence,
  required RouteStopStatus status,
  required StopMarkerPalette palette,
  required double textScale,
  required double devicePixelRatio,
}) async {
  final diameter = stopMarkerDiameter(status: status, textScale: textScale);
  final fill = palette.forStatus(status);
  final ratio = devicePixelRatio.isFinite && devicePixelRatio > 0
      ? devicePixelRatio
      : 1.0;
  final size = diameter * ratio;
  final radius = size / 2;
  final center = Offset(radius, radius);

  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder);

  final outlineWidth = 3.0 * ratio;

  // Sombra curta: separa o pino do mapa sem o transformar num botão.
  canvas.drawCircle(
    center.translate(0, ratio),
    radius - outlineWidth / 2,
    Paint()
      ..color = const Color(0x33000000)
      ..maskFilter = MaskFilter.blur(BlurStyle.normal, 2 * ratio),
  );

  canvas.drawCircle(center, radius - outlineWidth / 2, Paint()..color = fill);
  canvas.drawCircle(
    center,
    radius - outlineWidth / 2,
    Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = outlineWidth
      ..color = palette.outline,
  );

  _paintNumber(
    canvas: canvas,
    center: center,
    sequence: sequence,
    color: labelColorOn(fill),
    // O número ocupa uma fração fixa do pino, e o pino já cresceu com a escala
    // de tipo — a legibilidade vem daí, não de aumentar a fonte por dentro de
    // um círculo do mesmo tamanho.
    maxWidth: (size - outlineWidth * 2) * 0.78,
    fontSize: size * 0.46,
  );

  final image = await recorder.endRecording().toImage(size.ceil(), size.ceil());
  final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
  image.dispose();
  return bytes!.buffer.asUint8List();
}

/// Desenha a posição do motorista.
///
/// Forma diferente de propósito — anel com ponto, sem número. Distinguir a
/// posição das paradas só pela cor falharia para quem não distingue as cores, e
/// «onde estou eu» é a informação que se lê primeiro.
Future<Uint8List> paintDriverMarker({
  required StopMarkerPalette palette,
  required double textScale,
  required double devicePixelRatio,
}) async {
  final diameter = _baseDiameter * _clampScale(textScale);
  final ratio = devicePixelRatio.isFinite && devicePixelRatio > 0
      ? devicePixelRatio
      : 1.0;
  final size = diameter * ratio;
  final radius = size / 2;
  final center = Offset(radius, radius);

  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder);

  // Halo, o mesmo vocabulário do «estou aqui» de qualquer mapa.
  canvas.drawCircle(
    center,
    radius,
    Paint()..color = palette.driver.withValues(alpha: 0.22),
  );
  canvas.drawCircle(
    center,
    radius * 0.46,
    Paint()..color = palette.outline,
  );
  canvas.drawCircle(
    center,
    radius * 0.36,
    Paint()..color = palette.driver,
  );

  final image = await recorder.endRecording().toImage(size.ceil(), size.ceil());
  final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
  image.dispose();
  return bytes!.buffer.asUint8List();
}

void _paintNumber({
  required Canvas canvas,
  required Offset center,
  required int sequence,
  required Color color,
  required double maxWidth,
  required double fontSize,
}) {
  final painter = TextPainter(
    text: TextSpan(
      text: '$sequence',
      style: TextStyle(
        color: color,
        fontSize: fontSize,
        fontWeight: FontWeight.w700,
        height: 1,
      ),
    ),
    textDirection: TextDirection.ltr,
    // O número nunca quebra linha: um "12" partido em "1" e "2" leria como
    // duas paradas.
    maxLines: 1,
  )..layout();

  // Uma rota com mais de 99 paradas existe, e o "100" não cabe no mesmo corpo
  // que o "7". Encolher é a saída certa: cortar deixaria "10" onde está "100",
  // que é um número errado e não um número feio.
  var scale = 1.0;
  if (painter.width > maxWidth && painter.width > 0) {
    scale = maxWidth / painter.width;
  }

  canvas.save();
  canvas.translate(center.dx, center.dy);
  if (scale != 1.0) canvas.scale(scale);
  painter.paint(canvas, Offset(-painter.width / 2, -painter.height / 2));
  canvas.restore();
  painter.dispose();
}
