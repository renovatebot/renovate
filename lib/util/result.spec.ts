import { Result } from './result';

describe('util/result', () => {
  describe('ok', () => {
    it('creates a Result with ok set to true and the provided value', () => {
      expect(Result.ok(42).value()).toBe(42);
    });
  });

  describe('err', () => {
    it('creates a Result with ok set to false and a new Error if no argument is provided', () => {
      const res = Result.err();
      expect(res.error()).toEqual(new Error());
    });

    it('creates a Result with ok set to false and a new Error with the provided message if a string is provided', () => {
      const res = Result.err('foobar');
      expect(res.error()).toEqual(new Error('foobar'));
    });

    it('creates a Result with ok set to false and the provided error if an error is provided', () => {
      const err = new Error('foobar');
      const res = Result.err(err);
      expect(res.error()).toBe(err);
    });
  });

  describe('wrap', () => {
    it('returns a Result with ok set to true and the value returned by the provided function if the function does not throw', () => {
      const res = Result.wrap(() => 42);
      expect(res).toEqual(Result.ok(42));
    });

    it('returns a Result with ok set to false and the error thrown by the provided function if the function throws', () => {
      const err = new Error('oops');
      const res = Result.wrap(() => {
        throw err;
      });
      expect(res).toEqual(Result.err(err));
    });
  });

  describe('transform', () => {
    const fn = (x: string) => x.toUpperCase();

    it('returns a new Result with the transformed value if the original Result is ok', () => {
      const res = Result.ok('foo').transform(fn);
      expect(res).toEqual(Result.ok('FOO'));
    });

    it('returns a new Result with the original error if the original Result is not ok', () => {
      const err = new Error('bar');
      const res = Result.err(err).transform(fn);
      expect(res.value()).toBeUndefined();
      expect(res.error()).toBe(err);
    });
  });

  describe('unwrap', () => {
    it('returns the value if the Result is ok', () => {
      const res = Result.ok(42);
      expect(res.unwrap()).toEqual({ ok: true, value: 42 });
    });

    it('returns the fallback if the Result is not ok', () => {
      const err = new Error('oops');
      const res = Result.err(err);
      expect(res.unwrap(42)).toEqual({ ok: true, value: 42 });
    });

    it('returns undefined if the Result is not ok and no fallback is provided', () => {
      const err = new Error('oops');
      const res = Result.err(err);
      expect(res.unwrap()).toEqual({ ok: false, error: err });
    });
  });

  describe('value', () => {
    it('returns the value if the Result is ok', () => {
      const res = Result.ok(42);
      expect(res.value()).toBe(42);
    });

    it('returns the fallback if the Result is not ok', () => {
      const err = new Error('oops');
      const res = Result.err(err);
      expect(res.value(42)).toBe(42);
    });

    it('returns undefined if the Result is not ok and no fallback is provided', () => {
      const err = new Error('oops');
      const res = Result.err(err);
      expect(res.value()).toBeUndefined();
    });
  });

  describe('error', () => {
    it('returns undefined if the Result is ok', () => {
      const res = Result.ok(42);
      expect(res.error()).toBeUndefined();
    });

    it('returns the error if the Result is not ok', () => {
      const err = new Error('oops');
      const res = Result.err(err);
      expect(res.error()).toEqual(err);
    });
  });
});
