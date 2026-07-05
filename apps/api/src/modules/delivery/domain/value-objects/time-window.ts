import type { TimeWindowInput } from '@navix/contracts';

import { ValidationError } from '../../../../shared/kernel/domain-error';

/** Value Object de janela de entrega. Invariante: start < end. Imutável. */
export class TimeWindow {
  private constructor(
    private readonly _start: Date,
    private readonly _end: Date,
  ) {}

  static create(input: TimeWindowInput): TimeWindow {
    const start = new Date(input.start);
    const end = new Date(input.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new ValidationError('Janela de entrega com datas inválidas.');
    }
    if (start.getTime() >= end.getTime()) {
      throw new ValidationError('Início da janela deve ser anterior ao fim.');
    }
    return new TimeWindow(start, end);
  }

  static restore(start: Date, end: Date): TimeWindow {
    return new TimeWindow(start, end);
  }

  get start(): Date {
    return this._start;
  }

  get end(): Date {
    return this._end;
  }
}
