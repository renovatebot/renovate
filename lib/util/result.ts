type Ok<T> = {
  ok: true;
  value: T;
};

type Err<E extends Error = Error> = {
  ok: false;
  error: E;
};

type Res<T, E extends Error = Error> = Ok<T> | Err<E>;

export class Result<T, E extends Error = Error> {
  static ok<T>(value: T): Result<T, never> {
    return new Result({ ok: true, value });
  }

  static err(): Result<never, Error>;
  static err<E extends Error = Error>(error: E): Result<never, E>;
  static err(message: string): Result<never, Error>;
  static err<E extends Error = Error>(
    error?: E | string
  ): Result<never, Error> {
    if (typeof error === 'undefined') {
      return new Result({ ok: false, error: new Error() });
    }

    if (typeof error === 'string') {
      return new Result({ ok: false, error: new Error(error) });
    }

    return new Result({ ok: false, error });
  }

  private constructor(private res: Res<T, E>) {}

  get ok(): boolean {
    return this.res.ok;
  }

  value(): T;
  value<U>(fallback: U): T | U;
  value<U>(fallback?: U): T | U {
    if (this.res.ok) {
      return this.res.value;
    }

    if (arguments.length) {
      return fallback as U;
    }

    throw this.res.error;
  }

  error(): E | null {
    if (this.res.ok) {
      return null;
    }

    return this.res.error;
  }

  transform<U>(fn: (value: T) => U): Result<U, E> {
    if (this.res.ok) {
      return Result.ok(fn(this.res.value));
    }

    return Result.err(this.res.error);
  }
}
