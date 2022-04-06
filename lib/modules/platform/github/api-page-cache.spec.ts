import { DateTime } from 'luxon';
import { getItem, reconcileWithPage, setItem } from './api-page-cache';
import type { ApiPageCache } from './types';

describe('modules/platform/github/api-page-cache', () => {
  const now = DateTime.now();
  const t1 = now.plus({ hours: 1 }).toISO();
  const t2 = now.plus({ hours: 2 }).toISO();
  const t3 = now.plus({ hours: 3 }).toISO();
  const t4 = now.plus({ hours: 4 }).toISO();
  const t5 = now.plus({ hours: 5 }).toISO();

  it('stores and retrieves items', () => {
    const item1 = { number: 1, updated_at: t1 };
    const item2 = { number: 2, updated_at: t2 };
    const cache: ApiPageCache = {
      items: { 1: item1 },
      lastUpdated: t1,
    };

    expect(getItem(cache, 1)).toBe(item1);
    expect(getItem(cache, 2)).toBeNull();

    setItem(cache, item2);
    expect(getItem(cache, 2)).toBe(item2);
    expect(cache.lastUpdated).toBe(t1); // @see `setItem` jsdoc
  });

  describe('reconcileWithPage', () => {
    it('appends new items', () => {
      const cache: ApiPageCache = {
        items: {
          1: { number: 1, updated_at: t1 },
          2: { number: 2, updated_at: t2 },
        },
        lastUpdated: t2,
      };

      const needNextPage = reconcileWithPage(cache, [
        { number: 4, updated_at: t4 },
        { number: 3, updated_at: t3 },
      ]);

      expect(cache).toEqual({
        items: {
          1: { number: 1, updated_at: t1 },
          2: { number: 2, updated_at: t2 },
          3: { number: 3, updated_at: t3 },
          4: { number: 4, updated_at: t4 },
        },
        lastUpdated: t4,
      });
      expect(needNextPage).toBeTrue();
    });

    it('handles updated items', () => {
      const cache: ApiPageCache = {
        items: {
          1: { number: 1, updated_at: t1 },
          2: { number: 2, updated_at: t2 },
          3: { number: 3, updated_at: t3 },
        },
        lastUpdated: t3,
      };

      const needNextPage = reconcileWithPage(cache, [
        { number: 1, updated_at: t5 },
        { number: 2, updated_at: t4 },
        { number: 3, updated_at: t3 },
      ]);

      expect(cache).toEqual({
        items: {
          1: { number: 1, updated_at: t5 },
          2: { number: 2, updated_at: t4 },
          3: { number: 3, updated_at: t3 },
        },
        lastUpdated: t5,
      });
      expect(needNextPage).toBeFalse();
    });

    it('ignores page overlap', () => {
      const cache: ApiPageCache = { items: {} };

      const res1 = reconcileWithPage(cache, [
        { number: 5, updated_at: t5 },
        { number: 4, updated_at: t4 },
        { number: 3, updated_at: t3 },
      ]);
      const res2 = reconcileWithPage(cache, [
        { number: 3, updated_at: t3 },
        { number: 2, updated_at: t2 },
        { number: 1, updated_at: t1 },
      ]);

      expect(cache).toEqual({
        items: {
          1: { number: 1, updated_at: t1 },
          2: { number: 2, updated_at: t2 },
          3: { number: 3, updated_at: t3 },
          4: { number: 4, updated_at: t4 },
          5: { number: 5, updated_at: t5 },
        },
        lastUpdated: t5,
      });
      expect(res1).toBeTrue();
      expect(res2).toBeTrue();
    });

    it('does not require new page if all items are old', () => {
      const cache: ApiPageCache = {
        items: {
          1: { number: 1, updated_at: t1 },
          2: { number: 2, updated_at: t2 },
          3: { number: 3, updated_at: t3 },
        },
        lastUpdated: t3,
      };

      const needNextPage = reconcileWithPage(cache, [
        { number: 3, updated_at: t3 },
        { number: 2, updated_at: t2 },
        { number: 1, updated_at: t1 },
      ]);

      expect(cache).toEqual({
        items: {
          1: { number: 1, updated_at: t1 },
          2: { number: 2, updated_at: t2 },
          3: { number: 3, updated_at: t3 },
        },
        lastUpdated: t3,
      });
      expect(needNextPage).toBeFalse();
    });
  });
});
