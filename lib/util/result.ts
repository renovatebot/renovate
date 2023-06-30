interface Ok<T> {
  ok: true;
  value: T;
}

interface Err {
  ok: false;
  error: Error;
}

type Res<T> = Ok<T> | Err;

export class Result<T> {
  static ok<T>(value: T): Result<T> {
    return new Result({ ok: true, value });
  }

  static err(): Result<never>;
  static err(error: Error): Result<never>;
  static err(message: string): Result<never>;
  static err(error?: Error | string): Result<never> {
    if (typeof error === 'undefined') {
      return new Result({ ok: false, error: new Error() });
    }

    if (typeof error === 'string') {
      return new Result({ ok: false, error: new Error(error) });
    }

    return new Result({ ok: false, error });
  }

  private static wrapCallback<T>(callback: () => T): Result<T> {
    try {
      return Result.ok(callback());
    } catch (error) {
      return Result.err(error);
    }
  }

  private static wrapPromise<T>(promise: Promise<T>): Promise<Result<T>> {
    return promise.then(
      (value) => Result.ok(value),
      (error) => Result.err(error)
    );
  }

  static wrap<T>(callback: () => T): Result<T>;
  static wrap<T>(promise: Promise<T>): Promise<Result<T>>;
  static wrap<T>(
    input: (() => T) | Promise<T>
  ): Result<T> | Promise<Result<T>> {
    return input instanceof Promise
      ? Result.wrapPromise(input)
      : Result.wrapCallback(input);
  }

  private constructor(private res: Res<T>) {}

  transform<U>(fn: (value: T) => U): Result<U> {
    return this.res.ok
      ? Result.ok(fn(this.res.value))
      : Result.err(this.res.error);
  }

  unwrap(): Res<T>;
  unwrap<U>(fallback: U): Res<T | U>;
  unwrap<U>(fallback?: U): Res<T | U> {
    if (this.res.ok) {
      return this.res;
    }

    if (arguments.length) {
      return { ok: true, value: fallback as U };
    }

    return this.res;
  }

  value(): T | undefined;
  value<U>(fallback: U): T | U;
  value<U>(fallback?: U): T | U | undefined {
    const res = arguments.length ? this.unwrap(fallback as U) : this.unwrap();
    return res.ok ? res.value : undefined;
  }

  error(): Error | undefined {
    return this.res.ok ? undefined : this.res.error;
  }
}
