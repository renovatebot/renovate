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

  /**
   * Internal flag to indicate that the error was thrown during `.transform()`
   * and will be re-thrown on `.unwrap()`.
   */
  readonly _uncaught?: true;
}

type Res<T, E> = Ok<T> | Err<E>;

/**
 * Class for representing a result that can fail.
 *
 * The mental model:
 * - `.wrap()` and `.wrapNullable()` are sinks
 * - `.transform()` are pipes which can be chained
 * - `.unwrap()` is the point of consumption
 */
export class Result<T, E = Error> {
  private constructor(private readonly res: Res<T, E>) {}

  static ok<T>(val: NonNullable<T>): Result<T, never> {
    return new Result({ ok: true, val });
  }

  static err<E>(err: NonNullable<E>): Result<never, E> {
    return new Result({ ok: false, err });
  }

  static _uncaught<E>(err: NonNullable<E>): Result<never, E> {
    return new Result({ ok: false, err, _uncaught: true });
  }

  /**
   * Wrap a callback or promise in a Result in such a way that any thrown errors
   * are caught and wrapped with `Result.err()` (and hence never re-thrown).
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
  static wrap<T, E = Error, EE = never>(
    promise: Promise<Result<T, EE>>
  ): AsyncResult<T, E | EE>;
  static wrap<T, E = Error>(
    promise: Promise<NonNullable<T>>
  ): AsyncResult<T, E>;
  static wrap<T, E = Error, EE = never>(
    input:
      | (() => NonNullable<T>)
      | Promise<Result<T, EE>>
      | Promise<NonNullable<T>>
  ): Result<T, E | EE> | AsyncResult<T, E | EE> {
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
   * Errors thrown inside the callback or promise are caught and wrapped with `Result.err()`,
   * hence never re-thrown.
   *
   * Since functions and promises returning nullable can't be wrapped with `Result.wrap()`
   * because `val` is constrained by being `NonNullable<T>`, `null` and `undefined`
   * must be converted to some sort of `err` value.
   *
   * This method does exactly this, i.g. it is the feature-rich shorthand for:
   *
   *   ```ts
   *   const { val, err } = Result.wrap(() => {
   *     const result = callback();
   *     return result === null || result === undefined
   *       ? Result.err('oops')
   *       : Result.ok(result);
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
   * When error was uncaught during transformation, it's being re-thrown here.
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
    if (this.res.ok) {
      return fallback === undefined ? this.res : this.res.val;
    }

    if (fallback !== undefined) {
      return fallback;
    }

    if (this.res._uncaught) {
      throw this.res.err;
    }

    return this.res;
  }

  /**
   * Transforms the ok-value, sync or async way.
   *
   * Transform functions SHOULD NOT throw.
   * Uncaught errors are logged and wrapped to `Result._uncaught()`,
   * which leads to re-throwing them in `unwrap()`.
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
    fn: (value: NonNullable<T>) => Result<U, E | EE>
  ): Result<U, E | EE>;
  transform<U, EE>(
    fn: (value: NonNullable<T>) => AsyncResult<U, E | EE>
  ): AsyncResult<U, E | EE>;
  transform<U, EE>(
    fn: (value: NonNullable<T>) => Promise<Result<U, E | EE>>
  ): AsyncResult<U, E | EE>;
  transform<U>(
    fn: (value: NonNullable<T>) => Promise<NonNullable<U>>
  ): AsyncResult<U, E>;
  transform<U>(fn: (value: NonNullable<T>) => NonNullable<U>): Result<U, E>;
  transform<U, EE>(
    fn: (
      value: NonNullable<T>
    ) =>
      | Result<U, E | EE>
      | AsyncResult<U, E | EE>
      | Promise<Result<U, E | EE>>
      | Promise<NonNullable<U>>
      | NonNullable<U>
  ): Result<U, E | EE> | AsyncResult<U, E | EE> {
    if (!this.res.ok) {
      return Result.err(this.res.err);
    }

    try {
      const result = fn(this.res.val);

      if (result instanceof Result) {
        return result;
      }

      if (result instanceof AsyncResult) {
        return result;
      }

      if (result instanceof Promise) {
        return AsyncResult.wrap(result, (err) => {
          logger.warn({ err }, 'Result: unhandled async transform error');
          return Result._uncaught(err);
        });
      }

      return Result.ok(result);
    } catch (err) {
      logger.warn({ err }, 'Result: unhandled transform error');
      return Result._uncaught(err);
    }
  }
}

/**
 * This class is being used when `Result` methods encounter async code.
 * It isn't meant to be used directly, but exported for usage in type annotations.
 *
 * All the methods resemble `Result` methods, but work asynchronously.
 */
export class AsyncResult<T, E> implements PromiseLike<Result<T, E>> {
  private constructor(private asyncResult: Promise<Result<T, E>>) {}

