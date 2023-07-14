/* eslint-disable promise/no-nesting */
import { logger } from '../logger';

interface Ok<T> {
  readonly ok: true;
  readonly value: NonNullable<T>;
  readonly error?: never;
}

interface Err<E> {
  readonly ok: false;
  readonly error: NonNullable<E>;
  readonly value?: never;
}

type Res<T, E> = Ok<T> | Err<E>;

export class Result<T, E = Error> {
  static ok<T>(value: NonNullable<T>): Result<T, never> {
    return new Result({ ok: true, value });
  }

  static err<E>(error: NonNullable<E>): Result<never, E> {
    return new Result({ ok: false, error });
  }

  static wrap<T, E = Error>(callback: () => NonNullable<T>): Result<T, E>;
  static wrap<T, E = Error>(promise: Promise<Result<T, E>>): AsyncResult<T, E>;
  static wrap<T, E = Error>(
    promise: Promise<NonNullable<T>>
  ): AsyncResult<T, E>;
  static wrap<T, E = Error>(
    input:
      | (() => NonNullable<T>)
      | Promise<Result<T, E>>
      | Promise<NonNullable<T>>
  ): Result<T, E> | AsyncResult<T, E> {
    if (input instanceof Promise) {
      return AsyncResult.wrap(input as never);
    }

    try {
      const result = input();
      return Result.ok(result);
    } catch (error) {
      return Result.err(error);
    }
  }

  static wrapNullable<T, E = Error, NullableError = Error>(
    callback: () => T,
    nullableError: NonNullable<NullableError>
  ): Result<T, E | NullableError>;
  static wrapNullable<T, E = Error, NullError = Error, UndefinedError = Error>(
    callback: () => T,
    nullError: NonNullable<NullError>,
    undefinedError: NonNullable<UndefinedError>
  ): Result<T, E | NullError | UndefinedError>;

  static wrapNullable<T, E = Error, NullableError = Error>(
    promise: Promise<T>,
    nullableError: NonNullable<NullableError>
  ): AsyncResult<T, E | NullableError>;
  static wrapNullable<T, E = Error, NullError = Error, UndefinedError = Error>(
    promise: Promise<T>,
    nullError: NonNullable<NullError>,
    undefinedError: NonNullable<UndefinedError>
  ): AsyncResult<T, E | NullError | UndefinedError>;

  static wrapNullable<T, E = Error, NullError = Error, UndefinedError = Error>(
    input: (() => T) | Promise<T>,
    arg2: NonNullable<NullError>,
    arg3?: NonNullable<UndefinedError>
  ):
    | Result<T, E | NullError | UndefinedError>
    | AsyncResult<T, E | NullError | UndefinedError> {
    const nullError = arg2;
    const undefinedError = arg3 ?? arg2;

    if (input instanceof Promise) {
      return AsyncResult.wrapNullable(input, nullError, undefinedError);
    }

    try {
      const result = input();

      if (result === null) {
        return Result.err(nullError);
      }

      if (result === undefined) {
        return Result.err(undefinedError);
      }

      return Result.ok(result);
    } catch (error) {
      return Result.err(error);
    }
  }

  private constructor(private readonly res: Res<T, E>) {}

  unwrap(): Res<T, E>;
  unwrap(fallback: NonNullable<T>): NonNullable<T>;
  unwrap(fallback?: NonNullable<T>): Res<T, E> | NonNullable<T> {
    if (fallback === undefined) {
      return this.res;
    }
    return this.res.ok ? this.res.value : fallback;
  }

