import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/error/failure.dart';
import '../../../core/location/location_service.dart';
import '../../driver/data/tracking_repository.dart';
import '../data/pod_queue_store.dart';
import '../data/pod_repository.dart';

enum GpsStatus { idle, loading, done, error }

class PodCaptureState extends Equatable {
  const PodCaptureState({
    this.gps = GpsStatus.idle,
    this.latitude,
    this.longitude,
    this.submitting = false,
    this.done = false,
    this.queued = false,
    this.error,
  });

  final GpsStatus gps;
  final double? latitude;
  final double? longitude;
  final bool submitting;
  final bool done;
  final bool queued; // salvo offline, aguardando sincronização
  final Failure? error;

  PodCaptureState copyWith({
    GpsStatus? gps,
    double? latitude,
    double? longitude,
    bool? submitting,
    bool? done,
    bool? queued,
    Failure? error,
    bool clearError = false,
  }) {
    return PodCaptureState(
      gps: gps ?? this.gps,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      submitting: submitting ?? this.submitting,
      done: done ?? this.done,
      queued: queued ?? this.queued,
      error: clearError ? null : (error ?? this.error),
    );
  }

  @override
  List<Object?> get props => [gps, latitude, longitude, submitting, done, queued, error];
}

/// Captura de comprovante de entrega: obtém o GPS e envia o POD (com fila offline).
class PodCaptureCubit extends Cubit<PodCaptureState> {
  PodCaptureCubit(this._pod, this._location, this._tracking, this._queue) : super(const PodCaptureState());

  final PodRepository _pod;
  final LocationService _location;
  final TrackingRepository _tracking;
  final PodQueueStore _queue;

  /// Captura a localização atual (best-effort — POD não exige GPS).
  Future<void> captureLocation() async {
    emit(state.copyWith(gps: GpsStatus.loading, clearError: true));
    try {
      final s = await _location.current();
      emit(state.copyWith(gps: GpsStatus.done, latitude: s.latitude, longitude: s.longitude));
    } catch (_) {
      emit(state.copyWith(gps: GpsStatus.error));
    }
  }

  Future<void> submit({
    required String deliveryId,
    required String status,
    String? note,
    String? photoDataUrl,
    String? signatureDataUrl,
    String? label,
  }) async {
    emit(state.copyWith(submitting: true, clearError: true));
    final submission = PodSubmission(
      deliveryId: deliveryId,
      status: status,
      note: note,
      latitude: state.latitude,
      longitude: state.longitude,
      photoDataUrl: photoDataUrl,
      signatureDataUrl: signatureDataUrl,
      label: label,
    );
    try {
      await _pod.submit(submission);
      // Integração com Tracking: registra a posição do desfecho (best-effort).
      if (state.latitude != null && state.longitude != null) {
        try {
          await _tracking.sendPosition(
            LocationSample(latitude: state.latitude!, longitude: state.longitude!),
            status: 'finished',
          );
        } catch (_) {/* não bloqueia o POD */}
      }
      emit(state.copyWith(submitting: false, done: true, queued: false));
    } on NetworkFailure {
      // Sem conexão: salva na fila e conclui como "aguardando sincronização".
      await _queue.enqueue(submission);
      emit(state.copyWith(submitting: false, done: true, queued: true));
    } on Failure catch (f) {
      emit(state.copyWith(submitting: false, error: f));
    } catch (_) {
      emit(state.copyWith(submitting: false, error: const UnknownFailure()));
    }
  }
}
