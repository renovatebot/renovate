import { partial } from '~test/util.ts';
import type { VersioningApi } from '../../../../modules/versioning/types.ts';
import { getBucket } from './bucket.ts';

describe('workers/repository/process/lookup/bucket', () => {
  describe('getBucket()', () => {
    it('returns null if the new major cannot be determined', () => {
      const versioningApi = partial<VersioningApi>({
        getMajor: () => null,
      });

      expect(
        getBucket(
          { separateMajorMinor: true },
          '1.0.0',
          'not-a-version',
          versioningApi,
        ),
      ).toBeNull();
    });

    it('returns non-major if a minor cannot be determined', () => {
      const versioningApi = partial<VersioningApi>({
        getMajor: () => 1,
        getMinor: () => null,
      });

      expect(
        getBucket(
          { separateMajorMinor: true },
          '1.0.0',
          '1.1.0',
          versioningApi,
        ),
      ).toBe('non-major');
    });
  });
});
