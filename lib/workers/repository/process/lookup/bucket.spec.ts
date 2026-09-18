import { partial } from '~test/util.ts';
import * as allVersioning from '../../../../modules/versioning/index.ts';
import type { VersioningApi } from '../../../../modules/versioning/types.ts';
import { getBucket, groupReleasesIntoBuckets } from './bucket.ts';

const versioningApi = allVersioning.get('npm');

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

  describe('groupReleasesIntoBuckets()', () => {
    it('puts everything into one bucket without separateMajorMinor', () => {
      const res = groupReleasesIntoBuckets(
        {},
        '1.0.0',
        [{ version: '1.1.0' }, { version: '2.0.0' }],
        versioningApi,
      );

      expect(res).toEqual({
        latest: [{ version: '1.1.0' }, { version: '2.0.0' }],
      });
    });

    it('separates major from non-major releases', () => {
      const res = groupReleasesIntoBuckets(
        { separateMajorMinor: true },
        '1.0.0',
        [{ version: '1.1.0' }, { version: '1.2.0' }, { version: '2.0.0' }],
        versioningApi,
      );

      expect(res).toEqual({
        'non-major': [{ version: '1.1.0' }, { version: '1.2.0' }],
        major: [{ version: '2.0.0' }],
      });
    });
  });
});
