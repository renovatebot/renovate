interface Ok<T> {
  readonly success: true;
  readonly value: T;
}

interface Err<E> {
  readonly success: false;
  readonly error: E;
}

type Res<T, E> = Ok<T> | Err<E>;

export class ResultPromise<T, E> extends Promise<Result<T, E>> {
  transform<U>(fn: (value: T) => U): ResultPromise<U, E | unknown> {
    return new ResultPromise((resolve) => {
      this.then(({ res }) => {
        try {
          if (res.success) {
            const value = fn(res.value);
            return resolve(Result.ok(value));
          } else {
            return resolve(Result.err(res.error));
          }
        } catch (err) {
          return resolve(Result.err(err));
        }
      }).catch(
        // istanbul ignore next: should never happen
        (error) => {
          return resolve(Result.err(error));
        }
      );
    });
  }

  fallback<U>(value: U): ResultPromise<T | U, E | unknown> {
    return new ResultPromise((resolve) => {
      this.then(({ res }) => {
        if (res.success) {
          return resolve(Result.ok(res.value));
        } else {
          return resolve(Result.ok(value));
        }
      }).catch(
        // istanbul ignore next: should never happen
        (_error) => {
          return resolve(Result.ok(value));
        }
      );
    });
  }
}

export class Result<T, E = Error> {
  static ok<T>(value: T): Result<T, never> {
    return new Result({ success: true, value });
  }

  static err(): Result<never, true>;
  static err<E>(e: E): Result<never, E>;
  static err<E>(e?: E): Result<never, E> | Result<never, true> {
    if (typeof e === 'undefined' && arguments.length === 0) {
      return new Result({ success: false, error: true });
    }

    const error = e as E;
    return new Result({ success: false, error });
  }

  private static wrapCallback<T>(callback: () => T): Result<T> {
    try {
      return Result.ok(callback());
    } catch (error) {
      return Result.err(error);
    }
  }

  private static wrapPromise<T>(
    promise: Promise<T>
  ): ResultPromise<T, unknown> {
    return new ResultPromise((resolve) => {
      promise
        .then((value) => resolve(Result.ok(value)))
        .catch((error) => resolve(Result.err(error)));
    });
  }

  static wrap<T>(callback: () => T): Result<T>;
  static wrap<T>(promise: Promise<T>): ResultPromise<T, unknown>;
  static wrap<T>(
    input: (() => T) | Promise<T>
  ): Result<T> | ResultPromise<T, unknown> {
    return input instanceof Promise
      ? Result.wrapPromise(input)
      : Result.wrapCallback(input);
  }

  private constructor(public readonly res: Res<T, E>) {}

  transform<U>(fn: (value: T) => U): Result<U, E> {
    return this.res.success
      ? Result.ok(fn(this.res.value))
      : Result.err(this.res.error);
  }

  fallback<U>(value: U): T | U {
    return this.res.success ? this.res.value : value;
  }

  get value(): T | undefined {
    return this.res.success ? this.res.value : undefined;
  }

  get error(): E | undefined {
    return this.res.success ? undefined : this.res.error;
  }
}