  transform<U, EE>(
    fn: (value: NonNullable<T>) => Result<U, EE>
  ): Result<U, E | EE>;
  transform<U, EE>(
    fn: (value: NonNullable<T>) => Promise<Result<U, EE>>
  ): AsyncResult<U, E | EE>;
  transform<U>(
    fn: (value: NonNullable<T>) => Promise<NonNullable<U>>
  ): AsyncResult<U, E | Error>;
  transform<U>(
    fn: (value: NonNullable<T>) => NonNullable<U>
  ): Result<U, E | Error>;
  transform<U, EE>(
    fn: (
      value: NonNullable<T>
    ) =>
      | NonNullable<U>
      | Result<U, EE>
      | Result<U, EE>
      | Promise<NonNullable<U>>
  ): Result<U, E | EE> | AsyncResult<U, E | EE> {
    if (!this.res.ok) {
      return Result.err(this.res.error);
    }

    try {
      const res = fn(this.res.value);

      if (res instanceof Promise) {
        return new AsyncResult((resolve) => {
          res
            .then((newResult) =>
              newResult instanceof Result
                ? resolve(newResult)
                : resolve(Result.ok(newResult))
            )
            .catch((error) => {
              logger.warn(
                { err: error },
                'Result: unhandled async transform error'
              );
              resolve(Result.err(error) as never);
            });
        });
      }

      if (res instanceof Result) {
        return res;
      }

      return Result.ok(res);
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

  static wrap<T, E = Error>(promise: Promise<Result<T, E>>): AsyncResult<T, E>;
  static wrap<T, E = Error>(
    promise: Promise<NonNullable<T>>
  ): AsyncResult<T, E>;
  static wrap<T, E = Error>(
    promise: Promise<NonNullable<T> | Result<T, E>>
  ): AsyncResult<T, E> {
    return new AsyncResult((resolve) => {
      promise
        .then((value) => {
          if (value instanceof Result) {
            return resolve(value);
          }

          return resolve(Result.ok(value));
        })
        .catch((error) => resolve(Result.err(error)));
    });
  }

  static wrapNullable<T, E, NullError, UndefinedError>(
    promise: Promise<T>,
    nullError: NonNullable<NullError>,
    undefinedError: NonNullable<UndefinedError>
  ): AsyncResult<T, E | NullError | UndefinedError> {
    return new AsyncResult((resolve) => {
      promise
        .then((value) => {
          if (value === null) {
            return resolve(Result.err(nullError));
          }

          if (value === undefined) {
            return resolve(Result.err(undefinedError));
          }

          return resolve(Result.ok(value));
        })
        .catch((error) => resolve(Result.err(error)));
    });
  }

  unwrap(): Promise<Res<T, E>>;
  unwrap(fallback: NonNullable<T>): Promise<NonNullable<T>>;
  unwrap(
    fallback?: NonNullable<T>
  ): Promise<Res<T, E>> | Promise<NonNullable<T>> {
    return fallback === undefined
      ? this.then<Res<T, E>>((res) => res.unwrap())
      : this.then<NonNullable<T>>((res) => res.unwrap(fallback));
  }

  transform<U, EE>(
    fn: (value: NonNullable<T>) => Result<U, EE>
  ): AsyncResult<U, E | EE>;
  transform<U, EE>(
    fn: (value: NonNullable<T>) => Promise<Result<U, EE>>
  ): AsyncResult<U, E | EE>;
  transform<U>(
    fn: (value: NonNullable<T>) => Promise<NonNullable<U>>
  ): AsyncResult<U, E | Error>;
  transform<U>(
    fn: (value: NonNullable<T>) => NonNullable<U>
  ): AsyncResult<U, E | Error>;
  transform<U, EE>(
    fn: (
      value: NonNullable<T>
    ) =>
      | Result<U, EE>
      | Promise<Result<U, EE>>
      | Promise<NonNullable<U>>
      | NonNullable<U>
  ): AsyncResult<U, E | EE | Error> {
    return new AsyncResult((resolve) => {
      this.then((oldResult) => {
        const { ok, value, error } = oldResult.unwrap();
        if (!ok) {
          return resolve(Result.err(error));
        }

        try {
          const newResult = fn(value);

          if (newResult instanceof Promise) {
            return newResult
              .then((asyncRes) =>
                asyncRes instanceof Result
                  ? resolve(asyncRes)
                  : resolve(Result.ok(asyncRes))
              )
              .catch((error) => {
                logger.warn(
                  { err: error },
                  'AsyncResult: unhandled async transform error'
                );
                return resolve(Result.err(error));
              });
          }

          if (newResult instanceof Result) {
            return resolve(newResult);
          }

          return resolve(Result.ok(newResult));
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
