import { logger } from '../logger';

interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

type Res<T, E> = Ok<T> | Err<E>;

export class Result<T, E = Error> {
  static ok<T>(value: T): Result<T, never> {
    return new Result({ ok: true, value });
  }

  static err<E>(error: E): Result<never, E> {
    return new Result({ ok: false, error });
  }

  static wrap<T>(callback: () => T): Result<T>;
  static wrap<T>(promise: Promise<T>): AsyncResult<T, unknown>;
  static wrap<T>(
    input: (() => T) | Promise<T>
  ): Result<T> | AsyncResult<T, unknown> {
    if (input instanceof Promise) {
      return AsyncResult.wrap(input);
    }

    try {
      const result = input();
      return Result.ok(result);
    } catch (error) {
      return Result.err(error);
    }
  }

  private constructor(public readonly res: Res<T, E>) {}

  unwrap(): Res<T, E>;
  unwrap<U>(fallback: U): T | U;
  unwrap<U>(fallback?: U): Res<T, E> | T | U {
    if (arguments.length === 0) {
      return this.res;
    }
    return this.res.ok ? this.res.value : (fallback as U);
  }

  transform<U, EE>(fn: (value: T) => Result<U, EE>): Result<U, E | EE>;
  transform<U, EE>(
    fn: (value: T) => Promise<Result<U, EE>>
  ): AsyncResult<U, E | EE>;
  transform<U, EE>(
    fn: (value: T) => Result<U, EE> | Promise<Result<U, EE>>
  ): Result<U, E | EE> | AsyncResult<U, E | EE> {
    if (!this.res.ok) {
      return Result.err(this.res.error);
    }

    try {
      const res = fn(this.res.value);

      if (res instanceof Promise) {
        return new AsyncResult((resolve) => {
          res.then(resolve).catch((error) => {
            logger.warn(
              { err: error },
              'Result: unhandled async transform error'
            );
            resolve(Result.err(error) as never);
          });
        });
      }

      return res;
    } catch (error) {
      logger.warn({ err: error }, 'Result: unhandled transform error');
      return Result.err(error);
    }
  }
}

export class AsyncResult<T, E> extends Promise<Result<T, E>> {
  constructor(
    executor: (
      resolve: (value: Result<T, E> | PromiseLike<Result<T, E>>) => void,
      reject: (reason?: unknown) => void
    ) => void
  ) {
    super(executor);
  }

  static wrap<T>(promise: Promise<T>): AsyncResult<T, unknown> {
    return new AsyncResult((resolve) => {
      promise
        .then((value) => resolve(Result.ok(value)))
        .catch((error) => resolve(Result.err(error)));
    });
  }

  unwrap(): Promise<Res<T, E>>;
  unwrap<U>(fallback: U): Promise<T | U>;
  unwrap<U>(fallback?: U): Promise<Res<T, E> | (T | U)> {
    return arguments.length === 0
      ? this.then((res) => res.unwrap())
      : this.then((res) => res.unwrap(fallback as U));
  }

  transform<U, EE>(fn: (value: T) => Result<U, EE>): AsyncResult<U, E | EE>;
  transform<U, EE>(
    fn: (value: T) => Promise<Result<U, EE>>
  ): AsyncResult<U, E | EE>;
  transform<U, EE>(
    fn: (value: T) => Result<U, EE> | Promise<Result<U, EE>>
  ): AsyncResult<U, E | EE> {
    return new AsyncResult((resolve) => {
      this.then((oldResult) => {
        if (!oldResult.res.ok) {
          return resolve(Result.err(oldResult.res.error));
        }

        try {
          const newResult = fn(oldResult.res.value);

          if (newResult instanceof Promise) {
            return newResult.then(resolve).catch((error) => {
              logger.warn(
                { err: error },
                'AsyncResult: unhandled async transform error'
              );
              return resolve(Result.err(error));
            });
          }

          return resolve(newResult);
        } catch (error) {
          logger.warn({ err: error }, 'AsyncResult: unhandled transform error');
          return resolve(Result.err(error));
        }
      }).catch((error) => {
        resolve(Result.err(error));
      });
    });
  }
}
