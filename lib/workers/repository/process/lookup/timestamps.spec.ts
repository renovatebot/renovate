import type { ReleaseResult } from '../../../../modules/datasource/types';
import { get as getVersioning } from '../../../../modules/versioning/index';
import { asTimestamp } from '../../../../util/timestamp';
import { calculateMostRecentTimestamp } from '../../../../workers/repository/process/lookup/timestamps';

const versioning = getVersioning('semver');

describe('workers/repository/process/lookup/timestamps', () => {
  describe('calculateLatestReleaseBump', () => {
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

      const result = calculateMostRecentTimestamp(versioning, releaseResult);

      expect(result.mostRecentTimestamp).toBe('2022-01-01T00:00:00.000Z');
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

      const result = calculateMostRecentTimestamp(versioning, releaseResult);

      expect(result.mostRecentTimestamp).toBe('2023-01-01T00:00:00.000Z');
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

      const result = calculateMostRecentTimestamp(versioning, releaseResult);

      expect(result.mostRecentTimestamp).toBeUndefined();
    });

    it('handles latest release with deprecation flag', () => {
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
            releaseTimestamp: asTimestamp('2023-01-01T00:00:00.000Z'),
            isDeprecated: true,
          },
        ],
      };

      const result = calculateMostRecentTimestamp(versioning, releaseResult);

      expect(result.mostRecentTimestamp).toBeUndefined();
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

      const result = calculateMostRecentTimestamp(versioning, releaseResult);

      expect(result.mostRecentTimestamp).toBeUndefined();
    });

    it('returns undefined mostRecentTimestamp when no valid timestamps exist', () => {
      const releaseResult: ReleaseResult = {
        releases: [{ version: '1.0.0' }, { version: '2.0.0' }],
      };

      const result = calculateMostRecentTimestamp(versioning, releaseResult);

      expect(result.mostRecentTimestamp).toBeUndefined();
    });

    it('handles empty releases array', () => {
      const releaseResult: ReleaseResult = { releases: [] };
      const result = calculateMostRecentTimestamp(versioning, releaseResult);
      expect(result.mostRecentTimestamp).toBeUndefined();
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

      const result = calculateMostRecentTimestamp(versioning, releaseResult);

      expect(result.mostRecentTimestamp).toBe('2021-01-01T00:00:00.000Z');
      expect(result.sourceUrl).toBe('https://github.com/some/repo');
      expect(result.homepage).toBe('https://example.com');
      expect(result.tags).toEqual({ latest: '1.0.0' });
    });
  });

  it('handles ancient versions that are higher than the ones recently released', () => {
    const releaseResult: ReleaseResult = {
      releases: [
        {
          version: '99.99.99-alpha',
          releaseTimestamp: asTimestamp('2010-01-01T00:00:00.000Z'),
        },
        {
          version: '2.0.0',
          releaseTimestamp: asTimestamp('2022-01-01T00:00:00.000Z'),
        },
      ],
    };

    const result = calculateMostRecentTimestamp(versioning, releaseResult);

    expect(result).toBe(releaseResult);
    expect(result.mostRecentTimestamp).toBeUndefined();
  });

  it('handles errors thrown for invalid versions', () => {
    const releaseResult: ReleaseResult = {
      releases: [
        {
          version: 'foo',
          releaseTimestamp: asTimestamp('2020-01-01T00:00:00.000Z'),
        },
        {
          version: '1.0.0',
          releaseTimestamp: asTimestamp('2021-01-01T00:00:00.000Z'),
        },
        {
          version: 'bar',
          releaseTimestamp: asTimestamp('2022-01-01T00:00:00.000Z'),
        },
        {
          version: '2.0.0',
          releaseTimestamp: asTimestamp('2023-01-01T00:00:00.000Z'),
        },
      ],
    };

    const result = calculateMostRecentTimestamp(versioning, releaseResult);

    expect(result.mostRecentTimestamp).toBe('2023-01-01T00:00:00.000Z');
  });
});
