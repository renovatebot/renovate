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
      expect(res.error?.message).toBe('oops');
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
  });

  describe('catch', () => {
    it('returns original value for successful result', () => {
      const res = Result.ok(42);
      expect(res.catch(0)).toBe(42);
    });

    it('returns fallback value for error result', () => {
      const err = new Error('oops');
      const res = Result.err(err);
      expect(res.catch(42)).toBe(42);
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
