import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';
import 'package:image_picker/image_picker.dart';
import 'package:signature/signature.dart';

import '../../../core/error/failure_l10n.dart';
import '../../../app/theme/navix_tokens.dart';
import 'pod_capture_cubit.dart';
import 'pod_sync_cubit.dart';

/// Abre a captura de comprovante de entrega. Retorna `true` se registrado.
Future<bool?> showPodCaptureSheet(BuildContext context, {required String deliveryId, String? deliveryLabel}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Theme.of(context).colorScheme.surface,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
    builder: (_) => MultiBlocProvider(
      providers: [
        BlocProvider(create: (_) => GetIt.instance<PodCaptureCubit>()..captureLocation()),
        BlocProvider.value(value: GetIt.instance<PodSyncCubit>()),
      ],
      child: _PodSheet(deliveryId: deliveryId, deliveryLabel: deliveryLabel),
    ),
  );
}

class _PodSheet extends StatefulWidget {
  const _PodSheet({required this.deliveryId, this.deliveryLabel});
  final String deliveryId;
  final String? deliveryLabel;

  @override
  State<_PodSheet> createState() => _PodSheetState();
}

class _PodSheetState extends State<_PodSheet> {
  String _status = 'delivered';
  String? _photoDataUrl;
  final _sig = SignatureController(penStrokeWidth: 2.2);
  final _note = TextEditingController();
  bool _preparing = false;

  @override
  void dispose() {
    _sig.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _takePhoto() async {
    final x = await ImagePicker().pickImage(source: ImageSource.camera, maxWidth: 1280, imageQuality: 70);
    if (x == null) return;
    final bytes = await x.readAsBytes();
    setState(() => _photoDataUrl = 'data:image/jpeg;base64,${base64Encode(bytes)}');
  }

  bool get _needsProof => _status == 'delivered';
  bool get _hasProof => _photoDataUrl != null || _sig.isNotEmpty;

  Future<void> _submit() async {
    setState(() => _preparing = true);
    String? sigDataUrl;
    if (_sig.isNotEmpty) {
      final png = await _sig.toPngBytes();
      if (png != null) sigDataUrl = 'data:image/png;base64,${base64Encode(png)}';
    }
    if (!mounted) return;
    setState(() => _preparing = false);
    await context.read<PodCaptureCubit>().submit(
          deliveryId: widget.deliveryId,
          status: _status,
          note: _note.text.trim().isEmpty ? null : _note.text.trim(),
          photoDataUrl: _photoDataUrl,
          signatureDataUrl: sigDataUrl,
          label: widget.deliveryLabel,
        );
  }

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return BlocListener<PodCaptureCubit, PodCaptureState>(
      listener: (context, s) {
        if (s.done) {
          ScaffoldMessenger.of(context)
            ..hideCurrentSnackBar()
            ..showSnackBar(SnackBar(content: Text(s.queued ? 'Sem conexão — comprovante salvo e será sincronizado.' : 'Comprovante registrado.')));
          Navigator.of(context).pop(true);
        } else if (s.error != null) {
          ScaffoldMessenger.of(context)
            ..hideCurrentSnackBar()
            ..showSnackBar(SnackBar(content: Text(context.failureText(s.error!))));
        }
      },
      child: Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
        child: DraggableScrollableSheet(
          initialChildSize: 0.9,
          minChildSize: 0.5,
          maxChildSize: 0.95,
          expand: false,
          builder: (context, scrollController) => ListView(
            controller: scrollController,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
            children: [
              Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: t.line, borderRadius: BorderRadius.circular(999)))),
              const SizedBox(height: 16),
              const Text('Comprovante de entrega', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              if (widget.deliveryLabel != null) ...[
                const SizedBox(height: 2),
                Text(widget.deliveryLabel!, style: TextStyle(color: t.muted, fontSize: 13)),
              ],
              const SizedBox(height: 16),

              // Banner offline
              BlocBuilder<PodSyncCubit, PodSyncState>(
                buildWhen: (p, c) => p.online != c.online,
                builder: (context, sync) {
                  if (sync.online) return const SizedBox.shrink();
                  return Container(
                    margin: const EdgeInsets.only(bottom: 16),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    decoration: BoxDecoration(color: t.warning.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12), border: Border.all(color: t.warning.withValues(alpha: 0.4))),
                    child: Row(children: [
                      Icon(Icons.cloud_off_outlined, size: 16, color: t.warning),
                      const SizedBox(width: 8),
                      Expanded(child: Text('Sem conexão — o comprovante será salvo e sincronizado depois.', style: TextStyle(fontSize: 12, color: t.warning))),
                    ]),
                  );
                },
              ),

              // Status
              Row(
                children: [
                  _StatusOption(label: 'Entregue', icon: Icons.check_circle_outline, selected: _status == 'delivered', color: t.success, onTap: () => setState(() => _status = 'delivered')),
                  const SizedBox(width: 8),
                  _StatusOption(label: 'Ausente', icon: Icons.person_off_outlined, selected: _status == 'absent', color: t.warning, onTap: () => setState(() => _status = 'absent')),
                  const SizedBox(width: 8),
                  _StatusOption(label: 'Recusado', icon: Icons.block_outlined, selected: _status == 'refused', color: t.danger, onTap: () => setState(() => _status = 'refused')),
                ],
              ),
              const SizedBox(height: 16),

              // GPS
              BlocBuilder<PodCaptureCubit, PodCaptureState>(
                builder: (context, s) {
                  final (icon, text, color) = switch (s.gps) {
                    GpsStatus.loading => (Icons.my_location, 'Capturando localização…', t.muted),
                    GpsStatus.done => (Icons.place, '${s.latitude!.toStringAsFixed(5)}, ${s.longitude!.toStringAsFixed(5)}', t.success),
                    GpsStatus.error => (Icons.location_off_outlined, 'Localização indisponível', t.warning),
                    GpsStatus.idle => (Icons.place_outlined, '—', t.muted),
                  };
                  return Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    decoration: BoxDecoration(color: t.surfaceAlt, borderRadius: BorderRadius.circular(8), border: Border.all(color: t.line)),
                    child: Row(children: [
                      Icon(icon, size: 16, color: color),
                      const SizedBox(width: 8),
                      Expanded(child: Text(text, style: TextStyle(fontSize: 12.5, color: s.gps == GpsStatus.done ? null : t.muted))),
                    ]),
                  );
                },
              ),
              const SizedBox(height: 16),

              // Foto
              Text('Foto${_needsProof ? ' (foto ou assinatura)' : ''}', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              if (_photoDataUrl != null) ...[
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Image.memory(base64Decode(_photoDataUrl!.split(',').last), height: 160, width: double.infinity, fit: BoxFit.cover),
                ),
                TextButton(onPressed: () => setState(() => _photoDataUrl = null), child: const Text('Remover foto')),
              ] else
                OutlinedButton.icon(
                  onPressed: _takePhoto,
                  icon: const Icon(Icons.photo_camera_outlined, size: 18),
                  label: const Text('Tirar foto'),
                  style: OutlinedButton.styleFrom(minimumSize: const Size(0, 48)),
                ),
              const SizedBox(height: 16),

              // Assinatura
              Row(
                children: [
                  const Expanded(child: Text('Assinatura', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600))),
                  TextButton(onPressed: () => setState(_sig.clear), child: const Text('Limpar')),
                ],
              ),
              const SizedBox(height: 4),
              Container(
                decoration: BoxDecoration(color: t.surfaceAlt, borderRadius: BorderRadius.circular(12), border: Border.all(color: t.line)),
                child: Signature(controller: _sig, height: 160, backgroundColor: Colors.transparent),
              ),
              const SizedBox(height: 16),

