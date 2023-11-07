import { SafeParseReturnType, ZodError, ZodType, ZodTypeDef, z } from 'zod';
import { logger } from '../logger';

type Val = NonNullable<unknown>;
type Nullable<T extends Val> = T | null | undefined;

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
   * Internal flag to indicate that the error was thrown during `.transform()`
   * and will be re-thrown on `.unwrap()`.
   */
  readonly _uncaught?: true;
}

type Res<T extends Val, E extends Val> = Ok<T> | Err<E>;

function isZodResult<Input, Output extends Val>(
  input: unknown,
): input is SafeParseReturnType<Input, Output> {
  if (
    typeof input !== 'object' ||
    input === null ||
    Object.keys(input).length !== 2 ||
    !('success' in input) ||
    typeof input.success !== 'boolean'
  ) {
    return false;
  }

  if (input.success) {
    return (
      'data' in input &&
      typeof input.data !== 'undefined' &&
      input.data !== null
    );
  } else {
    return 'error' in input && input.error instanceof ZodError;
  }
}

function fromZodResult<ZodInput, ZodOutput extends Val>(
  input: SafeParseReturnType<ZodInput, ZodOutput>,
): Result<ZodOutput, ZodError<ZodInput>> {
  return input.success ? Result.ok(input.data) : Result.err(input.error);
}

/**
 * All non-nullable values that also are not Promises nor Zod results.
 * It's useful for restricting Zod results to not return `null` or `undefined`.
 */
type RawValue<T extends Val> = Exclude<
  T,
  SafeParseReturnType<unknown, T> | Promise<unknown>
>;

function fromNullable<
  T extends Val,
  ErrForNull extends Val,
  ErrForUndefined extends Val,
