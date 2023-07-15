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
  private constructor(private readonly res: Res<T, E>) {}

  static ok<T>(value: NonNullable<T>): Result<T, never> {
    return new Result({ ok: true, value });
  }

  static err<E>(error: NonNullable<E>): Result<never, E> {
    return new Result({ ok: false, error });
  }

  /**
   * Wrap a callback or promise in a Result in such a way that any thrown errors
   * are caught and wrapped with `Result.err()`.
   *
   * In case of a promise, the `AsyncResult` is returned.
   * Use `.unwrap()` to get the `Promise<Result<T, E>>` from `AsyncResult`.
   *
   *   ```ts
   *
   *   // SYNC
   *   const parse = (json: string) => Result.wrap(() => JSON.parse(json));
   *
   *   const { value, error } = parse('{"foo": "bar"}').unwrap();
   *   expect(value).toEqual({ foo: 'bar' });
   *   expect(error).toBeUndefined();
   *
   *   const { value, error } = parse('!!!').unwrap();
   *   expect(value).toBeUndefined();
   *   expect(error).toBeInstanceOf(SyntaxError);
   *
   *   // ASYNC
   *   const request = (url: string) => Result.wrap(http.get(url));
   *
   *   const { value, error } = await request('https://example.com').unwrap();
   *   expect(value).toBeString();
   *   expect(error).toBeUndefined();
   *
   *   ```
   */
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

  /**
   * Similar to `Result.wrap()`, but helps to undo the billion dollar mistake by
   * replacing `null` or `undefined` with an error of provided type.
   *
   * In case of a promise, the `AsyncResult` is returned.
   *
   *   ```ts
   *
   *   // SYNC
   *   const getHostname = (url: string) =>
   *     Result.wrapNullable(
   *       () => parseUrl(url)?.hostname,
   *       'invalid-url' as const
   *     );
   *   const { value, error } = getHostname('foobar').unwrap();
   *   expect(value).toBeUndefined();
   *   expect(error).toBe('invalid-url');
   *
   *   // ASYNC
   *   const { value, error } = await Result.wrapNullable(
   *     readLocalFile('yarn.lock'),
   *     'file-read-error' as const
   *   ).unwrap();
   *
   *   ```
   */
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

  /**
   * Returns a discriminated union for type-safe consumption of the result.
   * When `fallback` is provided, the error is discarded and value is returned directly.
   *
   *   ```ts
   *
   *   // DESTRUCTURING
   *   const { value, error } = Result.ok('foo').unwrap();
   *   expect(value).toBe('foo');
   *   expect(error).toBeUndefined();
   *
   *   // FALLBACK
   *   const value = Result.err('bar').unwrap('foo');
   *   expect(value).toBe('foo');
   *
   *   ```
   */
  unwrap(): Res<T, E>;
  unwrap(fallback: NonNullable<T>): NonNullable<T>;
  unwrap(fallback?: NonNullable<T>): Res<T, E> | NonNullable<T> {
    if (fallback === undefined) {
      return this.res;
    }
    return this.res.ok ? this.res.value : fallback;
  }

  /**
   * Transforms the value if the result is `ok`.
   * The transform function can be sync or async.
   *
   * It can return plain value, but for better control
   * of the error type, it's recommended to return `Result`.
   *
   *   ```ts
   *
   *   // SYNC
   *   const { value, error } = Result.ok('foo')
   *     .transform((x) => x.length)
   *     .unwrap();
   *   expect(value).toBe(3);
   *
   *   // ASYNC
   *   const { value, error } = await Result.wrap(
   *     http.getJson('https://api.example.com/data.json')
   *   )
   *     .transform(({ body }) => body)
   *     .unwrap();
   *
   *   ```
   */
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

/**
 * This class is being used when `Result` methods encounter async code.
 * It isn't meant to be used directly, but exported for usage in type annotations.
 *
 * All the methods resemble `Result` methods, but work asynchronously.
 */
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
