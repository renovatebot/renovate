/* eslint-disable promise/no-nesting */
import { logger } from '../logger';

interface Ok<T> {
  readonly ok: true;
  readonly val: NonNullable<T>;
  readonly err?: never;
}

interface Err<E> {
  readonly ok: false;
  readonly err: NonNullable<E>;
  readonly val?: never;
}

type Res<T, E> = Ok<T> | Err<E>;

export class Result<T, E = Error> {
  private constructor(private readonly res: Res<T, E>) {}

  static ok<T>(val: NonNullable<T>): Result<T, never> {
    return new Result({ ok: true, val });
  }

  static err<E>(err: NonNullable<E>): Result<never, E> {
    return new Result({ ok: false, err });
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
   *   const { val, err } = parse('{"foo": "bar"}').unwrap();
   *   expect(val).toEqual({ foo: 'bar' });
   *   expect(err).toBeUndefined();
   *
   *   const { val, err } = parse('!!!').unwrap();
   *   expect(val).toBeUndefined();
   *   expect(err).toBeInstanceOf(SyntaxError);
   *
   *   // ASYNC
   *   const request = (url: string) => Result.wrap(http.get(url));
   *
   *   const { val, err } = await request('https://example.com').unwrap();
   *   expect(val).toBeString();
   *   expect(err).toBeUndefined();
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
   * Functions and promises that return nullable can't be wrapped with `Result.wrap()`,
   * because `val` is constrained by being `NonNullable<T>`.
   * Therefore, `null` and `undefined` must be transformed to `err`.
   *
   * This method is the feature-rich shorthand for:
   *
   *   ```ts
   *   const { val, err } = Result.wrap(() => {
   *     const result = callback();
   *     return result === null ? Result.err('oops') : Result.ok(result);
   *   }).unwrap();
   *   ```
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
   *   const { val, err } = getHostname('foobar').unwrap();
   *   expect(val).toBeUndefined();
   *   expect(err).toBe('invalid-url');
   *
   *   // ASYNC
   *   const { val, err } = await Result.wrapNullable(
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
   *   const { val, err } = Result.ok('foo').unwrap();
   *   expect(val).toBe('foo');
   *   expect(err).toBeUndefined();
   *
   *   // FALLBACK
   *   const value = Result.err('bar').unwrap('foo');
   *   expect(val).toBe('foo');
   *
   *   ```
   */
  unwrap(): Res<T, E>;
  unwrap(fallback: NonNullable<T>): NonNullable<T>;
  unwrap(fallback?: NonNullable<T>): Res<T, E> | NonNullable<T> {
    if (fallback === undefined) {
      return this.res;
    }
    return this.res.ok ? this.res.val : fallback;
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
   *   const { val, err } = Result.ok('foo')
   *     .transform((x) => x.length)
   *     .unwrap();
   *   expect(val).toBe(3);
   *
   *   // ASYNC
   *   const { val, err } = await Result.wrap(
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
      return Result.err(this.res.err);
    }

    try {
      const res = fn(this.res.val);

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

  /**
   * Returns a discriminated union for type-safe consumption of the result.
   * When `fallback` is provided, the error is discarded and value is returned directly.
   *
   *   ```ts
   *
   *   // DESTRUCTURING
   *   const { val, err } = await Result.wrap(readFile('foo.txt')).unwrap();
   *   expect(val).toBe('foo');
   *   expect(err).toBeUndefined();
   *
   *   // FALLBACK
   *   const val = await Result.wrap(readFile('foo.txt')).unwrap('bar');
   *   expect(val).toBe('bar');
   *   expect(err).toBeUndefined();
   *
   *   ```
   */
  unwrap(): Promise<Res<T, E>>;
  unwrap(fallback: NonNullable<T>): Promise<NonNullable<T>>;
  unwrap(
    fallback?: NonNullable<T>
  ): Promise<Res<T, E>> | Promise<NonNullable<T>> {
    return fallback === undefined
      ? this.then<Res<T, E>>((res) => res.unwrap())
      : this.then<NonNullable<T>>((res) => res.unwrap(fallback));
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
   *   const { val, err } = await Result.wrap(
   *     http.getJson('https://api.example.com/data.json')
   *   )
   *     .transform(({ body }) => body)
   *     .unwrap();
   *
   *   ```
   */
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
        const { ok, val: value, err: error } = oldResult.unwrap();
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
