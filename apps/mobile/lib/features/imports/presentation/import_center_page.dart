import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';

import '../../../app/theme/navix_tokens.dart';
import '../../../core/theme/theme_cubit.dart';
import '../../../core/ui/navix_card.dart';
import '../../../core/ui/navix_kpi_card.dart';
import '../../../core/ui/navix_section_header.dart';
import '../../../core/ui/navix_skeleton.dart';
import '../../../core/ui/navix_status_pill.dart';
import '../domain/import_models.dart';
import 'import_cubit.dart';

/// Import Center (Empresa) — fluxo Upload → Preview → Confirmar → Sucesso, com
/// histórico. Segue o protótipo aprovado e reutiliza o Design System.
class ImportCenterPage extends StatelessWidget {
  const ImportCenterPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => GetIt.instance<ImportCubit>()..loadHistory(),
      child: const _ImportView(),
    );
  }
}

class _ImportView extends StatelessWidget {
  const _ImportView();

  @override
  Widget build(BuildContext context) {
    final theme = GetIt.instance<ThemeCubit>();
    return Scaffold(
      appBar: AppBar(
        title: const Text('Import Center'),
        actions: [
          IconButton(
            tooltip: 'Tema',
            onPressed: () {
              final dark = Theme.of(context).brightness == Brightness.dark;
              theme.setMode(dark ? ThemeMode.light : ThemeMode.dark);
            },
            icon: Icon(Theme.of(context).brightness == Brightness.dark ? Icons.light_mode_outlined : Icons.dark_mode_outlined),
          ),
        ],
      ),
      body: BlocConsumer<ImportCubit, ImportState>(
        listenWhen: (p, c) => p.error != c.error && c.error != null,
        listener: (context, state) {
          ScaffoldMessenger.of(context)
            ..hideCurrentSnackBar()
            ..showSnackBar(SnackBar(content: Text(state.error!)));
        },
        builder: (context, state) {
          final child = switch (state.step) {
            ImportStep.upload => _UploadStep(state: state),
            ImportStep.preview => _PreviewStep(state: state),
            ImportStep.done => _DoneStep(state: state),
          };
          return AnimatedSwitcher(
            duration: context.tokens.motionBase,
            child: KeyedSubtree(key: ValueKey(state.step), child: child),
          );
        },
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Passo 1 — Upload
// ---------------------------------------------------------------------------

class _UploadStep extends StatelessWidget {
  const _UploadStep({required this.state});
  final ImportState state;

  Future<void> _pick(BuildContext context) async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['csv', 'xlsx', 'xls', 'pdf'],
      withData: false,
    );
    final file = result?.files.single;
    final path = file?.path;
    if (path == null) return;
    if (context.mounted) {
      await context.read<ImportCubit>().pickAndPreview(path: path, filename: file!.name);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final primary = Theme.of(context).colorScheme.primary;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const _StepBar(current: ImportStep.upload),
        const SizedBox(height: 16),
        NavixCard(
          child: InkWell(
            onTap: state.busy ? null : () => _pick(context),
            borderRadius: BorderRadius.circular(12),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 16),
              decoration: BoxDecoration(
                color: t.surfaceAlt,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: primary.withValues(alpha: 0.4)),
              ),
              child: Column(
                children: [
                  if (state.busy) ...[
                    const SizedBox(height: 4),
                    const CircularProgressIndicator(strokeWidth: 2.5),
                    const SizedBox(height: 16),
                    Text('Lendo o arquivo…', style: TextStyle(color: t.muted)),
                  ] else ...[
                    Icon(Icons.cloud_upload_outlined, size: 40, color: primary),
                    const SizedBox(height: 12),
                    const Text('Toque para selecionar um arquivo', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 4),
                    Text('Importe suas entregas de uma planilha ou PDF', textAlign: TextAlign.center, style: TextStyle(color: t.muted, fontSize: 12.5)),
                  ],
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        const Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            _FormatChip(label: 'CSV', icon: Icons.description_outlined),
            _FormatChip(label: 'Excel', icon: Icons.table_chart_outlined),
            _FormatChip(label: 'PDF', icon: Icons.picture_as_pdf_outlined),
          ],
        ),
        const SizedBox(height: 8),
        Text('Até 5 MB · 1000 linhas por arquivo.', style: TextStyle(color: t.muted, fontSize: 11.5)),
        const SizedBox(height: 24),
        const _HistorySection(),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Passo 2 — Preview / Validação
// ---------------------------------------------------------------------------

class _PreviewStep extends StatelessWidget {
  const _PreviewStep({required this.state});
  final ImportState state;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final preview = state.preview!;
    final s = preview.batch.summary;
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              const _StepBar(current: ImportStep.preview),
              const SizedBox(height: 16),
              Row(
                children: [
                  Icon(Icons.insert_drive_file_outlined, size: 18, color: t.muted),
                  const SizedBox(width: 8),
                  Expanded(child: Text(preview.batch.filename, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600))),
                ],
              ),
              const SizedBox(height: 12),
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                childAspectRatio: 1.7,
                children: [
                  NavixKpiCard(icon: Icons.check_circle_outline, label: 'Válidas', value: '${s.valid}', iconColor: t.success),
                  NavixKpiCard(icon: Icons.error_outline, label: 'Inválidas', value: '${s.invalid}', iconColor: t.danger),
                  NavixKpiCard(icon: Icons.copy_all_outlined, label: 'Duplicadas', value: '${s.duplicates}', iconColor: t.warning),
                  NavixKpiCard(
                    icon: Icons.eco_outlined,
                    label: 'Economia estimada',
                    value: '${s.estimatedSavingsKm.toStringAsFixed(0)} km',
                    iconColor: t.accent,
                    deltaLabel: s.estimatedSavingsPct > 0 ? '${s.estimatedSavingsPct.toStringAsFixed(0)}%' : null,
                  ),
                ],
              ),
              const SizedBox(height: 16),
              // A otimização deixou de ser uma escolha (ADR-0074): a IA prepara a
              // rota sozinha ao confirmar. O card informa o que vai acontecer em
              // vez de pedir uma decisão que o utilizador não precisa tomar.
              NavixCard(
                child: Row(
                  children: [
                    Icon(Icons.auto_awesome, size: 20, color: t.accent),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('A rota é preparada automaticamente',
                              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                          const SizedBox(height: 2),
                          Text(
                            'Ao confirmar, a IA organiza as entregas e define a melhor sequência.',
                            style: TextStyle(color: t.muted, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              NavixSectionHeader(title: 'Linhas', icon: Icons.list_alt_outlined, trailing: Text('${preview.rows.length}', style: TextStyle(color: t.muted, fontSize: 12))),
              ...preview.rows.take(50).map((r) => _RowTile(row: r)),
              if (preview.rows.length > 50) ...[
                const SizedBox(height: 8),
                Center(child: Text('+ ${preview.rows.length - 50} linhas', style: TextStyle(color: t.muted, fontSize: 12))),
              ],
            ],
          ),
        ),
        _PreviewActions(state: state),
      ],
    );
  }
}

class _RowTile extends StatelessWidget {
  const _RowTile({required this.row});
  final ImportRow row;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final (color, label) = switch (row.status) {
      ImportRowStatus.valid => (t.success, 'Válida'),
      ImportRowStatus.invalid => (t.danger, 'Inválida'),
      ImportRowStatus.duplicate => (t.warning, 'Duplicada'),
    };
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  row.recipient?.isNotEmpty == true ? row.recipient! : 'Linha ${row.index + 1}',
                  style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 2),
                Text(row.addressText.isEmpty ? '—' : row.addressText, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(color: t.muted, fontSize: 12)),
                if (row.errors.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(row.errors.join(' · '), style: TextStyle(color: t.danger, fontSize: 11.5)),
                ] else if (row.lowConfidence) ...[
                  const SizedBox(height: 3),
                  Text('Baixa confiança (extraído de PDF)', style: TextStyle(color: t.warning, fontSize: 11.5)),
                ],
              ],
            ),
          ),
          const SizedBox(width: 10),
          NavixStatusPill(label: label, color: color),
        ],
      ),
    );
  }
}

