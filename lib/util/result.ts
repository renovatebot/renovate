import { logger } from '../logger/index.ts';
import type { Nullish } from '../types/index.ts';

type Val = NonNullable<unknown>;

interface Ok<T extends Val> {
  readonly ok: true;
  readonly val: T;
  readonly err?: never;
}

interface Err<E extends Val> {
  readonly ok: false;
  readonly err: E;
  readonly val?: never;

  /**
   * Internal flag: the error was thrown inside a callback
   * and will be re-thrown on `.unwrap()`.
   */
  readonly _uncaught?: true;
}

type Res<T extends Val, E extends Val> = Ok<T> | Err<E>;

/**
 * Structural interface for schema validators.
 * Keeps this module independent from any particular validation library:
 * anything exposing a compatible `safeParse` works with `Result.parse()`.
 *
 * Note: `T extends Val` means schemas with nullable or optional output are
 * rejected at compile time. Apply the `nonNullish` transform from
 * `lib/util/schema-utils` to turn nullish output into a parse error.
 */
export interface SafeParser<T extends Val, E extends Val> {
  safeParse(
    input: unknown,
  ):
    | { readonly success: true; readonly data: T }
    | { readonly success: false; readonly error: E };
}

type SafeParseShape =
  | { readonly success: true; readonly data: unknown }
  | { readonly success: false; readonly error: unknown };

/**
 * All non-nullable values that also are not Promises nor safeParse results.
 * Promises are excluded to route them into the async overloads; safeParse
 * results are excluded so that schema validation must go through `.parse()`
 * explicitly instead of relying on shape sniffing.
 */
type RawValue<T extends Val> = Exclude<T, Promise<unknown> | SafeParseShape>;

function fromNullable<T extends Val, E extends Val>(
  input: Nullish<T>,
  errForNullable: E,
): Result<T, E> {
  return input === null || input === undefined
    ? Result.err(errForNullable)
    : Result.ok(input);
}

function rethrowUncaught(err: unknown): never {
  // oxlint-disable-next-line typescript/only-throw-error -- the foreign value thrown inside a callback is re-thrown verbatim to preserve its identity
  throw err;
}

/**
 * Class for representing a result that can fail.
 *
 * The mental model:
 * - `.wrap()` and `.wrapNullable()` are sinks
 * - `.transform()` are pipes which can be chained
 * - `.unwrap()` is the point of consumption
 */
export class Result<T extends Val, E extends Val = Error> {
  private readonly res: Res<T, E>;

  private constructor(res: Res<T, E>) {
    this.res = res;
  }

  static ok<T extends Val>(val: T): Result<T, never> {
    return new Result({ ok: true, val });
  }

  static err<E extends Val>(err: E): Result<never, E> {
    return new Result({ ok: false, err });
  }

