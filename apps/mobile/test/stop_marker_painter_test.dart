import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:navix_mobile/core/maps/route_stop_marker.dart';
import 'package:navix_mobile/core/maps/stop_marker_painter.dart';

const palette = StopMarkerPalette(
  pending: Color(0xFF6D4AFF),
  next: Color(0xFF22D3AA),
  completed: Color(0xFF16A34A),
  failed: Color(0xFFEF4444),
  driver: Color(0xFF6D4AFF),
  outline: Color(0xFFFFFFFF),
);

Future<ui.Image> decode(Uint8List bytes) async {
  final codec = await ui.instantiateImageCodec(bytes);
  final frame = await codec.getNextFrame();
  return frame.image;
}

/// Cor de um pixel, em `0xAARRGGBB`.
int pixelAt(ByteData rgba, ui.Image image, int x, int y) {
  final offset = (y * image.width + x) * 4;
  return rgba.getUint32(offset);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('tamanho e Dynamic Type', () {
    test('o pino cresce com a escala de tipo', () {
      final normal = stopMarkerDiameter(
        status: RouteStopStatus.pending,
        textScale: 1.0,
      );
      final grande = stopMarkerDiameter(
        status: RouteStopStatus.pending,
        textScale: 1.4,
      );

      expect(grande, greaterThan(normal));
    });

    test('e para de crescer a 1.6, senão os pinos tapam-se', () {
      final limite = stopMarkerDiameter(
        status: RouteStopStatus.pending,
        textScale: 1.6,
      );
      final absurdo = stopMarkerDiameter(
        status: RouteStopStatus.pending,
        textScale: 4.0,
      );

      expect(absurdo, limite);
    });

    test('nunca encolhe abaixo do tamanho base', () {
      // Há sistemas que devolvem escala < 1. Um pino mais pequeno do que o
      // desenhado seria ilegível para toda a gente, não só para quem escolheu
      // texto pequeno.
      expect(
        stopMarkerDiameter(status: RouteStopStatus.pending, textScale: 0.6),
        stopMarkerDiameter(status: RouteStopStatus.pending, textScale: 1.0),
      );
    });

    test('escala inválida cai no tamanho base em vez de estourar', () {
      expect(
        stopMarkerDiameter(
          status: RouteStopStatus.pending,
          textScale: double.nan,
        ),
        stopMarkerDiameter(status: RouteStopStatus.pending, textScale: 1.0),
      );
    });

    test('a próxima parada é maior do que as outras', () {
      expect(
        stopMarkerDiameter(status: RouteStopStatus.next, textScale: 1.0),
        greaterThan(
          stopMarkerDiameter(
            status: RouteStopStatus.pending,
            textScale: 1.0,
          ),
        ),
      );
    });
  });

  group('contraste do número', () {
    test('o verde-água da próxima parada leva número escuro', () {
      // Este caso apanhou um defeito real: com um limiar de luminância, este
      // preenchimento recebia número branco a 1.9:1 — ilegível, e logo no pino
      // que existe para ser lido de relance.
      expect(labelColorOn(const Color(0xFF22D3AA)), const Color(0xFF10101A));
    });

    test('o roxo do tema leva número branco', () {
      expect(labelColorOn(const Color(0xFF6D4AFF)), Colors.white);
    });

    test('todos os estados atingem 4.5:1, o mínimo do WCAG', () {
      // A regra vale para cores que ainda não existem: mede os dois candidatos
      // e fica com o melhor, em vez de acertar um limiar.
      for (final status in RouteStopStatus.values) {
        final fill = palette.forStatus(status);
        expect(
          contrastRatio(fill, labelColorOn(fill)),
          greaterThanOrEqualTo(4.5),
          reason: 'contraste insuficiente em $status',
        );
      }
    });
  });

  group('bitmap', () {
    test('sai um PNG do tamanho do ecrã', () async {
      final bytes = await paintStopMarker(
        sequence: 3,
        status: RouteStopStatus.pending,
        palette: palette,
        textScale: 1.0,
        devicePixelRatio: 3,
      );

      expect(bytes.sublist(0, 4), [0x89, 0x50, 0x4E, 0x47]);

      final image = await decode(bytes);
      final esperado = (stopMarkerDiameter(
                status: RouteStopStatus.pending,
                textScale: 1.0,
              ) *
              3)
          .ceil();
      expect(image.width, esperado);
      image.dispose();
    });

    test('o marcador do motorista é diferente do de uma parada', () async {
      final parada = await paintStopMarker(
        sequence: 1,
        status: RouteStopStatus.pending,
        palette: palette,
        textScale: 1.0,
        devicePixelRatio: 1,
      );
      final motorista = await paintDriverMarker(
        palette: palette,
        textScale: 1.0,
        devicePixelRatio: 1,
      );

      expect(motorista, isNot(equals(parada)));
    });

    test('estados diferentes desenham pinos diferentes', () async {
      final pendente = await paintStopMarker(
        sequence: 1,
        status: RouteStopStatus.pending,
        palette: palette,
        textScale: 1.0,
        devicePixelRatio: 1,
      );
      final concluida = await paintStopMarker(
        sequence: 1,
        status: RouteStopStatus.completed,
        palette: palette,
        textScale: 1.0,
        devicePixelRatio: 1,
      );

      expect(pendente, isNot(equals(concluida)));
    });

    test('um número de três dígitos encolhe para caber no pino', () async {
      // Rotas com mais de 99 paradas existem, e o "100" não cabe no corpo do
      // "7". Encolher é a saída certa: cortar deixaria "10" onde está "100",
      // que é um número errado e não um número feio.
      //
      // Mede-se a extensão real dos pixels do número, e não a borda do pino: a
      // primeira versão deste teste amostrava o anel exterior, que o número
      // nunca alcança nem quando transborda do seu orçamento. Passava sempre.
      Future<double> larguraDoNumero(int sequence) async {
        final image = await decode(
          await paintStopMarker(
            sequence: sequence,
            // Verde com número escuro: o anel é branco, e assim o número é o
            // único conteúdo escuro da imagem.
            status: RouteStopStatus.completed,
            palette: palette,
            textScale: 1.0,
            devicePixelRatio: 2,
          ),
        );
        final rgba = (await image.toByteData())!;
        var min = image.width, max = -1;
        for (var y = 0; y < image.height; y++) {
          for (var x = 0; x < image.width; x++) {
            final pixel = pixelAt(rgba, image, x, y);
            final alpha = pixel & 0xFF;
            final r = (pixel >> 24) & 0xFF;
            final g = (pixel >> 16) & 0xFF;
            final b = (pixel >> 8) & 0xFF;
            if (alpha > 200 && r < 80 && g < 80 && b < 90) {
              if (x < min) min = x;
              if (x > max) max = x;
            }
          }
        }
        image.dispose();
        return max < 0 ? 0 : (max - min).toDouble();
      }

      // O orçamento é 78% do diâmetro interior — ver `paintStopMarker`.
      const orcamento = (68 - 6 * 2) * 0.78;

      expect(await larguraDoNumero(7), lessThanOrEqualTo(orcamento));
      expect(await larguraDoNumero(100), lessThanOrEqualTo(orcamento));
      expect(await larguraDoNumero(999), lessThanOrEqualTo(orcamento));

      // E ainda desenha alguma coisa: um número que encolheu até desaparecer
      // passaria em qualquer limite superior.
      expect(await larguraDoNumero(100), greaterThan(10));
    });
  });
}