class _PreviewActions extends StatelessWidget {
  const _PreviewActions({required this.state});
  final ImportState state;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final canConfirm = (state.preview?.batch.summary.valid ?? 0) > 0;
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
      decoration: BoxDecoration(color: Theme.of(context).colorScheme.surface, border: Border(top: BorderSide(color: t.line))),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            OutlinedButton(
              onPressed: state.busy ? null : () => context.read<ImportCubit>().reset(),
              style: OutlinedButton.styleFrom(minimumSize: const Size(0, 52), padding: const EdgeInsets.symmetric(horizontal: 20)),
              child: const Text('Voltar'),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: FilledButton(
                onPressed: (state.busy || !canConfirm) ? null : () => context.read<ImportCubit>().confirm(),
                style: FilledButton.styleFrom(minimumSize: const Size(0, 52)),
                child: state.busy
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                    : Text('Confirmar ${state.preview?.batch.summary.valid ?? 0} entregas', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Passo 3 — Sucesso
// ---------------------------------------------------------------------------

class _DoneStep extends StatelessWidget {
  const _DoneStep({required this.state});
  final ImportState state;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final c = state.confirmation;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const _StepBar(current: ImportStep.done),
        const SizedBox(height: 24),
        Center(
          child: Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(color: t.success.withValues(alpha: 0.14), shape: BoxShape.circle),
            child: Icon(Icons.check_rounded, color: t.success, size: 40),
          ),
        ),
        const SizedBox(height: 16),
        const Center(child: Text('Importação concluída', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700))),
        const SizedBox(height: 6),
        Center(child: Text('${c?.createdDeliveries ?? 0} entrega(s) criada(s).', style: TextStyle(color: t.muted))),
        if (c?.routePlanId != null) ...[
          const SizedBox(height: 4),
          Center(child: Text('Rota otimizada gerada.', style: TextStyle(color: t.accent, fontSize: 13))),
        ],
        const SizedBox(height: 24),
        FilledButton.icon(
          onPressed: () => context.read<ImportCubit>().reset(),
          icon: const Icon(Icons.add),
          label: const Text('Nova importação'),
          style: FilledButton.styleFrom(minimumSize: const Size(0, 52)),
        ),
        const SizedBox(height: 24),
        const _HistorySection(),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Histórico + comuns
// ---------------------------------------------------------------------------

class _HistorySection extends StatelessWidget {
  const _HistorySection();

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return BlocBuilder<ImportCubit, ImportState>(
      buildWhen: (p, c) => p.history != c.history || p.historyLoading != c.historyLoading,
      builder: (context, state) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const NavixSectionHeader(title: 'Histórico', icon: Icons.history_outlined),
            if (state.historyLoading)
              const NavixCard(child: NavixSkeleton(height: 48))
            else if (state.history.isEmpty)
              Text('Nenhuma importação ainda.', style: TextStyle(color: t.muted, fontSize: 13))
            else
              ...state.history.map((b) => _HistoryTile(batch: b)),
          ],
        );
      },
    );
  }
}

