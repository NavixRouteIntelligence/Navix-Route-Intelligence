import 'dart:convert';
import 'dart:io';

import 'package:path_provider/path_provider.dart';

import 'pod_repository.dart';

/// Um comprovante enfileirado para sincronização offline.
class QueuedPod {
  const QueuedPod({required this.id, required this.createdAt, required this.submission});

  final String id;
  final DateTime createdAt;
  final PodSubmission submission;

  String get label => submission.label ?? 'Comprovante';
}

/// Fila persistente de comprovantes (POD) aguardando envio. Cada item é um
/// arquivo JSON no diretório de documentos do app — sobrevive a reinícios.
class PodQueueStore {
  PodQueueStore({Directory Function()? overrideDir}) : _overrideDir = overrideDir;

  final Directory Function()? _overrideDir;

  Future<Directory> _dir() async {
    final base = _overrideDir?.call() ?? await getApplicationDocumentsDirectory();
    final dir = Directory('${base.path}/pod_queue');
    if (!await dir.exists()) await dir.create(recursive: true);
    return dir;
  }

  Future<void> enqueue(PodSubmission submission) async {
    final dir = await _dir();
    final id = '${DateTime.now().millisecondsSinceEpoch}_${submission.deliveryId}';
    final payload = {
      'id': id,
      'createdAt': DateTime.now().toIso8601String(),
      'pod': submission.toStorage(),
    };
    await File('${dir.path}/$id.json').writeAsString(jsonEncode(payload));
  }

  Future<List<QueuedPod>> all() async {
    final dir = await _dir();
    final files = (await dir.list().toList()).whereType<File>().where((f) => f.path.endsWith('.json')).toList();
    final out = <QueuedPod>[];
    for (final f in files) {
      try {
        final json = jsonDecode(await f.readAsString()) as Map<String, dynamic>;
        out.add(QueuedPod(
          id: json['id'] as String,
          createdAt: DateTime.tryParse((json['createdAt'] as String?) ?? '') ?? DateTime.now(),
          submission: PodSubmission.fromStorage(json['pod'] as Map<String, dynamic>),
        ));
      } catch (_) {/* item corrompido é ignorado */}
    }
    out.sort((a, b) => a.createdAt.compareTo(b.createdAt));
    return out;
  }

  Future<void> remove(String id) async {
    final dir = await _dir();
    final f = File('${dir.path}/$id.json');
    if (await f.exists()) await f.delete();
  }

  Future<int> count() async => (await all()).length;
}