              // Observação
              const Text('Observação', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              TextField(
                controller: _note,
                minLines: 2,
                maxLines: 3,
                decoration: const InputDecoration(hintText: 'Ex.: entregue ao porteiro', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 20),

              BlocBuilder<PodCaptureCubit, PodCaptureState>(
                builder: (context, s) {
                  final busy = s.submitting || _preparing;
                  final canSubmit = !busy && (!_needsProof || _hasProof);
                  return FilledButton(
                    onPressed: canSubmit ? _submit : null,
                    style: FilledButton.styleFrom(minimumSize: const Size(0, 52)),
                    child: busy
                        ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Text('Confirmar', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                  );
                },
              ),
              if (_needsProof && !_hasProof) ...[
                const SizedBox(height: 8),
                Text('Adicione foto ou assinatura para confirmar a entrega.', textAlign: TextAlign.center, style: TextStyle(color: t.muted, fontSize: 12)),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _StatusOption extends StatelessWidget {
  const _StatusOption({required this.label, required this.icon, required this.selected, required this.color, required this.onTap});
  final String label;
  final IconData icon;
  final bool selected;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: selected ? color.withValues(alpha: 0.12) : t.surfaceAlt,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: selected ? color : t.line),
          ),
          child: Column(
            children: [
              Icon(icon, size: 20, color: selected ? color : t.muted),
              const SizedBox(height: 4),
              Text(label, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: selected ? color : t.muted)),
            ],
          ),
        ),
      ),
    );
  }
}
