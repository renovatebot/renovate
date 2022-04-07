import { DateTime } from 'luxon';
import { ApiCache } from './api-cache';

describe('modules/platform/github/api-cache', () => {
  const now = DateTime.fromISO('2000-01-01T00:00:00.000+00:00');
  const t1 = now.plus({ years: 1 }).toISO();
  const t1_http = now.plus({ years: 1 }).toHTTP();

  const t2 = now.plus({ years: 2 }).toISO();
  const t2_http = now.plus({ years: 2 }).toHTTP();

  const t3 = now.plus({ years: 3 }).toISO();
  const t3_http = now.plus({ years: 3 }).toHTTP();

  const t4 = now.plus({ years: 4 }).toISO();
  const t4_http = now.plus({ years: 4 }).toHTTP();

  const t5 = now.plus({ years: 5 }).toISO();
  const t5_http = now.plus({ years: 5 }).toHTTP();

  it('stores and retrieves items', () => {
    const item1 = { number: 1, updated_at: t1 };
    const item2 = { number: 2, updated_at: t2 };
    const apiCache = new ApiCache({
      items: { 1: item1 },
      lastModified: t1,
    });

    expect(apiCache.getItem(1)).toBe(item1);
    expect(apiCache.getItem(2)).toBeNull();

    apiCache.updateItem(item2);
    expect(apiCache.getItem(2)).toBe(item2);
    expect(apiCache.lastModified).toBe(t1_http); // Not `t2`, see jsdoc for `setItem`
    expect(apiCache.getItems()).toEqual([item1, item2]);
  });

  describe('getItems', () => {
    it('maps items', () => {
      const item1 = { number: 1, updated_at: t1 };
      const item2 = { number: 2, updated_at: t2 };
      const item3 = { number: 3, updated_at: t3 };
      const apiCache = new ApiCache({
        items: {
          1: item1,
          2: item2,
          3: item3,
        },
      });

      const res = apiCache.getItems(({ number }) => number);

      expect(res).toEqual([1, 2, 3]);
    });

    it('caches mapping results', () => {
      const item1 = { number: 1, updated_at: t1 };
      const item2 = { number: 2, updated_at: t2 };
      const item3 = { number: 3, updated_at: t3 };
      const apiCache = new ApiCache({
        items: {
          1: item1,
          2: item2,
          3: item3,
        },
      });

      let numbersMapCalls = 0;
      const mapNumbers = ({ number }) => {
        numbersMapCalls += 1;
        return number;
      };

      let datesMapCalls = 0;
      const mapDates = ({ updated_at }) => {
        datesMapCalls += 1;
        return updated_at;
      };

      const numbers1 = apiCache.getItems(mapNumbers);
      const numbers2 = apiCache.getItems(mapNumbers);
      const dates1 = apiCache.getItems(mapDates);
      const dates2 = apiCache.getItems(mapDates);

      expect(numbers1).toEqual([1, 2, 3]);
      expect(numbers1).toBe(numbers2);
      expect(numbersMapCalls).toBe(3);

      expect(dates1).toEqual([t1, t2, t3]);
      expect(dates1).toBe(dates2);
      expect(datesMapCalls).toBe(3);
    });

    it('resets cache on item update', () => {
      const item1 = { number: 1, updated_at: t1 };
      const item2 = { number: 2, updated_at: t2 };
      const item3 = { number: 3, updated_at: t3 };
      const apiCache = new ApiCache({
        items: {
          1: item1,
          2: item2,
        },
      });

      let numbersMapCalls = 0;
      const mapNumbers = ({ number }) => {
        numbersMapCalls += 1;
        return number;
      };
      const numbers1 = apiCache.getItems(mapNumbers);
      apiCache.updateItem(item3);
      const numbers2 = apiCache.getItems(mapNumbers);

      expect(numbers1).toEqual([1, 2]);
      expect(numbers2).toEqual([1, 2, 3]);
      expect(numbersMapCalls).toBe(5);
    });

    it('resets cache on page reconcile', () => {
      const item1 = { number: 1, updated_at: t1 };
      const item2 = { number: 2, updated_at: t2 };
      const item3 = { number: 3, updated_at: t3 };
      const apiCache = new ApiCache({
        items: {
          1: item1,
          2: item2,
        },
      });

      let numbersMapCalls = 0;
      const mapNumbers = ({ number }) => {
        numbersMapCalls += 1;
        return number;
      };
      const numbers1 = apiCache.getItems(mapNumbers);
      apiCache.reconcile([item3]);
      const numbers2 = apiCache.getItems(mapNumbers);

      expect(numbers1).toEqual([1, 2]);
      expect(numbers2).toEqual([1, 2, 3]);
      expect(numbersMapCalls).toBe(5);
    });
  });

  describe('reconcile', () => {
    it('appends new items', () => {
      const apiCache = new ApiCache({ items: {} });
      expect(apiCache.lastModified).toBeNull();

      const res1 = apiCache.reconcile([
        { number: 2, updated_at: t2 },
        { number: 1, updated_at: t1 },
      ]);
      expect(apiCache.lastModified).toBe(t2_http);
      expect(res1).toBeTrue();

      const res2 = apiCache.reconcile([
        { number: 4, updated_at: t4 },
        { number: 3, updated_at: t3 },
      ]);
      expect(apiCache.lastModified).toBe(t4_http);
      expect(res2).toBeTrue();

      expect(apiCache.getItems()).toEqual([
        { number: 1, updated_at: t1 },
        { number: 2, updated_at: t2 },
        { number: 3, updated_at: t3 },
        { number: 4, updated_at: t4 },
      ]);
    });

    it('handles updated items', () => {
      const apiCache = new ApiCache({
        items: {
          1: { number: 1, updated_at: t1 },
          2: { number: 2, updated_at: t2 },
          3: { number: 3, updated_at: t3 },
        },
        lastModified: t3,
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
      expect(apiCache.lastModified).toBe(t5_http);
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
      expect(apiCache.lastModified).toBe(t5_http);
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
        lastModified: t3,
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
      expect(apiCache.lastModified).toBe(t3_http);
      expect(needNextPage).toBeFalse();
    });
  });

  describe('etag', () => {
    it('returns null', () => {
      const apiCache = new ApiCache({ items: {} });
      expect(apiCache.etag).toBeNull();
    });

    it('sets and retrieves non-null value', () => {
      const apiCache = new ApiCache({ items: {} });
      apiCache.etag = 'foobar';
      expect(apiCache.etag).toBe('foobar');
    });

    it('deletes value for null parameter', () => {
      const apiCache = new ApiCache({ items: {} });
      apiCache.etag = null;
      expect(apiCache.etag).toBeNull();
    });
  });
});