>(
  input: Nullable<T>,
  errForNull: ErrForNull,
  errForUndefined: ErrForUndefined,
): Result<T, ErrForNull | ErrForUndefined> {
  if (input === null) {
    return Result.err(errForNull);
  }

  if (input === undefined) {
    return Result.err(errForUndefined);
  }

  return Result.ok(input);
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
  private constructor(private readonly res: Res<T, E>) {}

  static ok<T extends Val>(val: T): Result<T, never> {
    return new Result({ ok: true, val });
  }

  static err<E extends Val>(err: E): Result<never, E> {
    return new Result({ ok: false, err });
  }

  static _uncaught<E extends Val>(err: E): Result<never, E> {
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
  static wrap<T extends Val, Input = unknown>(
    zodResult: SafeParseReturnType<Input, T>,
  ): Result<T, ZodError<Input>>;
  static wrap<T extends Val, E extends Val = Error>(
    callback: () => RawValue<T>,
  ): Result<T, E>;
  static wrap<T extends Val, E extends Val = Error, EE extends Val = never>(
    promise: Promise<Result<T, EE>>,
  ): AsyncResult<T, E | EE>;
  static wrap<T extends Val, E extends Val = Error>(
    promise: Promise<RawValue<T>>,
  ): AsyncResult<T, E>;
  static wrap<
    T extends Val,
    E extends Val = Error,
    EE extends Val = never,
    Input = unknown,
  >(
    input:
      | SafeParseReturnType<Input, T>
      | (() => RawValue<T>)
      | Promise<Result<T, EE>>
      | Promise<RawValue<T>>,
  ): Result<T, ZodError<Input>> | Result<T, E | EE> | AsyncResult<T, E | EE> {
    if (isZodResult<Input, T>(input)) {
      return fromZodResult(input);
    }

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
    callback: () => Nullable<T>,
    errForNullable: ErrForNullable,
  ): Result<T, E | ErrForNullable>;
  static wrapNullable<
    T extends Val,
    E extends Val = Error,
    ErrForNull extends Val = Error,
    ErrForUndefined extends Val = Error,
  >(
    callback: () => Nullable<T>,
    errForNull: ErrForNull,
    errForUndefined: ErrForUndefined,
  ): Result<T, E | ErrForNull | ErrForUndefined>;
  static wrapNullable<
    T extends Val,
    E extends Val = Error,
    ErrForNullable extends Val = Error,
  >(
    promise: Promise<Nullable<T>>,
    errForNullable: ErrForNullable,
  ): AsyncResult<T, E | ErrForNullable>;
  static wrapNullable<
    T extends Val,
    E extends Val = Error,
    ErrForNull extends Val = Error,
    ErrForUndefined extends Val = Error,
  >(
    promise: Promise<Nullable<T>>,
    errForNull: ErrForNull,
    errForUndefined: ErrForUndefined,
  ): AsyncResult<T, E | ErrForNull | ErrForUndefined>;
  static wrapNullable<
    T extends Val,
    E extends Val = Error,
    ErrForNullable extends Val = Error,
  >(
    value: Nullable<T>,
    errForNullable: ErrForNullable,
  ): Result<T, E | ErrForNullable>;
  static wrapNullable<
    T extends Val,
    E extends Val = Error,
    ErrForNull extends Val = Error,
    ErrForUndefined extends Val = Error,
  >(
    value: Nullable<T>,
    errForNull: ErrForNull,
    errForUndefined: ErrForUndefined,
  ): Result<T, E | ErrForNull | ErrForUndefined>;
  static wrapNullable<
    T extends Val,
    E extends Val = Error,
    ErrForNull extends Val = Error,
    ErrForUndefined extends Val = Error,
  >(
    input: (() => Nullable<T>) | Promise<Nullable<T>> | Nullable<T>,
    arg2: ErrForNull,
    arg3?: ErrForUndefined,
  ):
    | Result<T, E | ErrForNull | ErrForUndefined>
    | AsyncResult<T, E | ErrForNull | ErrForUndefined> {
    const errForNull = arg2;
    const errForUndefined = arg3 ?? arg2;

    if (input instanceof Promise) {
      return AsyncResult.wrapNullable(input, errForNull, errForUndefined);
    }

    if (input instanceof Function) {
      try {
        const result = input();
        return fromNullable(result, errForNull, errForUndefined);
      } catch (error) {
        return Result.err(error);
      }
    }

    return fromNullable(input, errForNull, errForUndefined);
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
    if (this.res.ok) {
      return this.res;
    }

    if (this.res._uncaught) {
      throw this.res.err;
    }

    return this.res;
  }

  /**
   * Returns a success value or a fallback value.
   * When error was uncaught during transformation, it's being re-thrown here.
   *
   *   ```ts
   *
   *   const value = Result.err('bar').unwrapOrElse('foo');
   *   expect(val).toBe('foo');
   *
   *   ```
   */
  unwrapOrElse(fallback: T): T {
    if (this.res.ok) {
      return this.res.val;
    }

    if (this.res._uncaught) {
      throw this.res.err;
    }

    return fallback;
  }

  /**
   * Returns the ok-value or throw the error.
   */
  unwrapOrThrow(): T {
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
      throw this.res.err;
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
   * Zod `.safeParse()` results are converted automatically.
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
  transform<U extends Val, Input = unknown>(
    fn: (value: T) => SafeParseReturnType<Input, NonNullable<U>>,
  ): Result<U, E | ZodError<Input>>;
  transform<U extends Val, Input = unknown>(
    fn: (value: T) => Promise<SafeParseReturnType<Input, NonNullable<U>>>,
  ): AsyncResult<U, E | ZodError<Input>>;
  transform<U extends Val, EE extends Val>(
    fn: (value: T) => Promise<Result<U, E | EE>>,
  ): AsyncResult<U, E | EE>;
  transform<U extends Val>(
    fn: (value: T) => Promise<RawValue<U>>,
  ): AsyncResult<U, E>;
  transform<U extends Val>(fn: (value: T) => RawValue<U>): Result<U, E>;
  transform<U extends Val, EE extends Val, Input = unknown>(
    fn: (
      value: T,
    ) =>
      | Result<U, E | EE>
      | AsyncResult<U, E | EE>
      | SafeParseReturnType<Input, NonNullable<U>>
      | Promise<SafeParseReturnType<Input, NonNullable<U>>>
      | Promise<Result<U, E | EE>>
      | Promise<RawValue<U>>
      | RawValue<U>,
  ):
    | Result<U, E | EE | ZodError<Input>>
    | AsyncResult<U, E | EE | ZodError<Input>> {
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

      if (isZodResult<Input, U>(result)) {
        return fromZodResult(result);
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
    fn: (err: E) => Result<U, E | EE>,
  ): Result<T | U, E | EE>;
  catch<U extends Val = T, EE extends Val = E>(
    fn: (err: E) => AsyncResult<U, E | EE>,
  ): AsyncResult<T | U, E | EE>;
  catch<U extends Val = T, EE extends Val = E>(
    fn: (err: E) => Promise<Result<U, E | EE>>,
  ): AsyncResult<T | U, E | EE>;
  catch<U extends Val = T, EE extends Val = E>(
    fn: (
      err: E,
    ) =>
      | Result<U, E | EE>
      | AsyncResult<U, E | EE>
      | Promise<Result<U, E | EE>>,
  ): Result<T | U, E | EE> | AsyncResult<T | U, E | EE> {
    if (this.res.ok) {
      return this;
    }

    if (this.res._uncaught) {
      return this;
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
   * Given a `schema` and `input`, returns a `Result` with `val` being the parsed value.
   * Additionally, `null` and `undefined` values are converted into Zod error.
   */
  static parse<
    T,
    Schema extends ZodType<T, ZodTypeDef, Input>,
    Input = unknown,
  >(
    input: unknown,
    schema: Schema,
  ): Result<NonNullable<z.infer<Schema>>, ZodError<Input>> {
    const parseResult = schema
      .transform((result, ctx): NonNullable<T> => {
        if (result === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Result can't accept nullish values, but input was parsed by Zod schema to undefined`,
          });
          return z.NEVER;
        }

        if (result === null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Result can't accept nullish values, but input was parsed by Zod schema to null`,
          });
          return z.NEVER;
        }

        return result;
      })
      .safeParse(input);

    return fromZodResult(parseResult);
  }

  /**
   * Given a `schema`, returns a `Result` with `val` being the parsed value.
   * Additionally, `null` and `undefined` values are converted into Zod error.
   */
  parse<T, Schema extends ZodType<T, ZodTypeDef, Input>, Input = unknown>(
    schema: Schema,
  ): Result<NonNullable<z.infer<Schema>>, E | ZodError<Input>> {
    if (this.res.ok) {
      return Result.parse(this.res.val, schema);
    }

    const err = this.res.err;

    if (this.res._uncaught) {
      return Result._uncaught(err);
    }

    return Result.err(err);
  }

  /**
   * Call `fn` on the `val` if the result is ok.
   */
  onValue(fn: (value: T) => void): Result<T, E> {
    if (this.res.ok) {
      try {
        fn(this.res.val);
      } catch (err) {
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
export class AsyncResult<T extends Val, E extends Val>
  implements PromiseLike<Result<T, E>>
{
  private constructor(private asyncResult: Promise<Result<T, E>>) {}

  then<TResult1 = Result<T, E>>(
    onfulfilled?:
      | ((value: Result<T, E>) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
  ): PromiseLike<TResult1> {
    return this.asyncResult.then(onfulfilled);
  }

  static ok<T extends Val>(val: T): AsyncResult<T, never> {
    return new AsyncResult(Promise.resolve(Result.ok(val)));
  }

  static err<E extends Val>(err: NonNullable<E>): AsyncResult<never, E> {
    // eslint-disable-next-line promise/no-promise-in-callback
    return new AsyncResult(Promise.resolve(Result.err(err)));
  }

  static wrap<
    T extends Val,
    E extends Val = Error,
    EE extends Val = never,
    Input = unknown,
  >(
    promise:
      | Promise<SafeParseReturnType<Input, T>>
      | Promise<Result<T, EE>>
      | Promise<RawValue<T>>,
    onErr?: (err: NonNullable<E>) => Result<T, E>,
  ): AsyncResult<T, E | EE> {
    return new AsyncResult(
      promise
        .then((value) => {
          if (value instanceof Result) {
            return value;
          }

          if (isZodResult<Input, T>(value)) {
            return fromZodResult(value);
          }

          return Result.ok(value);
        })
        .catch((err) => {
          if (onErr) {
            return onErr(err);
          }
          return Result.err(err);
        }),
    );
  }

  static wrapNullable<
    T extends Val,
    E extends Val,
    ErrForNull extends Val,
    ErrForUndefined extends Val,
  >(
    promise: Promise<Nullable<T>>,
    errForNull: NonNullable<ErrForNull>,
    errForUndefined: NonNullable<ErrForUndefined>,
  ): AsyncResult<T, E | ErrForNull | ErrForUndefined> {
    return new AsyncResult(
      promise
        .then((value) => fromNullable(value, errForNull, errForUndefined))
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
   *   const val = await Result.wrap(readFile('foo.txt')).unwrapOrElse('bar');
   *   expect(val).toBe('bar');
   *   expect(err).toBeUndefined();
   *
   *   ```
   */
  unwrapOrElse(fallback: T): Promise<T> {
    return this.asyncResult.then<T>((res) => res.unwrapOrElse(fallback));
  }

  /**
   * Returns the ok-value or throw the error.
   */
  async unwrapOrThrow(): Promise<T> {
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
   * Zod `.safeParse()` results are converted automatically.
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
  transform<U extends Val, Input = unknown>(
    fn: (value: T) => SafeParseReturnType<Input, NonNullable<U>>,
  ): AsyncResult<U, E | ZodError<Input>>;
  transform<U extends Val, Input = unknown>(
    fn: (value: T) => Promise<SafeParseReturnType<Input, NonNullable<U>>>,
  ): AsyncResult<U, E | ZodError<Input>>;
  transform<U extends Val, EE extends Val>(
    fn: (value: T) => Promise<Result<U, E | EE>>,
  ): AsyncResult<U, E | EE>;
  transform<U extends Val>(
    fn: (value: T) => Promise<RawValue<U>>,
  ): AsyncResult<U, E>;
  transform<U extends Val>(fn: (value: T) => RawValue<U>): AsyncResult<U, E>;
  transform<U extends Val, EE extends Val, Input = unknown>(
    fn: (
      value: T,
    ) =>
      | Result<U, E | EE>
      | AsyncResult<U, E | EE>
      | SafeParseReturnType<Input, NonNullable<U>>
      | Promise<SafeParseReturnType<Input, NonNullable<U>>>
      | Promise<Result<U, E | EE>>
      | Promise<RawValue<U>>
      | RawValue<U>,
  ): AsyncResult<U, E | EE | ZodError<Input>> {
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

            if (isZodResult<Input, U>(result)) {
              return fromZodResult(result);
            }

            if (result instanceof Promise) {
              return AsyncResult.wrap(result, (err) => {
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
    fn: (err: NonNullable<E>) => Result<U, E | EE>,
  ): AsyncResult<T | U, E | EE>;
  catch<U extends Val = T, EE extends Val = E>(
    fn: (err: NonNullable<E>) => AsyncResult<U, E | EE>,
  ): AsyncResult<T | U, E | EE>;
  catch<U extends Val = T, EE extends Val = E>(
    fn: (err: NonNullable<E>) => Promise<Result<U, E | EE>>,
  ): AsyncResult<T | U, E | EE>;
  catch<U extends Val = T, EE extends Val = E>(
    fn: (
      err: NonNullable<E>,
    ) =>
      | Result<U, E | EE>
      | AsyncResult<U, E | EE>
      | Promise<Result<U, E | EE>>,
  ): AsyncResult<T | U, E | EE> {
    const caughtAsyncResult = this.asyncResult.then((result) =>
      // eslint-disable-next-line promise/no-nesting
      result.catch(fn as never),
    );
    return AsyncResult.wrap(caughtAsyncResult);
  }

  /**
   * Given a `schema`, returns a `Result` with `val` being the parsed value.
   * Additionally, `null` and `undefined` values are converted into Zod error.
   */
  parse<T, Schema extends ZodType<T, ZodTypeDef, Input>, Input = unknown>(
    schema: Schema,
  ): AsyncResult<NonNullable<z.infer<Schema>>, E | ZodError<Input>> {
    return new AsyncResult(
      this.asyncResult
        .then((oldResult) => oldResult.parse(schema))
        .catch(
          /* istanbul ignore next: should never happen */
          (err) => Result._uncaught(err),
        ),
    );
  }

  onValue(fn: (value: T) => void): AsyncResult<T, E> {
    return new AsyncResult(
      this.asyncResult
        .then((result) => result.onValue(fn))
        .catch(
          /* istanbul ignore next: should never happen */
          (err) => Result._uncaught(err),
        ),
    );
  }

  onError(fn: (err: E) => void): AsyncResult<T, E> {
    return new AsyncResult(
      this.asyncResult
        .then((result) => result.onError(fn))
        .catch(
          /* istanbul ignore next: should never happen */
          (err) => Result._uncaught(err),
        ),
    );
  }
}