class _HistoryTile extends StatelessWidget {
  const _HistoryTile({required this.batch});
  final ImportBatch batch;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final (color, label) = switch (batch.status) {
      ImportBatchStatus.imported => (t.success, 'Importado'),
      ImportBatchStatus.failed => (t.danger, 'Falhou'),
      ImportBatchStatus.preview => (t.warning, 'Prévia'),
    };
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(batch.filename, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600)),
                const SizedBox(height: 2),
                Text('${batch.summary.valid}/${batch.summary.total} válidas · ${batch.fileType.toUpperCase()}', style: TextStyle(color: t.muted, fontSize: 11.5)),
              ],
            ),
          ),
          NavixStatusPill(label: label, color: color),
        ],
      ),
    );
  }
}

class _StepBar extends StatelessWidget {
  const _StepBar({required this.current});
  final ImportStep current;

  @override
  Widget build(BuildContext context) {
    final steps = [
      (ImportStep.upload, 'Upload'),
      (ImportStep.preview, 'Validar'),
      (ImportStep.done, 'Concluir'),
    ];
    final idx = steps.indexWhere((s) => s.$1 == current);
    final t = context.tokens;
    final primary = Theme.of(context).colorScheme.primary;
    return Row(
      children: [
        for (var i = 0; i < steps.length; i++) ...[
          _dot(context, active: i <= idx, primary: primary, muted: t.surfaceAlt, label: '${i + 1}'),
          const SizedBox(width: 6),
          Text(steps[i].$2, style: TextStyle(fontSize: 12, fontWeight: i == idx ? FontWeight.w700 : FontWeight.w500, color: i <= idx ? primary : t.muted)),
          if (i < steps.length - 1)
            Expanded(child: Container(height: 2, margin: const EdgeInsets.symmetric(horizontal: 8), color: i < idx ? primary : t.line)),
        ],
      ],
    );
  }

  Widget _dot(BuildContext context, {required bool active, required Color primary, required Color muted, required String label}) {
    return Container(
      width: 22,
      height: 22,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: active ? primary : muted, shape: BoxShape.circle),
      child: Text(label, style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: active ? Colors.white : context.tokens.muted)),
    );
  }
}

class _FormatChip extends StatelessWidget {
  const _FormatChip({required this.label, required this.icon});
  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(color: t.surfaceAlt, borderRadius: BorderRadius.circular(8), border: Border.all(color: t.line)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 15, color: t.muted),
        const SizedBox(width: 6),
        Text(label, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w500)),
      ]),
    );
  }
}
