/* oxlint-disable typescript/prefer-promise-reject-errors */
/* oxlint-disable typescript/only-throw-error */
// TODO: fix, should only allow `Error` type

import { z } from 'zod/v4';
import { logger } from '~test/util.ts';
import { AsyncResult, Result, type SafeParser } from './result.ts';

function assertTypes(): void {
  // @ts-expect-error - schemas with nullable output are rejected
  Result.parse('foo', z.string().nullable());
  // @ts-expect-error - raw safeParse results must go through .parse()
  Result.ok('foo').transform((x) => z.string().safeParse(x));
  // @ts-expect-error - unwrapOrThrow requires an Error-typed channel
  Result.err('oops' as const).unwrapOrThrow();
}
void assertTypes;

describe('util/result', () => {
  describe('Result', () => {
    describe('constructors', () => {
      it('ok result', () => {
        const res = Result.ok(42);
        expect(res).toEqual({
          res: {
            ok: true,
            val: 42,
          },
        });
      });

      it('error result', () => {
        const res = Result.err('oops');
        expect(res).toEqual({
          res: {
            ok: false,
            err: 'oops',
          },
        });
      });
    });

    describe('Wrapping', () => {
      it('wraps callback returning value', () => {
        const res = Result.wrap(() => 42);
        expect(res).toEqual(Result.ok(42));
      });

      it('handles throw in callback', () => {
        const res = Result.wrap(() => {
          throw 'oops';
        });
        expect(res).toEqual(Result.err('oops'));
      });

      it('wraps callback returning promise', () => {
        const res = Result.wrap(() => Promise.resolve(42));
        expect(res).toEqual(AsyncResult.ok(42));
      });

      it('wraps callback returning failed promise', () => {
        const err = new Error('unknown');
        const res = Result.wrap(() => Promise.reject(err));
        expect(res).toEqual(AsyncResult.err(err));
      });

      it('wraps nullable callback', () => {
        const res: Result<number, 'oops'> = Result.wrapNullable(
          (): number | null => 42,
          'oops',
        );
        expect(res).toEqual(Result.ok(42));
      });

      it('wraps nullable callback null', () => {
        const res = Result.wrapNullable(() => null, 'oops');
        expect(res).toEqual(Result.err('oops'));
      });

      it('wraps nullable callback undefined', () => {
        const res = Result.wrapNullable(() => undefined, 'oops');
        expect(res).toEqual(Result.err('oops'));
      });

      it('handles nullable callback error', () => {
        const res = Result.wrapNullable(() => {
          throw 'oops';
        }, 'nullable');
        expect(res).toEqual(Result.err('oops'));
      });

      it('wraps pure nullable value', () => {
        const res = Result.wrapNullable(42, 'oops');
        expect(res).toEqual(Result.ok(42));
      });

      it('wraps nullable value null', () => {
        const res = Result.wrapNullable(null, 'oops');
        expect(res).toEqual(Result.err('oops'));
      });

      it('wraps nullable value undefined', () => {
        const res = Result.wrapNullable(undefined, 'oops');
        expect(res).toEqual(Result.err('oops'));
      });
    });

    describe('Unwrapping', () => {
      it('unwraps successful value', () => {
        const res = Result.ok(42);
        expect(res.unwrap()).toEqual({
          ok: true,
          val: 42,
        });
      });

      it('unwraps error value', () => {
        const res = Result.err('oops');
        expect(res.unwrap()).toEqual({
          ok: false,
          err: 'oops',
        });
      });

      it('skips fallback for successful value', () => {
        const res: Result<number> = Result.ok(42);
        expect(res.unwrapOr(-1)).toBe(42);
      });

      it('uses fallback for error value', () => {
        const res: Result<number, string> = Result.err('oops');
        expect(res.unwrapOr(42)).toBe(42);
      });

      it('unwrapOr throws uncaught transform error', () => {
        const res = Result.ok(42);
        expect(() =>
          res
            .transform(() => {
              throw 'oops';
            })
            .unwrapOr(0),
        ).toThrow('oops');
      });

      it('unwrap throws uncaught transform error', () => {
        const res = Result.ok(42);
        expect(() =>
          res
            .transform(() => {
              throw 'oops';
            })
            .unwrap(),
        ).toThrow('oops');
      });

      it('returns ok-value for unwrapOrThrow', () => {
        const res = Result.ok(42);
        expect(res.unwrapOrThrow()).toBe(42);
      });

      it('throws error for unwrapOrThrow on error result', () => {
        const error = new Error('oops');
        const res = Result.err(error);
        expect(() => res.unwrapOrThrow()).toThrow(error);
      });

      it('unwrapOrNull returns value for ok-result', () => {
        const res = Result.ok(42);
        expect(res.unwrapOrNull()).toBe(42);
      });

      it('unwrapOrNull returns null for error result', () => {
        const res = Result.err('oops');
        expect(res.unwrapOrNull()).toBeNull();
      });

      it('unwrapOrNull throws uncaught transform error', () => {
        const res = Result.ok(42);
        expect(() =>
          res
            .transform(() => {
              throw 'oops';
            })
            .unwrapOrNull(),
        ).toThrow('oops');
      });
    });

    describe('Transforming', () => {
      it('transforms value to value', () => {
        const res = Result.ok('foo').transform((x) => x.toUpperCase());
        expect(res).toEqual(Result.ok('FOO'));
      });

      it('transforms value to Result', () => {
        const res = Result.ok('foo').transform((x) =>
          Result.ok(x.toUpperCase()),
        );
        expect(res).toEqual(Result.ok('FOO'));
      });

      it('skips transform for error Result', () => {
        const res: Result<number, string> = Result.err('oops');
        const fn = vi.fn((x: number) => x + 1);
        expect(res.transform(fn)).toEqual(Result.err('oops'));
        expect(fn).not.toHaveBeenCalled();
      });

      it('logs and returns error on transform failure', () => {
        const res = Result.ok('foo').transform(() => {
          throw 'oops';
        });
        expect(res).toEqual(Result._uncaught('oops'));

        expect(logger.logger.warn).toHaveBeenCalledWith(
          { err: 'oops' },
          'Result: unhandled transform error',
        );
      });

      it('preserves uncaught errors through chained transforms', () => {
        const error = new Error('oops');
        const handler = vi.fn(() => Result.ok(0));
        const result = Result.ok(42)
          .transform((): number => {
            throw error;
          })
          .transform((value) => value + 1)
          .catch(handler);

        let thrown: unknown;
        try {
          result.unwrap();
        } catch (err) {
          thrown = err;
        }

        expect(thrown).toBe(error);
        expect(handler).not.toHaveBeenCalled();
      });

      it('parses values explicitly in transform chains', () => {
        const schema = z.string().transform((x) => x.toUpperCase());
        const res = Result.ok('foo').parse(schema);
        expect(res).toEqual(Result.ok('FOO'));
      });
    });

    describe('Catch', () => {
      it('bypasses ok result', () => {
        const res = Result.ok(42);
        expect(res.catch(() => Result.ok(0))).toEqual(Result.ok(42));
      });

      it('bypasses uncaught transform errors', () => {
        const res = Result.ok(42).transform(() => {
          throw 'oops';
        });
        expect(res.catch(() => Result.ok(0))).toEqual(Result._uncaught('oops'));
      });

      it('converts error to Result', () => {
        const error: Result<number, string> = Result.err<string>('oops');
        const result = error.catch((_err) => Result.ok<number>(42));
        expect(result).toEqual(Result.ok(42));
      });

      it('handles error thrown in catch function', () => {
        const result = Result.err<string>('oops').catch(() => {
          throw 'oops';
        });
        expect(result).toEqual(Result._uncaught('oops'));
      });
    });

    describe('Parsing', () => {
      const schema = z.string().transform((x) => x.toUpperCase());

      it('parses a schema', () => {
        expect(Result.parse('foo', schema)).toEqual(Result.ok('FOO'));

        expect(Result.parse(42, schema).unwrap()).toMatchObject({
          err: expect.objectContaining({
            issues: expect.arrayContaining([
              expect.objectContaining({
                message: 'Invalid input: expected string, received number',
              }),
            ]),
          }),
        });
      });

      it('supports non-Zod parsers', () => {
        const evenParser: SafeParser<number, 'odd'> = {
          safeParse: (input) =>
            typeof input === 'number' && input % 2 === 0
              ? { success: true, data: input }
              : { success: false, error: 'odd' },
        };

        expect(Result.parse(2, evenParser)).toEqual(Result.ok(2));
        expect(Result.parse(3, evenParser)).toEqual(Result.err('odd'));
      });

      it('routes nullish output from a lying parser to the uncaught channel', () => {
        const lyingParser: SafeParser<string, Error> = {
          safeParse: () => ({ success: true, data: null as never }),
        };

        const result = Result.parse('foo', lyingParser);

        expect(() => result.unwrap()).toThrow(
          new TypeError('Result.parse: schema output must not be nullish'),
        );
        expect(logger.logger.warn).toHaveBeenCalledWith(
          { err: expect.any(TypeError) },
          'Result: nullish schema output',
        );
      });

      it('parses a schema by piping from Result', () => {
        expect(Result.ok('foo').parse(schema)).toEqual(Result.ok('FOO'));

        expect(Result.ok(42).parse(schema).unwrap()).toMatchObject({
          err: expect.objectContaining({
            issues: expect.arrayContaining([
              expect.objectContaining({
                message: 'Invalid input: expected string, received number',
              }),
            ]),
          }),
        });

        expect(Result.err('oops').parse(schema)).toEqual(Result.err('oops'));
      });
    });

    describe('Handlers', () => {
      it('supports value handlers', () => {
        const cb = vi.fn();
        Result.ok(42).onValue(cb);
        expect(cb).toHaveBeenCalledExactlyOnceWith(42);
      });

      it('supports error handlers', () => {
        const cb = vi.fn();
        Result.err('oops').onError(cb);
        expect(cb).toHaveBeenCalledExactlyOnceWith('oops');
      });

      it('skips value handlers for errors', () => {
        const cb = vi.fn();
        Result.err('oops').onValue(cb);
        expect(cb).not.toHaveBeenCalled();
      });

      it('skips error handlers for values', () => {
        const cb = vi.fn();
        Result.ok(42).onError(cb);
        expect(cb).not.toHaveBeenCalled();
      });

      it('handles error thrown in value handler', () => {
        const res = Result.ok(42).onValue(() => {
          throw 'oops';
        });

        expect(res).toEqual(Result._uncaught('oops'));
        expect(logger.logger.warn).toHaveBeenCalledWith(
          { err: 'oops' },
          'Result: unexpected error in onValue callback',
        );
      });

      it('handles error thrown in error handler', () => {
        const res = Result.err('oops').onError(() => {
          throw 'oops';
        });

        expect(res).toEqual(Result._uncaught('oops'));
        expect(logger.logger.warn).toHaveBeenCalledWith(
          { err: 'oops' },
          'Result: unexpected error in onError callback',
        );
      });
    });
  });

  describe('AsyncResult', () => {
    describe('Wrapping', () => {
      it('wraps promise', async () => {
        const res: AsyncResult<number, string> = Result.wrap(
          Promise.resolve(42),
        );
        await expect(res).resolves.toEqual(Result.ok(42));
      });

      it('wraps Result promise', async () => {
        const res: AsyncResult<number, string> = Result.wrap(
          Promise.resolve(Result.ok(42)),
        );
        await expect(res).resolves.toEqual(Result.ok(42));
      });

      it('handles rejected promise', async () => {
        const res: AsyncResult<number, string> = Result.wrap(
          Promise.reject('oops'),
        );
        await expect(res).resolves.toEqual(Result.err('oops'));
      });

      it('wraps nullable promise', async () => {
        const res: AsyncResult<number, 'oops'> = Result.wrapNullable(
          Promise.resolve<number | null>(42),
          'oops',
        );
        await expect(res).resolves.toEqual(Result.ok(42));
      });

      it('wraps promise returning null', async () => {
        const res = Result.wrapNullable(Promise.resolve(null), 'oops');
        await expect(res).resolves.toEqual(Result.err('oops'));
      });

      it('wraps promise returning undefined', async () => {
        const res = Result.wrapNullable(Promise.resolve(undefined), 'oops');
        await expect(res).resolves.toEqual(Result.err('oops'));
      });

      it('handles rejected nullable promise', async () => {
        const res = Result.wrapNullable(Promise.reject('oops'), 'nullable');
        await expect(res).resolves.toEqual(Result.err('oops'));
      });
    });

    describe('Unwrapping', () => {
      it('unwraps successful AsyncResult', async () => {
        const res = Result.wrap(Promise.resolve(42));
        await expect(res.unwrap()).resolves.toEqual({
          ok: true,
          val: 42,
        });
      });

      it('unwraps error AsyncResult', async () => {
        const res = Result.wrap(Promise.reject('oops'));
        await expect(res.unwrap()).resolves.toEqual({
          ok: false,
          err: 'oops',
        });
      });

      it('skips fallback for successful AsyncResult', async () => {
        const res = Result.wrap(Promise.resolve(42));
        await expect(res.unwrapOr(0)).resolves.toBe(42);
      });

      it('uses fallback for error AsyncResult', async () => {
        const res = Result.wrap(Promise.reject('oops'));
        await expect(res.unwrapOr(42)).resolves.toBe(42);
      });

      it('returns ok-value for unwrapOrThrow', async () => {
        const res = Result.wrap(Promise.resolve(42));
        await expect(res.unwrapOrThrow()).resolves.toBe(42);
      });

      it('rejects for error for unwrapOrThrow', async () => {
        const res = Result.wrap(Promise.reject('oops'));
        await expect(res.unwrapOrThrow()).rejects.toBe('oops');
      });

      it('unwrapOrNull returns value for ok-result', async () => {
        const res = AsyncResult.ok(42);
        await expect(res.unwrapOrNull()).resolves.toBe(42);
      });

      it('unwrapOrNull returns null for error result', async () => {
        const res = AsyncResult.err('oops');
        await expect(res.unwrapOrNull()).resolves.toBeNull();
      });
    });

    describe('Transforming', () => {
      it('transforms AsyncResult to pure value', async () => {
        const res = await AsyncResult.ok('foo').transform((x) =>
          x.toUpperCase(),
        );
        expect(res).toEqual(Result.ok('FOO'));
      });

      it('transforms AsyncResult to Result', async () => {
        const res = await AsyncResult.ok('foo').transform((x) =>
          Result.ok(x.toUpperCase()),
        );
        expect(res).toEqual(Result.ok('FOO'));
      });

      it('transforms Result to AsyncResult', async () => {
        const res = await Result.ok('foo').transform((x) =>
          AsyncResult.ok(x.toUpperCase()),
        );
        expect(res).toEqual(Result.ok('FOO'));
      });

      it('transforms AsyncResult to AsyncResult', async () => {
        const res = await AsyncResult.ok('foo').transform((x) =>
          AsyncResult.ok(x.toUpperCase()),
        );
        expect(res).toEqual(Result.ok('FOO'));
      });

      it('skips transform for failed promises', async () => {
        const res = AsyncResult.err('oops');
        const fn = vi.fn((x: number) => x + 1);
        await expect(res.transform(fn)).resolves.toEqual(Result.err('oops'));
        expect(fn).not.toHaveBeenCalled();
      });

      it('asyncronously transforms successfull promise to value', async () => {
        const res = await AsyncResult.ok('foo').transform((x) =>
          Promise.resolve(x.toUpperCase()),
        );
        expect(res).toEqual(Result.ok('FOO'));
      });

      it('asynchronously transforms successful AsyncResult to Result', async () => {
        const res = await AsyncResult.ok('foo').transform((x) =>
          Promise.resolve(Result.ok(x.toUpperCase())),
        );
        expect(res).toEqual(Result.ok('FOO'));
      });

      it('asynchronously transforms value to value', async () => {
        const res = await Result.ok('foo').transform((x) =>
          Promise.resolve(x.toUpperCase()),
        );
        expect(res).toEqual(Result.ok('FOO'));
      });

      it('asynchronously transforms value to Result', async () => {
        const res = await Result.ok('foo').transform((x) =>
          Promise.resolve(Result.ok(x.toUpperCase())),
        );
        expect(res).toEqual(Result.ok('FOO'));
      });

      it('skips async transform for error Result', async () => {
        const input: Result<number, string> = Result.err('oops');
        const fn = vi.fn((x: number) => Promise.resolve(x + 1));
        const res = await input.transform(fn);
        expect(res).toEqual(Result.err('oops'));
        expect(fn).not.toHaveBeenCalled();
      });

      it('skips async transform for rejected promise', async () => {
        const res: AsyncResult<number, string> = AsyncResult.err('oops');
        const fn = vi.fn((x: number) => Promise.resolve(x + 1));
        await expect(res.transform(fn)).resolves.toEqual(Result.err('oops'));
        expect(fn).not.toHaveBeenCalled();
      });

      it('re-wraps error thrown via unwrapping in async transform', async () => {
        const res = await AsyncResult.ok(42)
          .transform(async (): Promise<number> => {
            await Promise.resolve();
            throw 'oops';
          })
          .transform((x) => x + 1);
        expect(res).toEqual(Result._uncaught('oops'));
      });

      it('handles error thrown on Result async transform', async () => {
        const res = Result.ok('foo');
        await expect(
          res.transform((_) => Promise.reject('oops')),
        ).resolves.toEqual(Result._uncaught('oops'));

        expect(logger.logger.warn).toHaveBeenCalledWith(
          { err: 'oops' },
          'Result: unhandled async transform error',
        );
      });

      it('handles error thrown on promise transform', async () => {
        const res = AsyncResult.ok('foo');
        await expect(
          res.transform(() => {
            throw 'bar';
          }),
        ).resolves.toEqual(Result._uncaught('bar'));

        expect(logger.logger.warn).toHaveBeenCalledWith(
          { err: 'bar' },
          'AsyncResult: unhandled transform error',
        );
      });

      it('handles error thrown on promise async transform', async () => {
        const res = AsyncResult.ok('foo');
        await expect(
          res.transform(() => Promise.reject('bar')),
        ).resolves.toEqual(Result._uncaught('bar'));

        expect(logger.logger.warn).toHaveBeenCalledWith(
          { err: 'bar' },
          'AsyncResult: unhandled async transform error',
        );
      });

      it('accumulates error types into union type during chained transform', async () => {
        const fn1 = (x: string): Result<string, string> =>
          Result.ok(x.toUpperCase());

        const fn2 = (x: string): Result<string[], number> =>
          Result.ok(x.split(''));

        const fn3 = (x: string[]): Result<string, boolean> =>
          Result.ok(x.join('-'));

        type Res = Result<string, string | number | boolean>;
        const res: Res = await AsyncResult.ok('foo')
          .transform(fn1)
          .transform(fn2)
          .transform(fn3);

        expect(res).toEqual(Result.ok('F-O-O'));
      });

      it('asynchronously transforms Result before parsing', async () => {
        const schema = z.string().transform((x) => x.toUpperCase());
        const res = await Result.ok('foo')
          .transform((x) => Promise.resolve(x))
          .parse(schema);
        expect(res).toEqual(Result.ok('FOO'));
      });

      it('transforms AsyncResult before parsing', async () => {
        const schema = z.string().transform((x) => x.toUpperCase());
        const res = await AsyncResult.ok('foo').parse(schema);
        expect(res).toEqual(Result.ok('FOO'));
      });
    });

    describe('Catch', () => {
      it('converts error to AsyncResult', async () => {
        const error: Result<number, string> = Result.err<string>('oops');
        const result = await error.catch(() => AsyncResult.ok(42));
        expect(result).toEqual(Result.ok(42));
      });

      it('converts error to Promise', async () => {
        const fallback = Promise.resolve(Result.ok(42));
        const error: Result<number, string> = Result.err<string>('oops');
        const result = await error.catch(() => fallback);
        expect(result).toEqual(Result.ok(42));
      });

      it('handles error thrown in Promise result', async () => {
        const fallback = Promise.reject('oops');
        const result = await Result.err<string>('oops').catch(() => fallback);
        expect(result).toEqual(Result._uncaught('oops'));
      });

      it('converts AsyncResult error to Result', async () => {
        const error: AsyncResult<number, string> =
          AsyncResult.err<string>('oops');
        const result = await error.catch(() => AsyncResult.ok<number>(42));
        expect(result).toEqual(Result.ok(42));
      });

      it('bypasses uncaught AsyncResult errors', async () => {
        const error = new Error('oops');
        const handler = vi.fn(() => AsyncResult.ok(0));
        const result = AsyncResult.ok(42)
          .transform(() => {
            throw error;
          })
          .catch(handler);

        await expect(result.unwrap()).rejects.toBe(error);
        expect(handler).not.toHaveBeenCalled();
      });
    });
  });

  describe('Parsing', () => {
    it('parses a schema by piping from AsyncResult', async () => {
      const schema = z.string().transform((x) => x.toUpperCase());

      expect(await AsyncResult.ok('foo').parse(schema)).toEqual(
        Result.ok('FOO'),
      );

      expect(await AsyncResult.ok(42).parse(schema).unwrap()).toMatchObject({
        err: expect.objectContaining({
          issues: expect.arrayContaining([
            expect.objectContaining({
              message: 'Invalid input: expected string, received number',
            }),
          ]),
        }),
      });
    });

    it('rejects when an async lying parser produces nullish output', async () => {
      const lyingParser: SafeParser<string, Error> = {
        safeParse: () => ({ success: true, data: undefined as never }),
      };

      await expect(
        AsyncResult.ok('foo').parse(lyingParser).unwrap(),
      ).rejects.toThrow('Result.parse: schema output must not be nullish');
    });

    it('handles uncaught error thrown in the steps before parsing', async () => {
      const res = await AsyncResult.ok(42)
        .transform(async (): Promise<number> => {
          await Promise.resolve();
          throw 'oops';
        })
        .parse(z.number().transform((x) => x + 1));
      expect(res).toEqual(Result._uncaught('oops'));
    });
  });

  describe('Handlers', () => {
    it('supports value handlers', async () => {
      const cb = vi.fn();
      await AsyncResult.ok(42).onValue(cb);
      expect(cb).toHaveBeenCalledExactlyOnceWith(42);
    });

    it('supports error handlers', async () => {
      const cb = vi.fn();
      await AsyncResult.err('oops').onError(cb);
      expect(cb).toHaveBeenCalledExactlyOnceWith('oops');
    });

    it('handles error thrown in value handler', async () => {
      const res = await AsyncResult.ok(42).onValue(() => {
        throw 'oops';
      });

      expect(res).toEqual(Result._uncaught('oops'));
      expect(logger.logger.warn).toHaveBeenCalledWith(
        { err: 'oops' },
        'Result: unexpected error in onValue callback',
      );
    });

    it('handles error thrown in error handler', async () => {
      const res = await AsyncResult.err('oops').onError(() => {
        throw 'oops';
      });

      expect(res).toEqual(Result._uncaught('oops'));
      expect(logger.logger.warn).toHaveBeenCalledWith(
        { err: 'oops' },
        'Result: unexpected error in onError callback',
      );
    });
  });
});
