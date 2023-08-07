import { ZodError, z } from 'zod';
import { logger } from '../../test/util';
import { AsyncResult, Result } from './result';

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
      it('wraps callback', () => {
        const res = Result.wrap(() => 42);
        expect(res).toEqual(Result.ok(42));
      });

      it('handles callback error', () => {
        const res = Result.wrap(() => {
          throw 'oops';
        });
        expect(res).toEqual(Result.err('oops'));
      });

      it('wraps nullable callback', () => {
        const res: Result<number, 'oops'> = Result.wrapNullable(
          (): number | null => 42,
          'oops'
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

      it('distincts between null and undefined callback results', () => {
        expect(Result.wrapNullable(() => null, 'null', 'undefined')).toEqual(
          Result.err('null')
        );
        expect(
          Result.wrapNullable(() => undefined, 'null', 'undefined')
        ).toEqual(Result.err('undefined'));
      });

      it('handles nullable callback error', () => {
        const res = Result.wrapNullable(() => {
          throw 'oops';
        }, 'nullable');
        expect(res).toEqual(Result.err('oops'));
      });

      it('wraps zod parse result', () => {
        const schema = z.string().transform((x) => x.toUpperCase());
        expect(Result.wrap(schema.safeParse('foo'))).toEqual(Result.ok('FOO'));
        expect(Result.wrap(schema.safeParse(42))).toMatchObject(
          Result.err({
            issues: [
              { code: 'invalid_type', expected: 'string', received: 'number' },
            ],
          })
        );
      });

      it('wraps Zod schema', () => {
        const schema = z.string().transform((x) => x.toUpperCase());
        const parse = Result.wrapSchema(schema);
        expect(parse('foo')).toEqual(Result.ok('FOO'));
        expect(parse(42)).toMatchObject(Result.err(expect.any(ZodError)));
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
        expect(res.unwrap(-1)).toBe(42);
      });

      it('uses fallback for error value', () => {
        const res: Result<number, string> = Result.err('oops');
        expect(res.unwrap(42)).toBe(42);
      });

      it('throws error uncaught in the failed transform', () => {
        const res = Result.ok(42);
        expect(() =>
          res
            .transform(() => {
              throw 'oops';
            })
            .unwrap()
        ).toThrow('oops');
      });

      it('returns ok-value for unwrapOrThrow', () => {
        const res = Result.ok(42);
        expect(res.unwrapOrThrow()).toBe(42);
      });

      it('throws error for unwrapOrThrow on error result', () => {
        const res = Result.err('oops');
        expect(() => res.unwrapOrThrow()).toThrow('oops');
      });
    });

    describe('Transforming', () => {
      it('transforms value to value', () => {
        const res = Result.ok('foo').transform((x) => x.toUpperCase());
        expect(res).toEqual(Result.ok('FOO'));
      });

      it('transforms value to Result', () => {
        const res = Result.ok('foo').transform((x) =>
          Result.ok(x.toUpperCase())
        );
        expect(res).toEqual(Result.ok('FOO'));
      });

      it('skips transform for error Result', () => {
        const res: Result<number, string> = Result.err('oops');
        const fn = jest.fn((x: number) => x + 1);
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
          'Result: unhandled transform error'
        );
      });

      it('automatically converts zod values', () => {
        const schema = z.string().transform((x) => x.toUpperCase());
        const res = Result.ok('foo').transform((x) => schema.safeParse(x));
        expect(res).toEqual(Result.ok('FOO'));
      });
    });

    describe('Catch', () => {
      it('bypasses ok result', () => {
        const res = Result.ok(42);
        expect(res.catch(() => Result.ok(0))).toEqual(Result.ok(42));
        expect(res.catch(() => Result.ok(0))).toBe(res);
      });

      it('bypasses uncaught transform errors', () => {
        const res = Result.ok(42).transform(() => {
          throw 'oops';
        });
        expect(res.catch(() => Result.ok(0))).toEqual(Result._uncaught('oops'));
        expect(res.catch(() => Result.ok(0))).toBe(res);
      });

      it('converts error to Result', () => {
        const result = Result.err<string>('oops').catch(() =>
          Result.ok<number>(42)
        );
        expect(result).toEqual(Result.ok(42));
      });

      it('handles error thrown in catch function', () => {
        const result = Result.err<string>('oops').catch(() => {
          throw 'oops';
        });
        expect(result).toEqual(Result._uncaught('oops'));
      });
    });
  });

  describe('AsyncResult', () => {
    describe('Wrapping', () => {
      it('wraps promise', async () => {
        const res: AsyncResult<number, string> = Result.wrap(
          Promise.resolve(42)
        );
        await expect(res).resolves.toEqual(Result.ok(42));
      });

      it('wraps Result promise', async () => {
        const res: AsyncResult<number, string> = Result.wrap(
          Promise.resolve(Result.ok(42))
        );
        await expect(res).resolves.toEqual(Result.ok(42));
      });

      it('handles rejected promise', async () => {
        const res: AsyncResult<number, string> = Result.wrap(
          Promise.reject('oops')
        );
        await expect(res).resolves.toEqual(Result.err('oops'));
      });

      it('wraps nullable promise', async () => {
        const res: AsyncResult<number, 'oops'> = Result.wrapNullable(
          Promise.resolve<number | null>(42),
          'oops'
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

      it('distincts between null and undefined promise results', async () => {
        await expect(
          Result.wrapNullable(Promise.resolve(null), 'null', 'undefined')
        ).resolves.toEqual(Result.err('null'));

        await expect(
          Result.wrapNullable(Promise.resolve(undefined), 'null', 'undefined')
        ).resolves.toEqual(Result.err('undefined'));
      });

      it('handles rejected nullable promise', async () => {
        const res = Result.wrapNullable(Promise.reject('oops'), 'nullable');
        await expect(res).resolves.toEqual(Result.err('oops'));
      });

      it('wraps Zod async schema', async () => {
        const schema = z
          .string()
          .transform((x) => Promise.resolve(x.toUpperCase()));
        const parse = Result.wrapSchemaAsync(schema);
        await expect(parse('foo')).resolves.toEqual(Result.ok('FOO'));
        await expect(parse(42)).resolves.toMatchObject(
          Result.err(expect.any(ZodError))
        );
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
        await expect(res.unwrap(0)).resolves.toBe(42);
      });

      it('uses fallback for error AsyncResult', async () => {
        const res = Result.wrap(Promise.reject('oops'));
        await expect(res.unwrap(42)).resolves.toBe(42);
      });

      it('returns ok-value for unwrapOrThrow', async () => {
        const res = Result.wrap(Promise.resolve(42));
        await expect(res.unwrapOrThrow()).resolves.toBe(42);
      });

      it('rejects for error for unwrapOrThrow', async () => {
        const res = Result.wrap(Promise.reject('oops'));
        await expect(res.unwrapOrThrow()).rejects.toBe('oops');
      });
    });

    describe('Transforming', () => {
      it('transforms AsyncResult to pure value', async () => {
        const res = await AsyncResult.ok('foo').transform((x) =>
          x.toUpperCase()
        );
        expect(res).toEqual(Result.ok('FOO'));
      });

      it('transforms AsyncResult to Result', async () => {
        const res = await AsyncResult.ok('foo').transform((x) =>
          Result.ok(x.toUpperCase())
        );
        expect(res).toEqual(Result.ok('FOO'));
      });

      it('transforms Result to AsyncResult', async () => {
        const res = await Result.ok('foo').transform((x) =>
          AsyncResult.ok(x.toUpperCase())
        );
        expect(res).toEqual(Result.ok('FOO'));
      });

      it('transforms AsyncResult to AsyncResult', async () => {
        const res = await AsyncResult.ok('foo').transform((x) =>
          AsyncResult.ok(x.toUpperCase())
        );
        expect(res).toEqual(Result.ok('FOO'));
      });

      it('skips transform for failed promises', async () => {
        const res = AsyncResult.err('oops');
        const fn = jest.fn((x: number) => x + 1);
        await expect(res.transform(fn)).resolves.toEqual(Result.err('oops'));
        expect(fn).not.toHaveBeenCalled();
      });

      it('asyncronously transforms successfull promise to value', async () => {
        const res = await AsyncResult.ok('foo').transform((x) =>
          Promise.resolve(x.toUpperCase())
        );
        expect(res).toEqual(Result.ok('FOO'));
      });

      it('asynchronously transforms successful AsyncResult to Result', async () => {
        const res = await AsyncResult.ok('foo').transform((x) =>
          Promise.resolve(Result.ok(x.toUpperCase()))
        );
        expect(res).toEqual(Result.ok('FOO'));
      });

      it('asynchronously transforms value to value', async () => {
        const res = await Result.ok('foo').transform((x) =>
          Promise.resolve(x.toUpperCase())
        );
        expect(res).toEqual(Result.ok('FOO'));
      });

      it('asynchronously transforms value to Result', async () => {
        const res = await Result.ok('foo').transform((x) =>
          Promise.resolve(Result.ok(x.toUpperCase()))
        );
        expect(res).toEqual(Result.ok('FOO'));
      });

      it('skips async transform for error Result', async () => {
        const input: Result<number, string> = Result.err('oops');
        const fn = jest.fn((x: number) => Promise.resolve(x + 1));
        const res = await input.transform(fn);
        expect(res).toEqual(Result.err('oops'));
        expect(fn).not.toHaveBeenCalled();
      });

      it('skips async transform for rejected promise', async () => {
        const res: AsyncResult<number, string> = AsyncResult.err('oops');
        const fn = jest.fn((x: number) => Promise.resolve(x + 1));
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
          res.transform((_) => Promise.reject('oops'))
        ).resolves.toEqual(Result._uncaught('oops'));
        expect(logger.logger.warn).toHaveBeenCalledWith(
          { err: 'oops' },
          'Result: unhandled async transform error'
        );
      });

      it('handles error thrown on promise transform', async () => {
        const res = AsyncResult.ok('foo');
        await expect(
          res.transform(() => {
            throw 'bar';
          })
        ).resolves.toEqual(Result._uncaught('bar'));
        expect(logger.logger.warn).toHaveBeenCalledWith(
          { err: 'bar' },
          'AsyncResult: unhandled transform error'
        );
      });

      it('handles error thrown on promise async transform', async () => {
        const res = AsyncResult.ok('foo');
        await expect(
          res.transform(() => Promise.reject('bar'))
        ).resolves.toEqual(Result._uncaught('bar'));
        expect(logger.logger.warn).toHaveBeenCalledWith(
          { err: 'bar' },
          'AsyncResult: unhandled async transform error'
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

      it('asynchronously transforms Result to zod values', async () => {
        const schema = z.string().transform((x) => x.toUpperCase());
        const res = await Result.ok('foo').transform((x) =>
          Promise.resolve(schema.safeParse(x))
        );
        expect(res).toEqual(Result.ok('FOO'));
      });

      it('transforms AsyncResult to zod values', async () => {
        const schema = z.string().transform((x) => x.toUpperCase());
        const res = await AsyncResult.ok('foo').transform((x) =>
          schema.safeParse(x)
        );
        expect(res).toEqual(Result.ok('FOO'));
      });
    });

    describe('Catch', () => {
      it('converts error to AsyncResult', async () => {
        const result = await Result.err<string>('oops').catch(() =>
          AsyncResult.ok(42)
        );
        expect(result).toEqual(Result.ok(42));
      });

      it('converts error to Promise', async () => {
        const fallback = Promise.resolve(Result.ok(42));
        const result = await Result.err<string>('oops').catch(() => fallback);
        expect(result).toEqual(Result.ok(42));
      });

      it('handles error thrown in Promise result', async () => {
        const fallback = Promise.reject('oops');
        const result = await Result.err<string>('oops').catch(() => fallback);
        expect(result).toEqual(Result._uncaught('oops'));
      });

      it('converts AsyncResult error to Result', async () => {
        const result = await AsyncResult.err<string>('oops').catch(() =>
          AsyncResult.ok<number>(42)
        );
        expect(result).toEqual(Result.ok(42));
      });
    });
  });
});