  /**
   * Internal channel for programmer errors thrown inside callbacks.
   * Deliberately type-invisible: `Result<never, never>` is assignable to every
   * `Result<T, E>`, because uncaught errors bypass the typed error channel —
   * they skip `.catch()` and re-throw at unwrap points.
   */
  static _uncaught(err: unknown): Result<never, never> {
    return new Result<never, never>({
      ok: false,
      err: err as never,
      _uncaught: true,
    });
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
  static wrap<T extends Val, E extends Val = Error>(
    callback: () => RawValue<T>,
  ): Result<T, E>;
  static wrap<T extends Val, E extends Val = Error>(
    callback: () => Promise<RawValue<T>>,
  ): AsyncResult<T, E>;
  static wrap<T extends Val, E extends Val = Error, EE extends Val = never>(
    promise: Promise<Result<T, EE>>,
  ): AsyncResult<T, E | EE>;
  static wrap<T extends Val, E extends Val = Error>(
    promise: Promise<RawValue<T>>,
  ): AsyncResult<T, E>;
  static wrap<T extends Val, E extends Val = Error, EE extends Val = never>(
    input:
      | (() => RawValue<T>)
      | (() => Promise<RawValue<T>>)
      | Promise<Result<T, EE>>
      | Promise<RawValue<T>>,
  ): Result<T, E | EE> | AsyncResult<T, E | EE> {
    if (input instanceof Promise) {
      return AsyncResult.wrap(input);
    }

    try {
      const result = input();

      if (result instanceof Promise) {
        return AsyncResult.wrap(result);
      }

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
   * because `val` is constrained by being `NonNullable`, `null` and `undefined`
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
  static wrapNullable<
    T extends Val,
    E extends Val = Error,
    ErrForNullable extends Val = Error,
  >(
    callback: () => Nullish<T>,
    errForNullable: ErrForNullable,
  ): Result<T, E | ErrForNullable>;
  static wrapNullable<
    T extends Val,
    E extends Val = Error,
    ErrForNullable extends Val = Error,
  >(
    promise: Promise<Nullish<T>>,
    errForNullable: ErrForNullable,
  ): AsyncResult<T, E | ErrForNullable>;
  static wrapNullable<
    T extends Val,
    E extends Val = Error,
    ErrForNullable extends Val = Error,
  >(
    value: Nullish<T>,
    errForNullable: ErrForNullable,
  ): Result<T, E | ErrForNullable>;
  static wrapNullable<
    T extends Val,
    E extends Val = Error,
    ErrForNullable extends Val = Error,
  >(
    input: (() => Nullish<T>) | Promise<Nullish<T>> | Nullish<T>,
    errForNullable: ErrForNullable,
  ): Result<T, E | ErrForNullable> | AsyncResult<T, E | ErrForNullable> {
    if (input instanceof Promise) {
      return AsyncResult.wrapNullable(input, errForNullable);
    }

    if (input instanceof Function) {
      try {
        return fromNullable(input(), errForNullable);
      } catch (error) {
        return Result.err(error);
      }
    }

    return fromNullable(input, errForNullable);
  }

  /**
   * Given a `schema` and `input`, returns a `Result` with `val` being the
   * parsed value. The schema's output type must be non-nullable — this is
   * enforced at compile time via `SafeParser`. If a schema lies about its
   * output type and produces a nullish value at runtime, that is a programmer
   * error and is routed to the `_uncaught` channel.
   */
  static parse<T extends Val, E extends Val>(
    input: unknown,
    schema: SafeParser<T, E>,
  ): Result<T, E> {
    const result = schema.safeParse(input);

    if (!result.success) {
      return Result.err(result.error);
    }

    if (result.data === null || result.data === undefined) {
      const err = new TypeError(
        'Result.parse: schema output must not be nullish',
      );
      logger.warn({ err }, 'Result: nullish schema output');
      return Result._uncaught(err);
    }

    return Result.ok(result.data);
  }

  /**
   * Returns a discriminated union for type-safe consumption of the result.
   * When error was uncaught during transformation, it's being re-thrown here.
   *
   *   ```ts
   *
   *   const { val, err } = Result.ok('foo').unwrap();
   *   expect(val).toBe('foo');
   *   expect(err).toBeUndefined();
   *
   *   ```
   */
  unwrap(): Res<T, E> {
    if (!this.res.ok && this.res._uncaught) {
      rethrowUncaught(this.res.err);
    }

    return this.res;
  }

  /**
   * Returns a success value or a fallback value.
   * When error was uncaught during transformation, it's being re-thrown here.
   *
   *   ```ts
   *
   *   const value = Result.err('bar').unwrapOr('foo');
   *   expect(val).toBe('foo');
   *
   *   ```
   */
  unwrapOr(fallback: T): T {
    if (this.res.ok) {
      return this.res.val;
    }

    if (this.res._uncaught) {
      rethrowUncaught(this.res.err);
    }

    return fallback;
  }

  /**
   * Returns the ok-value or throws the error.
   * Only available when the error channel is `Error`-typed —
   * results with plain-value errors must be consumed via `unwrap()` instead.
   */
  unwrapOrThrow(this: Result<T, Error>): T {
    if (this.res.ok) {
      return this.res.val;
    }

    throw this.res.err;
  }

  /**
   * Returns the ok-value or `null`.
   * When error was uncaught during transformation, it's being re-thrown here.
   */
  unwrapOrNull(): T | null {
    if (this.res.ok) {
      return this.res.val;
    }

    if (this.res._uncaught) {
      rethrowUncaught(this.res.err);
    }

    return null;
  }

  /**
   * Transforms the ok-value, sync or async way.
   *
   * Transform functions SHOULD NOT throw.
   * Uncaught errors are logged and wrapped to `Result._uncaught()`,
   * which leads to re-throwing them in `unwrap()`.
   *
   * Use `.parse(schema)` for schema validation in a transform chain.
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
  transform<U extends Val, EE extends Val>(
    fn: (value: T) => Result<U, E | EE>,
  ): Result<U, E | EE>;
  transform<U extends Val, EE extends Val>(
    fn: (value: T) => AsyncResult<U, E | EE>,
  ): AsyncResult<U, E | EE>;
  transform<U extends Val, EE extends Val>(
    fn: (value: T) => Promise<Result<U, E | EE>>,
  ): AsyncResult<U, E | EE>;
  transform<U extends Val>(
    fn: (value: T) => Promise<RawValue<U>>,
  ): AsyncResult<U, E>;
  transform<U extends Val>(fn: (value: T) => RawValue<U>): Result<U, E>;
  transform<U extends Val, EE extends Val>(
    fn: (
      value: T,
    ) =>
      | Result<U, E | EE>
      | AsyncResult<U, E | EE>
      | Promise<Result<U, E | EE>>
      | Promise<RawValue<U>>
      | RawValue<U>,
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

  catch<U extends Val = T, EE extends Val = E>(
    fn: (err: E) => Result<U, EE>,
  ): Result<T | U, EE>;
  catch<U extends Val = T, EE extends Val = E>(
    fn: (err: E) => AsyncResult<U, EE>,
  ): AsyncResult<T | U, EE>;
  catch<U extends Val = T, EE extends Val = E>(
    fn: (err: E) => Promise<Result<U, EE>>,
  ): AsyncResult<T | U, EE>;
  catch<U extends Val = T, EE extends Val = E>(
    fn: (err: E) => Result<U, EE> | AsyncResult<U, EE> | Promise<Result<U, EE>>,
  ): Result<T | U, EE> | AsyncResult<T | U, EE>;
  catch<U extends Val = T, EE extends Val = E>(
    fn: (err: E) => Result<U, EE> | AsyncResult<U, EE> | Promise<Result<U, EE>>,
  ): Result<T | U, EE> | AsyncResult<T | U, EE> {
    if (this.res.ok) {
      return Result.ok(this.res.val);
    }

    if (this.res._uncaught) {
      return Result._uncaught(this.res.err);
    }

    try {
      const result = fn(this.res.err);

      if (result instanceof Promise) {
        return AsyncResult.wrap(result, (err) => {
          logger.warn(
            { err },
            'Result: unexpected error in async catch handler',
          );
          return Result._uncaught(err);
        });
      }

      return result;
    } catch (err) {
      logger.warn({ err }, 'Result: unexpected error in catch handler');
      return Result._uncaught(err);
    }
  }

  /**
   * Given a `schema`, returns a `Result` with `val` being the parsed value.
   */
  parse<U extends Val, EE extends Val>(
    schema: SafeParser<U, EE>,
  ): Result<U, E | EE> {
    if (this.res.ok) {
      return Result.parse(this.res.val, schema);
    }

    if (this.res._uncaught) {
      return Result._uncaught(this.res.err);
    }

    return Result.err(this.res.err);
  }

  /**
   * Call `fn` on the `val` if the result is ok.
   */
  onValue(fn: (value: T) => void): Result<T, E> {
    if (this.res.ok) {
      try {
        fn(this.res.val);
      } catch (err) {
        logger.warn({ err }, 'Result: unexpected error in onValue callback');
        return Result._uncaught(err);
      }
    }

    return this;
  }

  /**
   * Call `fn` on the `err` if the result is err.
   */
  onError(fn: (err: E) => void): Result<T, E> {
    if (!this.res.ok) {
      try {
        fn(this.res.err);
      } catch (err) {
        logger.warn({ err }, 'Result: unexpected error in onError callback');
        return Result._uncaught(err);
      }
    }

    return this;
  }
}

/**
 * This class is being used when `Result` methods encounter async code.
 * It isn't meant to be used directly, but exported for usage in type annotations.
 *
 * All the methods resemble `Result` methods, but work asynchronously.
 */
export class AsyncResult<T extends Val, E extends Val> implements PromiseLike<
  Result<T, E>
> {
  private asyncResult: Promise<Result<T, E>>;

  private constructor(asyncResult: Promise<Result<T, E>>) {
    this.asyncResult = asyncResult;
  }

  // oxlint-disable-next-line unicorn/no-thenable -- required to implement PromiseLike
  then<TResult1 = Result<T, E>>(
    onfulfilled?:
      | ((value: Result<T, E>) => TResult1 | PromiseLike<TResult1>)
      | null,
  ): PromiseLike<TResult1> {
    return this.asyncResult.then(onfulfilled);
  }

  static ok<T extends Val>(val: T): AsyncResult<T, never> {
    return new AsyncResult(Promise.resolve(Result.ok(val)));
  }

  static err<E extends Val>(err: E): AsyncResult<never, E> {
    return new AsyncResult(Promise.resolve(Result.err(err)));
  }

  static wrap<T extends Val, E extends Val = Error, EE extends Val = never>(
    promise: Promise<Result<T, EE>> | Promise<RawValue<T>>,
    onErr?: (err: E) => Result<T, E>,
  ): AsyncResult<T, E | EE> {
    return new AsyncResult(
      promise
        .then((value) => (value instanceof Result ? value : Result.ok(value)))
        .catch((err) => {
          if (onErr) {
            return onErr(err);
          }
          return Result.err(err);
        }),
    );
  }

  static wrapNullable<T extends Val, E extends Val, ErrForNullable extends Val>(
    promise: Promise<Nullish<T>>,
    errForNullable: ErrForNullable,
  ): AsyncResult<T, E | ErrForNullable> {
    return new AsyncResult(
      promise
        .then((value) => fromNullable(value, errForNullable))
        .catch((err) => Result.err(err)),
    );
  }

  /**
   * Returns a discriminated union for type-safe consumption of the result.
   *
   *   ```ts
   *
   *   const { val, err } = await Result.wrap(readFile('foo.txt')).unwrap();
   *   expect(val).toBe('foo');
   *   expect(err).toBeUndefined();
   *
   *   ```
   */
  unwrap(): Promise<Res<T, E>> {
    return this.asyncResult.then<Res<T, E>>((res) => res.unwrap());
  }

  /**
   * Returns a success value or a fallback value.
   *
   *   ```ts
   *
   *   const val = await Result.wrap(readFile('foo.txt')).unwrapOr('bar');
   *   expect(val).toBe('bar');
   *   expect(err).toBeUndefined();
   *
   *   ```
   */
  unwrapOr(fallback: T): Promise<T> {
    return this.asyncResult.then<T>((res) => res.unwrapOr(fallback));
  }

  /**
   * Returns the ok-value or throws the error.
   */
  async unwrapOrThrow(this: AsyncResult<T, Error>): Promise<T> {
    const result = await this.asyncResult;
    return result.unwrapOrThrow();
  }

  /**
   * Returns the ok-value or `null`.
   */
  unwrapOrNull(): Promise<T | null> {
    return this.asyncResult.then<T | null>((res) => res.unwrapOrNull());
  }

  /**
   * Transforms the ok-value, sync or async way.
   *
   * Transform functions SHOULD NOT throw.
   * Uncaught errors are logged and wrapped to `Result._uncaught()`,
   * which leads to re-throwing them in `unwrap()`.
   *
   * Use `.parse(schema)` for schema validation in a transform chain.
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
  transform<U extends Val, EE extends Val>(
    fn: (value: T) => Result<U, E | EE>,
  ): AsyncResult<U, E | EE>;
  transform<U extends Val, EE extends Val>(
    fn: (value: T) => AsyncResult<U, E | EE>,
  ): AsyncResult<U, E | EE>;
  transform<U extends Val, EE extends Val>(
    fn: (value: T) => Promise<Result<U, E | EE>>,
  ): AsyncResult<U, E | EE>;
  transform<U extends Val>(
    fn: (value: T) => Promise<RawValue<U>>,
  ): AsyncResult<U, E>;
  transform<U extends Val>(fn: (value: T) => RawValue<U>): AsyncResult<U, E>;
  transform<U extends Val, EE extends Val>(
    fn: (
      value: T,
    ) =>
      | Result<U, E | EE>
      | AsyncResult<U, E | EE>
      | Promise<Result<U, E | EE>>
      | Promise<RawValue<U>>
      | RawValue<U>,
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
              return AsyncResult.wrap<U, E | EE, E | EE>(result, (err) => {
                logger.warn(
                  { err },
                  'AsyncResult: unhandled async transform error',
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
        }),
    );
  }

  catch<U extends Val = T, EE extends Val = E>(
    fn: (err: E) => Result<U, EE>,
  ): AsyncResult<T | U, EE>;
  catch<U extends Val = T, EE extends Val = E>(
    fn: (err: E) => AsyncResult<U, EE>,
  ): AsyncResult<T | U, EE>;
  catch<U extends Val = T, EE extends Val = E>(
    fn: (err: E) => Promise<Result<U, EE>>,
  ): AsyncResult<T | U, EE>;
  catch<U extends Val = T, EE extends Val = E>(
    fn: (err: E) => Result<U, EE> | AsyncResult<U, EE> | Promise<Result<U, EE>>,
  ): AsyncResult<T | U, EE>;
  catch<U extends Val = T, EE extends Val = E>(
    fn: (err: E) => Result<U, EE> | AsyncResult<U, EE> | Promise<Result<U, EE>>,
  ): AsyncResult<T | U, EE> {
    return new AsyncResult(
      this.asyncResult
        .then((result) => result.catch(fn))
        .catch(
          /* v8 ignore next -- should never happen */
          (err) => Result.err(err),
        ),
    );
  }

  /**
   * Given a `schema`, returns a `Result` with `val` being the parsed value.
   */
  parse<U extends Val, EE extends Val>(
    schema: SafeParser<U, EE>,
  ): AsyncResult<U, E | EE> {
    return new AsyncResult(
      this.asyncResult
        .then((oldResult) => oldResult.parse(schema))
        .catch(
          /* v8 ignore next -- should never happen */
          (err) => Result._uncaught(err),
        ),
    );
  }

  onValue(fn: (value: T) => void): AsyncResult<T, E> {
    return new AsyncResult(
      this.asyncResult
        .then((result) => result.onValue(fn))
        .catch(
          /* v8 ignore next -- should never happen */
          (err) => Result._uncaught(err),
        ),
    );
  }

  onError(fn: (err: E) => void): AsyncResult<T, E> {
    return new AsyncResult(
      this.asyncResult
        .then((result) => result.onError(fn))
        .catch(
          /* v8 ignore next -- should never happen */
          (err) => Result._uncaught(err),
        ),
    );
  }
}
