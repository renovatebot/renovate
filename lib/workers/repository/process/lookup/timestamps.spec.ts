import type { ReleaseResult } from '../../../../modules/datasource/types';
import { get as getVersioning } from '../../../../modules/versioning/index';
import { asTimestamp } from '../../../../util/timestamp';
import { calculateLatestReleaseTimestamp } from '../../../../workers/repository/process/lookup/timestamps';

const versioning = getVersioning('semver');

describe('workers/repository/process/lookup/timestamps', () => {
  describe('calculatelatestReleaseTimestamp', () => {
    it('returns the timestamp of the latest version', () => {
      const releaseResult: ReleaseResult = {
        releases: [
          {
            version: '1.0.0',
            releaseTimestamp: asTimestamp('2021-01-01T00:00:00.000Z'),
          },
          {
            version: '2.0.0',
            releaseTimestamp: asTimestamp('2022-01-01T00:00:00.000Z'),
          },
          {
            version: '0.9.0',
            releaseTimestamp: asTimestamp('2020-01-01T00:00:00.000Z'),
          },
        ],
      };

      const result = calculateLatestReleaseTimestamp(versioning, releaseResult);

      expect(result.latestReleaseTimestamp).toBe('2022-01-01T00:00:00.000Z');
    });

    it('handles releases with missing timestamps', () => {
      const releaseResult: ReleaseResult = {
        releases: [
          {
            version: '1.0.0',
            releaseTimestamp: asTimestamp('2021-01-01T00:00:00.000Z'),
          },
          { version: '2.0.0' }, // Missing timestamp
          {
            version: '3.0.0',
            releaseTimestamp: asTimestamp('2023-01-01T00:00:00.000Z'),
          },
        ],
      };

      const result = calculateLatestReleaseTimestamp(versioning, releaseResult);

      expect(result.latestReleaseTimestamp).toBe('2023-01-01T00:00:00.000Z');
    });

    it('handles latest release with missing timestamp', () => {
      const releaseResult: ReleaseResult = {
        releases: [
          {
            version: '1.0.0',
            releaseTimestamp: asTimestamp('2021-01-01T00:00:00.000Z'),
          },
          {
            version: '2.0.0',
            releaseTimestamp: asTimestamp('2022-01-01T00:00:00.000Z'),
          },
          {
            version: '3.0.0',
          },
        ],
      };

      const result = calculateLatestReleaseTimestamp(versioning, releaseResult);

      expect(result.latestReleaseTimestamp).toBeUndefined();
    });

    it('handles latest release with invalid version', () => {
      const releaseResult: ReleaseResult = {
        releases: [
          {
            version: '1.0.0',
            releaseTimestamp: asTimestamp('2021-01-01T00:00:00.000Z'),
          },
          {
            version: '2.0.0',
            releaseTimestamp: asTimestamp('2022-01-01T00:00:00.000Z'),
          },
          {
            version: '3.0.0',
            releaseTimestamp: asTimestamp('invalid'),
          },
        ],
      };

      const result = calculateLatestReleaseTimestamp(versioning, releaseResult);

      expect(result.latestReleaseTimestamp).toBeUndefined();
    });

    it('returns undefined latestReleaseTimestamp when no valid timestamps exist', () => {
      const releaseResult: ReleaseResult = {
        releases: [{ version: '1.0.0' }, { version: '2.0.0' }],
      };

      const result = calculateLatestReleaseTimestamp(versioning, releaseResult);

      expect(result.latestReleaseTimestamp).toBeUndefined();
    });

    it('handles empty releases array', () => {
      const releaseResult: ReleaseResult = { releases: [] };
      const result = calculateLatestReleaseTimestamp(versioning, releaseResult);
      expect(result.latestReleaseTimestamp).toBeUndefined();
    });

    it('preserves other properties in the release result', () => {
      const releaseResult: ReleaseResult = {
        releases: [
          {
            version: '1.0.0',
            releaseTimestamp: asTimestamp('2021-01-01T00:00:00.000Z'),
          },
        ],
        sourceUrl: 'https://github.com/some/repo',
        homepage: 'https://example.com',
        tags: { latest: '1.0.0' },
      };

      const result = calculateLatestReleaseTimestamp(versioning, releaseResult);

      expect(result.latestReleaseTimestamp).toBe('2021-01-01T00:00:00.000Z');
      expect(result.sourceUrl).toBe('https://github.com/some/repo');
      expect(result.homepage).toBe('https://example.com');
      expect(result.tags).toEqual({ latest: '1.0.0' });
    });
  });
});
