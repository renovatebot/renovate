import { asTimestamp } from './timestamp';

describe('util/timestamp', () => {
  describe('asTimestamp', () => {
    it('handles Date objects', () => {
      const date = new Date('2021-01-01T00:00:00.000Z');
      expect(asTimestamp(date)).toBe('2021-01-01T00:00:00.000Z');
    });

    it('handles valid number timestamps', () => {
      const timestamp = 1609459200000; // 2021-01-01T00:00:00.000Z
      expect(asTimestamp(timestamp)).toBe('2021-01-01T00:00:00.000Z');
    });

    it('rejects invalid number timestamps', () => {
      expect(asTimestamp(-1)).toBeNull();
      expect(asTimestamp(0)).toBeNull();
      expect(asTimestamp(NaN)).toBeNull();
      expect(asTimestamp(Date.now() + 48 * 60 * 60 * 1000)).toBeNull(); // 48 hours in the future
    });

    it('handles ISO string dates', () => {
      expect(asTimestamp('2021-01-01T00:00:00.000Z')).toBe(
        '2021-01-01T00:00:00.000Z',
      );
      expect(asTimestamp('2021-01-01')).toBe('2021-01-01T00:00:00.000Z');
    });

    it('handles numberLike format dates', () => {
      expect(asTimestamp('20210101000000')).toBe('2021-01-01T00:00:00.000Z');
      expect(asTimestamp('20211231235959')).toBe('2021-12-31T23:59:59.000Z');
    });

    it('handles dates that need fallback parsing', () => {
      // Date strings that don't match ISO or numberLike format
      expect(asTimestamp('Jan 1, 2021')).toBe('2021-01-01T00:00:00.000Z');
      expect(asTimestamp('2021/01/01')).toBe('2021-01-01T00:00:00.000Z');
    });

    it('returns null for invalid inputs', () => {
      expect(asTimestamp(null)).toBeNull();
      expect(asTimestamp(undefined)).toBeNull();
      expect(asTimestamp({})).toBeNull();
      expect(asTimestamp([])).toBeNull();
      expect(asTimestamp('invalid date')).toBeNull();
      expect(asTimestamp('202x0101000000')).toBeNull(); // invalid numberLike format
    });
  });
});
