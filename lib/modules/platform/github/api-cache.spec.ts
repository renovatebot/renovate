import { DateTime } from 'luxon';
import { ApiCache } from './api-cache';

describe('modules/platform/github/api-cache', () => {
  const now = DateTime.now();
  const t1 = now.plus({ hours: 1 }).toISO();
  const t2 = now.plus({ hours: 2 }).toISO();
  const t3 = now.plus({ hours: 3 }).toISO();
  const t4 = now.plus({ hours: 4 }).toISO();
  const t5 = now.plus({ hours: 5 }).toISO();

  it('stores and retrieves items', () => {
    const item1 = { number: 1, updated_at: t1 };
    const item2 = { number: 2, updated_at: t2 };
    const apiCache = new ApiCache({
      items: { 1: item1 },
      lastUpdated: t1,
    });

    expect(apiCache.getItem(1)).toBe(item1);
    expect(apiCache.getItem(2)).toBeNull();

    apiCache.updateItem(item2);
    expect(apiCache.getItem(2)).toBe(item2);
    expect(apiCache.lastUpdated()).toBe(t1); // Not `t2`, see jsdoc for `setItem`
    expect(apiCache.getItems()).toEqual([item1, item2]);
  });

  describe('reconcile', () => {
    it('appends new items', () => {
      const apiCache = new ApiCache({
        items: {
          1: { number: 1, updated_at: t1 },
          2: { number: 2, updated_at: t2 },
        },
        lastUpdated: t2,
      });

      const needNextPage = apiCache.reconcile([
        { number: 4, updated_at: t4 },
        { number: 3, updated_at: t3 },
      ]);

      expect(apiCache.getItems()).toEqual([
        { number: 1, updated_at: t1 },
        { number: 2, updated_at: t2 },
        { number: 3, updated_at: t3 },
        { number: 4, updated_at: t4 },
      ]);
      expect(apiCache.lastUpdated()).toBe(t4);
      expect(needNextPage).toBeTrue();
    });

    it('handles updated items', () => {
      const apiCache = new ApiCache({
        items: {
          1: { number: 1, updated_at: t1 },
          2: { number: 2, updated_at: t2 },
          3: { number: 3, updated_at: t3 },
        },
        lastUpdated: t3,
      });

      const needNextPage = apiCache.reconcile([
        { number: 1, updated_at: t5 },
        { number: 2, updated_at: t4 },
        { number: 3, updated_at: t3 },
      ]);

      expect(apiCache.getItems()).toEqual([
        { number: 1, updated_at: t5 },
        { number: 2, updated_at: t4 },
        { number: 3, updated_at: t3 },
      ]);
      expect(apiCache.lastUpdated()).toBe(t5);
      expect(needNextPage).toBeFalse();
    });

    it('ignores page overlap', () => {
      const apiCache = new ApiCache({
        items: {},
      });

      const res1 = apiCache.reconcile([
        { number: 5, updated_at: t5 },
        { number: 4, updated_at: t4 },
        { number: 3, updated_at: t3 },
      ]);
      const res2 = apiCache.reconcile([
        { number: 3, updated_at: t3 },
        { number: 2, updated_at: t2 },
        { number: 1, updated_at: t1 },
      ]);

      expect(apiCache.getItems()).toEqual([
        { number: 1, updated_at: t1 },
        { number: 2, updated_at: t2 },
        { number: 3, updated_at: t3 },
        { number: 4, updated_at: t4 },
        { number: 5, updated_at: t5 },
      ]);
      expect(apiCache.lastUpdated()).toBe(t5);
      expect(res1).toBeTrue();
      expect(res2).toBeTrue();
    });

    it('does not require new page if all items are old', () => {
      const apiCache = new ApiCache({
        items: {
          1: { number: 1, updated_at: t1 },
          2: { number: 2, updated_at: t2 },
          3: { number: 3, updated_at: t3 },
        },
        lastUpdated: t3,
      });

      const needNextPage = apiCache.reconcile([
        { number: 3, updated_at: t3 },
        { number: 2, updated_at: t2 },
        { number: 1, updated_at: t1 },
      ]);

      expect(apiCache.getItems()).toEqual([
        { number: 1, updated_at: t1 },
        { number: 2, updated_at: t2 },
        { number: 3, updated_at: t3 },
      ]);
      expect(apiCache.lastUpdated()).toBe(t3);
      expect(needNextPage).toBeFalse();
    });
  });
});
