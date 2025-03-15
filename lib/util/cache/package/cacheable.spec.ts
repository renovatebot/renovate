import { DateTime } from 'luxon';
import { Cacheable } from './cacheable';

describe('util/cache/package/cacheable', () => {
  it('constructs default value', () => {
    const res = Cacheable.empty();
    expect(res.ttlMinutes).toBe(15);
  });

  describe('TTL', () => {
    it('static method for minutes', () => {
      const res = Cacheable.forMinutes(123);
      expect(res.ttlMinutes).toBe(123);
    });

    it('method for minutes', () => {
      const res = Cacheable.empty();
      expect(res.forMinutes(42).ttlMinutes).toBe(42);
    });

    it('setter for minutes', () => {
      const res = Cacheable.empty();
      res.ttlMinutes = 42;
      expect(res.ttlMinutes).toBe(42);
    });

    it('static method for hours', () => {
      const res = Cacheable.forHours(3);
      expect(res.ttlMinutes).toBe(180);
    });

    it('method for hours', () => {
      const res = Cacheable.empty();
      expect(res.forHours(3).ttlMinutes).toBe(180);
    });

    it('setter for hours', () => {
      const res = Cacheable.empty();
      res.ttlHours = 3;
      expect(res.ttlMinutes).toBe(180);
    });

    it('static method for days', () => {
      const res = Cacheable.forDays(2);
      expect(res.ttlMinutes).toBe(2880);
    });

    it('method for days', () => {
      const res = Cacheable.empty();
      expect(res.forDays(2).ttlMinutes).toBe(2880);
    });

    it('setter for days', () => {
      const res = Cacheable.empty();
      res.ttlDays = 2;
      expect(res.ttlMinutes).toBe(2880);
    });
  });

  describe('public data', () => {
    it('via static method', () => {
      const res: Cacheable<number> = Cacheable.fromPublic(42);
      expect(res.value).toBe(42);
      expect(res.isPublic).toBeTrue();
      expect(res.isPrivate).toBeFalse();
    });

    it('via method', () => {
      const res: Cacheable<number> = Cacheable.empty().asPublic(42);
      expect(res.value).toBe(42);
      expect(res.isPublic).toBeTrue();
      expect(res.isPrivate).toBeFalse();
    });
  });

  describe('private data', () => {
    it('via static method', () => {
      const res: Cacheable<number> = Cacheable.fromPrivate(42);
      expect(res.value).toBe(42);
      expect(res.isPublic).toBeFalse();
      expect(res.isPrivate).toBeTrue();
    });

    it('via method', () => {
      const res: Cacheable<number> = Cacheable.empty().asPrivate(42);
      expect(res.value).toBe(42);
      expect(res.isPublic).toBeFalse();
      expect(res.isPrivate).toBeTrue();
    });
  });

  describe('timestamping', () => {
    function dateOf<T>(cacheableResult: Cacheable<T>): Date {
      return DateTime.fromISO(cacheableResult.cachedAt).toJSDate();
    }

    it('handles dates automatically', () => {
      const t1 = new Date();

      const empty = Cacheable.empty();
      const a = empty.asPrivate(42);
      const b = empty.asPublic(42);

      const t2 = new Date();

      const c = Cacheable.fromPrivate(42);
      const d = Cacheable.fromPublic(42);

      const t3 = new Date();

      expect(dateOf(empty)).toBeAfterOrEqualTo(t1);
      expect(dateOf(empty)).toBeBeforeOrEqualTo(t2);

      expect(dateOf(a)).toBeAfterOrEqualTo(t1);
      expect(dateOf(a)).toBeBeforeOrEqualTo(t2);

      expect(dateOf(b)).toBeAfterOrEqualTo(t1);
      expect(dateOf(b)).toBeBeforeOrEqualTo(t2);

      expect(dateOf(c)).toBeAfterOrEqualTo(t2);
      expect(dateOf(c)).toBeBeforeOrEqualTo(t3);

      expect(dateOf(d)).toBeAfterOrEqualTo(t2);
      expect(dateOf(d)).toBeBeforeOrEqualTo(t3);
    });
  });
});
