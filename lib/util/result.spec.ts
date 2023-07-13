import { logger } from '../../test/util';
import { AsyncResult, Result } from './result';

describe('util/result', () => {
  describe('ok', () => {
    it('constructs successful result from value', () => {
      expect(Result.ok(42).unwrap()).toEqual({ ok: true, value: 42 });
    });
  });

  describe('err', () => {
    it('constructs error from value', () => {
      expect(Result.err('oops').unwrap()).toEqual({ ok: false, error: 'oops' });
    });

    it('constructs error from Error instance', () => {
      const error = new Error('oops');
      expect(Result.err(error).unwrap()).toEqual({ ok: false, error });
    });
  });

  describe('wrap', () => {
    it('wraps function returning successful result', () => {
      expect(Result.wrap(() => 42).unwrap(-1)).toBe(42);
    });

    it('wraps function that throws an error', () => {
      expect(
        Result.wrap(() => {
          throw new Error('oops');
        }).unwrap()
      ).toEqual({ ok: false, error: new Error('oops') });
    });

    it('wraps promise resolving to value', async () => {
      const res = await Result.wrap(Promise.resolve(42)).unwrap(-1);
      expect(res).toBe(42);
    });

    it('wraps promise rejecting with error', async () => {
      const res = await Result.wrap(Promise.reject('oops')).unwrap();
      expect(res).toEqual({ ok: false, error: 'oops' });
    });
  });

  describe('transform', () => {
    const fn = (x: string) => Result.ok(x.toUpperCase());
    const afn = (x: string) => Promise.resolve(Result.ok(x.toUpperCase()));

    it('transforms successful result', () => {
      const res = Result.ok('foo').transform(fn);
      expect(res).toEqual(Result.ok('FOO'));
    });

    it('asynchronously transforms successful result', async () => {
      const res = await Result.ok('foo').transform(afn);
      expect(res).toEqual(Result.ok('FOO'));
    });

    it('bypasses transform for error result', async () => {
      const res1 = Result.err('oops').transform(fn);
      expect(res1).toEqual(Result.err('oops'));

      const res2 = Result.err('oops').transform(afn);
      expect(res2).toEqual(Result.err('oops'));

      const res3 = await Result.wrap(Promise.reject('oops')).transform(fn);
      expect(res3).toEqual(Result.err('oops'));

      const res4 = await Result.wrap(Promise.reject('oops')).transform(afn);
      expect(res4).toEqual(Result.err('oops'));

      const res5 = await new AsyncResult<string, string>((_, reject) =>
        reject('oops')
      ).transform(afn);
      expect(res5).toEqual(Result.err('oops'));
    });

    it('logs and returns error for transform failure', () => {
      const res = Result.ok('foo').transform(() => {
        throw 'oops';
      });
      expect(res).toEqual(Result.err('oops'));
      expect(logger.logger.warn).toHaveBeenCalledWith(
        expect.anything(),
        'Result: unhandled transform error'
      );
    });

    it('logs and returns error for async transform failure', async () => {
      const res = await Result.ok('foo').transform(() =>
        Promise.reject('oops')
      );
      expect(res).toEqual(Result.err('oops'));
      expect(logger.logger.warn).toHaveBeenCalledWith(
        expect.anything(),
        'Result: unhandled async transform error'
      );
    });

    it('transforms successful promises', async () => {
      const res = await Result.wrap(Promise.resolve('foo')).transform(fn);
      expect(res).toEqual(Result.ok('FOO'));
    });

    it('bypasses transform of failed promises', async () => {
      const res = await Result.wrap(Promise.reject('bar')).transform(fn);
      expect(res).toEqual(Result.err('bar'));
    });

    it('handles failed transform of successful promise', async () => {
      const res = await Result.wrap(Promise.resolve('foo')).transform(() => {
        throw 'bar';
      });
      expect(res).toEqual(Result.err('bar'));
      expect(logger.logger.warn).toHaveBeenCalledWith(
        expect.anything(),
        'AsyncResult: unhandled transform error'
      );
    });

    it('handles failed async transform of successful promise', async () => {
      const res = await Result.wrap(Promise.resolve('foo')).transform(() =>
        Promise.reject('bar')
      );
      expect(res).toEqual(Result.err('bar'));
      expect(logger.logger.warn).toHaveBeenCalledWith(
        expect.anything(),
        'AsyncResult: unhandled async transform error'
      );
    });

    it('handles chained failure', async () => {
      const res = await Result.wrap<string>(Promise.resolve('foo'))
        .transform(() => {
          throw new Error('bar');
        })
        .transform(fn as never);
      expect(res).toEqual(Result.err(new Error('bar')));
    });
  });

  describe('fallback', () => {
    const fn = (x: string) => Result.ok(x.toUpperCase());

    it('returns original value for successful result', () => {
      const res = Result.ok(42);
      expect(res.unwrap(0)).toBe(42);
    });

    it('returns fallback value for error result', () => {
      const res = Result.err(new Error('oops'));
      expect(res.unwrap(42)).toBe(42);
    });

    it('skips fallback for successful promise transform', async () => {
      const res = await Result.wrap(Promise.resolve('foo')).transform(fn);
      expect(res).toEqual(Result.ok('FOO'));
    });

    it('uses fallback for failed promise transform', async () => {
      const res = await Result.wrap(Promise.reject('foo'))
        .transform(fn)
        .unwrap('bar');
      expect(res).toBe('bar');
    });
  });
});
