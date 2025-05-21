import { DateTime } from 'luxon';
import type { ReleaseResult } from '../../../../modules/datasource/types';
import { asTimestamp } from '../../../../util/timestamp';
import { calculateAbandonment } from './abandonment';
import type { LookupUpdateConfig } from './types';

describe('workers/repository/process/lookup/abandonment', () => {
  describe('calculateAbandonment', () => {
    const mockDate = '2023-01-01T00:00:00.000Z';
    const mockTime = DateTime.fromISO(mockDate, { zone: 'utc' }).toMillis();

    beforeAll(() => {
      vi.useFakeTimers();
    });

    beforeEach(() => {
      vi.setSystemTime(mockTime);
    });

    const config: LookupUpdateConfig = {
      datasource: 'npm',
      versioning: 'semver',
      packageName: 'example-package',
      rangeStrategy: 'auto',
    };

    it('returns the original release result when no abandonment threshold is provided', () => {
      const releaseResult: ReleaseResult = {
        releases: [{ version: '1.0.0' }],
        mostRecentTimestamp: asTimestamp('2022-01-01T00:00:00.000Z')!,
      };

      const result = calculateAbandonment(releaseResult, config);

      expect(result).toBe(releaseResult);
      expect(result.isAbandoned).toBeUndefined();
    });

    it('returns the original release result when abandonment threshold is invalid', () => {
      const releaseResult: ReleaseResult = {
        releases: [{ version: '1.0.0' }],
        mostRecentTimestamp: asTimestamp('2022-01-01T00:00:00.000Z')!,
      };

      const result = calculateAbandonment(releaseResult, {
        ...config,
        abandonmentThreshold: 'invalid',
      });

      expect(result).toBe(releaseResult);
      expect(result.isAbandoned).toBeUndefined();
    });

    it('returns the original release result when no mostRecentTimestamp timestamp is available', () => {
      const releaseResult: ReleaseResult = {
        releases: [{ version: '1.0.0' }],
      };

      const result = calculateAbandonment(releaseResult, {
        ...config,

        abandonmentThreshold: '1 year',
      });

      expect(result).toBe(releaseResult);
      expect(result.isAbandoned).toBeUndefined();
    });

    it('marks a package as abandoned when mostRecentTimestamp plus threshold is before now', () => {
      const releaseResult: ReleaseResult = {
        releases: [{ version: '1.0.0' }],
        mostRecentTimestamp: asTimestamp('2020-01-01T00:00:00.000Z')!, // 3 years before mocked now
      };

      const result = calculateAbandonment(releaseResult, {
        ...config,
        abandonmentThreshold: '2 years',
      });

      expect(result.isAbandoned).toBe(true);
    });

    it('does not mark a package as abandoned when mostRecentTimestamp plus threshold is after now', () => {
      const releaseResult: ReleaseResult = {
        releases: [{ version: '1.0.0' }],
        mostRecentTimestamp: asTimestamp('2022-06-01T00:00:00.000Z')!, // 6 months before mocked now
      };

      const result = calculateAbandonment(releaseResult, {
        ...config,
        abandonmentThreshold: '1 year',
      });

      expect(result.isAbandoned).toBe(false);
    });

    it('preserves other properties in the release result', () => {
      const releaseResult: ReleaseResult = {
        releases: [{ version: '1.0.0' }],
        mostRecentTimestamp: asTimestamp('2020-01-01T00:00:00.000Z')!,
        sourceUrl: 'https://github.com/some/repo',
        homepage: 'https://example.com',
        tags: { latest: '1.0.0' },
      };

      const result = calculateAbandonment(releaseResult, {
        ...config,
        abandonmentThreshold: '1 year',
      });

      expect(result.isAbandoned).toBe(true);
      expect(result.sourceUrl).toBe('https://github.com/some/repo');
      expect(result.homepage).toBe('https://example.com');
      expect(result.tags).toEqual({ latest: '1.0.0' });
    });

    it('handles exactly at the threshold boundary', () => {
      const twoYearsAgo = DateTime.fromISO('2021-01-01T00:00:00.000Z')
        .minus({ years: 2 })
        .toISO();

      const releaseResult: ReleaseResult = {
        releases: [{ version: '1.0.0' }],
        mostRecentTimestamp: asTimestamp(twoYearsAgo)!,
      };

      const result = calculateAbandonment(releaseResult, {
        ...config,
        abandonmentThreshold: '2 years',
      });

      expect(result.isAbandoned).toBe(true);
    });
  });
});
