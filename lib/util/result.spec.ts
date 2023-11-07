import { z } from 'zod';
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

      it('distincts between null and undefined callback results', () => {
        expect(Result.wrapNullable(() => null, 'null', 'undefined')).toEqual(
          Result.err('null'),
        );
        expect(
          Result.wrapNullable(() => undefined, 'null', 'undefined'),
        ).toEqual(Result.err('undefined'));
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

      it('wraps zod parse result', () => {
        const schema = z.string().transform((x) => x.toUpperCase());
        expect(Result.wrap(schema.safeParse('foo'))).toEqual(Result.ok('FOO'));
        expect(Result.wrap(schema.safeParse(42))).toMatchObject(
          Result.err({
            issues: [
              { code: 'invalid_type', expected: 'string', received: 'number' },
            ],
          }),
        );
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
        expect(res.unwrapOrElse(-1)).toBe(42);
      });

      it('uses fallback for error value', () => {
        const res: Result<number, string> = Result.err('oops');
        expect(res.unwrapOrElse(42)).toBe(42);
      });

      it('unwrapOrElse throws uncaught transform error', () => {
        const res = Result.ok(42);
        expect(() =>
          res
            .transform(() => {
              throw 'oops';
            })
            .unwrapOrElse(0),
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
        const res = Result.err('oops');
        expect(() => res.unwrapOrThrow()).toThrow('oops');
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
          'Result: unhandled transform error',
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
          Result.ok<number>(42),
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

    describe('Parsing', () => {
      it('parses Zod schema', () => {
        const schema = z
          .string()
          .transform((x) => x.toUpperCase())
          .nullish();

        expect(Result.parse('foo', schema)).toEqual(Result.ok('FOO'));

        expect(Result.parse(42, schema).unwrap()).toMatchObject({
          err: { issues: [{ message: 'Expected string, received number' }] },
        });

        expect(Result.parse(undefined, schema).unwrap()).toMatchObject({
          err: {
            issues: [
              {
                message: `Result can't accept nullish values, but input was parsed by Zod schema to undefined`,
              },
            ],
          },
        });

        expect(Result.parse(null, schema).unwrap()).toMatchObject({
          err: {
            issues: [
              {
                message: `Result can't accept nullish values, but input was parsed by Zod schema to null`,
              },
            ],
          },
        });
      });

      it('parses Zod schema by piping from Result', () => {
        const schema = z
          .string()
          .transform((x) => x.toUpperCase())
          .nullish();

        expect(Result.ok('foo').parse(schema)).toEqual(Result.ok('FOO'));

        expect(Result.ok(42).parse(schema).unwrap()).toMatchObject({
          err: { issues: [{ message: 'Expected string, received number' }] },
        });

        expect(Result.err('oops').parse(schema)).toEqual(Result.err('oops'));
      });
    });

    describe('Handlers', () => {
      it('supports value handlers', () => {
        const cb = jest.fn();
        Result.ok(42).onValue(cb);
        expect(cb).toHaveBeenCalledWith(42);
      });

      it('supports error handlers', () => {
        const cb = jest.fn();
        Result.err('oops').onError(cb);
        expect(cb).toHaveBeenCalledWith('oops');
      });

      it('handles error thrown in value handler', () => {
        const res = Result.ok(42).onValue(() => {
          throw 'oops';
        });
        expect(res).toEqual(Result._uncaught('oops'));
      });

      it('handles error thrown in error handler', () => {
        const res = Result.err('oops').onError(() => {
          throw 'oops';
        });
        expect(res).toEqual(Result._uncaught('oops'));
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

      it('distincts between null and undefined promise results', async () => {
        await expect(
          Result.wrapNullable(Promise.resolve(null), 'null', 'undefined'),
        ).resolves.toEqual(Result.err('null'));

        await expect(
          Result.wrapNullable(Promise.resolve(undefined), 'null', 'undefined'),
        ).resolves.toEqual(Result.err('undefined'));
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
        await expect(res.unwrapOrElse(0)).resolves.toBe(42);
      });

      it('uses fallback for error AsyncResult', async () => {
        const res = Result.wrap(Promise.reject('oops'));
        await expect(res.unwrapOrElse(42)).resolves.toBe(42);
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
        const fn = jest.fn((x: number) => x + 1);
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

      it('asynchronously transforms Result to zod values', async () => {
        const schema = z.string().transform((x) => x.toUpperCase());
        const res = await Result.ok('foo').transform((x) =>
          Promise.resolve(schema.safeParse(x)),
        );
        expect(res).toEqual(Result.ok('FOO'));
      });

      it('transforms AsyncResult to zod values', async () => {
        const schema = z.string().transform((x) => x.toUpperCase());
        const res = await AsyncResult.ok('foo').transform((x) =>
          schema.safeParse(x),
        );
        expect(res).toEqual(Result.ok('FOO'));
      });
    });

    describe('Catch', () => {
      it('converts error to AsyncResult', async () => {
        const result = await Result.err<string>('oops').catch(() =>
          AsyncResult.ok(42),
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
          AsyncResult.ok<number>(42),
        );
        expect(result).toEqual(Result.ok(42));
      });
    });
  });

  describe('Parsing', () => {
    it('parses Zod schema by piping from AsyncResult', async () => {
      const schema = z
        .string()
        .transform((x) => x.toUpperCase())
        .nullish();

      expect(await AsyncResult.ok('foo').parse(schema)).toEqual(
        Result.ok('FOO'),
      );

      expect(await AsyncResult.ok(42).parse(schema).unwrap()).toMatchObject({
        err: { issues: [{ message: 'Expected string, received number' }] },
      });
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
      const cb = jest.fn();
      await AsyncResult.ok(42).onValue(cb);
      expect(cb).toHaveBeenCalledWith(42);
    });

    it('supports error handlers', async () => {
      const cb = jest.fn();
      await AsyncResult.err('oops').onError(cb);
      expect(cb).toHaveBeenCalledWith('oops');
    });

    it('handles error thrown in value handler', async () => {
      const res = await AsyncResult.ok(42).onValue(() => {
        throw 'oops';
      });
      expect(res).toEqual(Result._uncaught('oops'));
    });

    it('handles error thrown in error handler', async () => {
      const res = await AsyncResult.err('oops').onError(() => {
        throw 'oops';
      });
      expect(res).toEqual(Result._uncaught('oops'));
    });
  });
});
