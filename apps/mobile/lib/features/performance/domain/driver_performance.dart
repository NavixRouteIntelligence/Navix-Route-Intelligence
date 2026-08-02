import 'package:equatable/equatable.dart';

/// Desempenho consolidado do motorista (ADR-0097).
///
/// ## A restrição ética está no modelo, não no layout
///
/// Este objeto **não tem** posição na frota, média dos colegas, entregas por
/// hora nem velocidade — o contrato do backend também não. Quem quiser
/// adicionar um desses campos vai ter que passar pela nota em
/// `apps/api/src/modules/analytics/domain/driver-performance.ts`, onde a razão
/// de cada ausência está escrita.
class DriverPerformance extends Equatable {
  const DriverPerformance({
    required this.delivered,
    required this.workedDays,
    this.successRate,
    this.onTimeRate,
    this.streak = const HealthyStreak(days: 0, current: false),
    this.goal,
    this.restAdvice,
  });

  const DriverPerformance.empty()
      : delivered = 0,
        workedDays = 0,
        successRate = null,
        onTimeRate = null,
        streak = const HealthyStreak(days: 0, current: false),
        goal = null,
        restAdvice = null;

  final int delivered;

  /// Dias com alguma entrega. Folga não conta — e também não pune.
  final int workedDays;

  /// Entregues ÷ finalizadas. `null`, e não zero, quando não houve finalizada:
  /// "0% de sucesso" e "ainda não houve entrega" são estados diferentes.
  final double? successRate;

  /// Informativo. Nunca vira meta nem alimenta a sequência.
  final double? onTimeRate;

  final HealthyStreak streak;
  final DriverGoal? goal;
  final RestAdvice? restAdvice;

  bool get hasData => workedDays > 0;

  factory DriverPerformance.fromJson(Map<String, dynamic> json) {
    final goal = json['goal'];
    final rest = json['restAdvice'];
    final streak = json['streak'];
    return DriverPerformance(
      delivered: (json['delivered'] as num?)?.toInt() ?? 0,
      workedDays: (json['workedDays'] as num?)?.toInt() ?? 0,
      successRate: (json['successRate'] as num?)?.toDouble(),
      onTimeRate: (json['onTimeRate'] as num?)?.toDouble(),
      streak: streak is Map<String, dynamic>
          ? HealthyStreak.fromJson(streak)
          : const HealthyStreak(days: 0, current: false),
      goal: goal is Map<String, dynamic> ? DriverGoal.fromJson(goal) : null,
      restAdvice:
          rest is Map<String, dynamic> ? RestAdvice.fromJson(rest) : null,
    );
  }

  @override
  List<Object?> get props => [
        delivered,
        workedDays,
        successRate,
        onTimeRate,
        streak,
        goal,
        restAdvice
      ];
}

/// Sequência de dias trabalhados **sem entrega falhada**.
///
/// Duas propriedades que não podem se perder numa mudança futura: descansar não
/// quebra a contagem, e volume não pontua. Uma sequência que exigisse presença
/// diária seria um incentivo a trabalhar doente.
class HealthyStreak extends Equatable {
  const HealthyStreak({required this.days, required this.current});

  final int days;
  final bool current;

  factory HealthyStreak.fromJson(Map<String, dynamic> json) => HealthyStreak(
        days: (json['days'] as num?)?.toInt() ?? 0,
        current: json['current'] as bool? ?? false,
      );

  @override
  List<Object?> get props => [days, current];
}

/// Meta do motorista **contra ele mesmo**, sempre uma taxa de qualidade.
///
/// Nunca um volume: "entregue mais que semana passada" é um pedido para correr.
/// Uma taxa tem teto em 100%, o que impede a escalada infinita.
class DriverGoal extends Equatable {
  const DriverGoal({
    required this.target,
    required this.current,
    required this.met,
  });

  final double target;
  final double current;
  final bool met;

  factory DriverGoal.fromJson(Map<String, dynamic> json) => DriverGoal(
        target: (json['target'] as num?)?.toDouble() ?? 0,
        current: (json['current'] as num?)?.toDouble() ?? 0,
        met: json['met'] as bool? ?? false,
      );

  @override
  List<Object?> get props => [target, current, met];
}

/// Única leitura de jornada, e ela aponta para parar.
class RestAdvice extends Equatable {
  const RestAdvice({required this.activeMinutes, required this.longDay});

  final int activeMinutes;
  final bool longDay;

  factory RestAdvice.fromJson(Map<String, dynamic> json) => RestAdvice(
        activeMinutes: (json['activeMinutes'] as num?)?.toInt() ?? 0,
        longDay: json['longDay'] as bool? ?? false,
      );

  @override
  List<Object?> get props => [activeMinutes, longDay];
}