  then<TResult1 = Result<T, E>>(
    onfulfilled?:
      | ((value: Result<T, E>) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null
  ): PromiseLike<TResult1> {
    return this.asyncResult.then(onfulfilled);
  }

  static ok<T>(val: NonNullable<T>): AsyncResult<T, never> {
    return new AsyncResult(new Promise((resolve) => resolve(Result.ok(val))));
  }

  static err<E>(err: NonNullable<E>): AsyncResult<never, E> {
    return new AsyncResult(new Promise((resolve) => resolve(Result.err(err))));
  }

  static wrap<T, E = Error, EE = never>(
    promise: Promise<Result<T, EE>> | Promise<NonNullable<T>>,
    onErr?: (err: NonNullable<E>) => Result<T, E>
  ): AsyncResult<T, E | EE> {
    return new AsyncResult(
      promise.then<Result<T, E | EE>, Result<T, E | EE>>(
        (value) => {
          if (value instanceof Result) {
            return value;
          }
          return Result.ok(value);
        },
        (err) => {
          if (onErr) {
            return onErr(err);
          }
          return Result.err(err);
        }
      )
    );
  }

  static wrapNullable<T, E, NullError, UndefinedError>(
    promise: Promise<T>,
    nullError: NonNullable<NullError>,
    undefinedError: NonNullable<UndefinedError>
  ): AsyncResult<T, E | NullError | UndefinedError> {
    return new AsyncResult(
      promise
        .then((value) => {
          if (value === null) {
            return Result.err(nullError);
          }

          if (value === undefined) {
            return Result.err(undefinedError);
          }

          return Result.ok(value);
        })
        .catch((err) => Result.err(err))
    );
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
      ? this.asyncResult.then<Res<T, E>>((res) => res.unwrap())
      : this.asyncResult.then<NonNullable<T>>((res) => res.unwrap(fallback));
  }

  /**
   * Transforms the ok-value, sync or async way.
   *
   * Transform functions SHOULD NOT throw.
   * Uncaught errors are logged and wrapped to `Result._uncaught()`,
   * which leads to re-throwing them in `unwrap()`.
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
    fn: (value: NonNullable<T>) => Result<U, E | EE>
  ): AsyncResult<U, E | EE>;
  transform<U, EE>(
    fn: (value: NonNullable<T>) => AsyncResult<U, E | EE>
  ): AsyncResult<U, E | EE>;
  transform<U, EE>(
    fn: (value: NonNullable<T>) => Promise<Result<U, E | EE>>
  ): AsyncResult<U, E | EE>;
  transform<U>(
    fn: (value: NonNullable<T>) => Promise<NonNullable<U>>
  ): AsyncResult<U, E>;
  transform<U>(
    fn: (value: NonNullable<T>) => NonNullable<U>
  ): AsyncResult<U, E>;
  transform<U, EE>(
    fn: (
      value: NonNullable<T>
    ) =>
      | Result<U, E | EE>
      | AsyncResult<U, E | EE>
      | Promise<Result<U, E | EE>>
      | Promise<NonNullable<U>>
      | NonNullable<U>
  ): AsyncResult<U, E | EE> {
    return new AsyncResult(
      this.asyncResult
        .then((oldResult) => {
          const { ok, val: value, err: error } = oldResult.unwrap();
          if (!ok) {
            return Result.err(error);
          }

          try {
            const result = fn(value);

            if (result instanceof Result) {
              return result;
            }

            if (result instanceof AsyncResult) {
              return result;
            }

            if (result instanceof Promise) {
              return AsyncResult.wrap(result, (err) => {
                logger.warn(
                  { err },
                  'AsyncResult: unhandled async transform error'
                );
                return Result._uncaught(err);
              });
            }

            return Result.ok(result);
          } catch (err) {
            logger.warn({ err }, 'AsyncResult: unhandled transform error');
            return Result._uncaught(err);
          }
        })
        .catch((err) => {
          // Happens when `.unwrap()` of `oldResult` throws
          return Result._uncaught(err);
        })
    );
  }
}
