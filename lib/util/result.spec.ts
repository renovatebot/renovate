import { Result } from './result';

describe('util/result', () => {
  describe('ok', () => {
    it('constructs successful result from value', () => {
      expect(Result.ok(42).value).toBe(42);
    });
  });

  describe('err', () => {
    it('constructs `true` error by default', () => {
      const res = Result.err();
      expect(res.error).toBeTrue();
    });

    it('constructs error result from Error instance', () => {
      const err = new Error('oops');
      const res = Result.err(err);
      expect(res.error).toBe(err);
    });
  });

  describe('wrap', () => {
    it('wraps function returning successful result', () => {
      const res = Result.wrap(() => 42);
      expect(res.value).toBe(42);
    });

    it('wraps function that throws an error', () => {
      const res = Result.wrap(() => {
        throw new Error('oops');
      });
      expect(res.error?.message).toBe('oops');
    });

    it('wraps promise resolving to value', async () => {
      const res = await Result.wrap(Promise.resolve(42));
      expect(res.value).toBe(42);
    });

    it('wraps promise rejecting with error', async () => {
      const err = new Error('oops');
      const res = await Result.wrap(Promise.reject(err));
      expect(res.error).toMatchObject({ message: 'oops' });
    });
  });

  describe('transform', () => {
    const fn = (x: string) => x.toUpperCase();

    it('transforms successful result', () => {
      const res = Result.ok('foo').transform(fn);
      expect(res).toEqual(Result.ok('FOO'));
    });

    it('no-op for error result', () => {
      const err = new Error('bar');
      const res = Result.err(err).transform(fn);
      expect(res.value).toBeUndefined();
      expect(res.error).toBe(err);
    });

    it('transforms successful promises', async () => {
      const res = await Result.wrap(Promise.resolve('foo')).transform(fn);
      expect(res).toEqual(Result.ok('FOO'));
    });

    it('transforms failed promises', async () => {
      const res = await Result.wrap(Promise.reject('bar')).transform(fn);
      expect(res).toEqual(Result.err('bar'));
    });

    it('handles failed promise transform', async () => {
      const res = await Result.wrap(Promise.resolve('foo')).transform(() => {
        throw new Error('bar');
      });
      expect(res).toEqual(Result.err(new Error('bar')));
    });

    it('handles chained failure', async () => {
      const res = await Result.wrap(Promise.resolve('foo'))
        .transform(() => {
          throw new Error('bar');
        })
        .transform(fn);
      expect(res).toEqual(Result.err(new Error('bar')));
    });
  });

  describe('fallback', () => {
    const fn = (x: string) => x.toUpperCase();

    it('returns original value for successful result', () => {
      const res = Result.ok(42);
      expect(res.fallback(0)).toBe(42);
    });

    it('returns fallback value for error result', () => {
      const err = new Error('oops');
      const res = Result.err(err);
      expect(res.fallback(42)).toBe(42);
    });

    it('skips fallback for successful promise transform', async () => {
      const res = await Result.wrap(Promise.resolve('foo'))
        .fallback('bar')
        .transform(fn);
      expect(res).toEqual(Result.ok('FOO'));
    });

    it('uses fallback for failed promise transform', async () => {
      const res = await Result.wrap(Promise.reject('foo'))
        .fallback('bar')
        .transform(fn);
      expect(res).toEqual(Result.ok('BAR'));
    });
  });

  describe('value', () => {
    it('returns successful value', () => {
      const res = Result.ok(42);
      expect(res.value).toBe(42);
    });

    it('returns undefined value for error result', () => {
      const err = new Error('oops');
      const res = Result.err(err);
      expect(res.value).toBeUndefined();
    });
  });

  describe('error', () => {
    it('returns undefined error for successful result', () => {
      const res = Result.ok(42);
      expect(res.error).toBeUndefined();
    });

    it('returns error for non-successful result', () => {
      const err = new Error('oops');
      const res = Result.err(err);
      expect(res.error).toEqual(err);
    });
  });
});
