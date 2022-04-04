import { DateTime } from 'luxon';
import { getItem, reconcileWithPage, setItem } from './list-cache';
import type { ListCache } from './types';

describe('modules/platform/github/list-cache', () => {
  const now = DateTime.now();
  const t1 = now.plus({ hours: 1 }).toISO();
  const t2 = now.plus({ hours: 2 }).toISO();
  const t3 = now.plus({ hours: 3 }).toISO();
  const t4 = now.plus({ hours: 4 }).toISO();
  const t5 = now.plus({ hours: 5 }).toISO();

  it('stores and retrieves items', () => {
    const item1 = { number: 1, updated_at: t1 };
    const item2 = { number: 2, updated_at: t2 };
    const cache: ListCache = {
      items: { 1: item1 },
      timestamp: t2,
    };

    expect(getItem(cache, 1)).toBe(item1);
    expect(getItem(cache, 2)).toBeNull();

    setItem(cache, item2);
    expect(getItem(cache, 2)).toBe(item2);
  });

  describe('reconcileWithPage', () => {
    it('appends items', () => {
      const cache: ListCache = {
        items: {
          1: { number: 1, updated_at: t1 },
          2: { number: 2, updated_at: t2 },
        },
        timestamp: t2,
      };

      const needNextPage = reconcileWithPage(cache, [
        { number: 3, updated_at: t3 },
        { number: 4, updated_at: t4 },
      ]);

      expect(cache).toEqual({
        items: {
          1: { number: 1, updated_at: t1 },
          2: { number: 2, updated_at: t2 },
          3: { number: 3, updated_at: t3 },
          4: { number: 4, updated_at: t4 },
        },
        timestamp: t4,
      });
      expect(needNextPage).toBeTrue();
    });

    it('caches updated items', () => {
      const cache: ListCache = {
        items: {
          1: { number: 1, updated_at: t1 },
          2: { number: 2, updated_at: t2 },
          3: { number: 3, updated_at: t3 },
        },
        timestamp: t3,
      };

      const needNextPage = reconcileWithPage(cache, [
        { number: 3, updated_at: t3 },
        { number: 1, updated_at: t4 },
        { number: 2, updated_at: t5 },
      ]);

      expect(cache).toEqual({
        items: {
          3: { number: 3, updated_at: t3 },
          1: { number: 1, updated_at: t4 },
          2: { number: 2, updated_at: t5 },
        },
        timestamp: t5,
      });
      expect(needNextPage).toBeFalse();
    });
  });
});
