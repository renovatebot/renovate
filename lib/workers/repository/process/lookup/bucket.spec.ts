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

    it('separates a minor which only isSame() can see', () => {
      const versioningApi = partial<VersioningApi>({
        getMajor: () => 1,
        // the numbers claim both versions share a minor
        getMinor: () => 2,
        isSame: (type) => type === 'major',
      });

      expect(
        getBucket(
          { separateMajorMinor: true, separateMinorPatch: true },
          '1.2.0',
          '1.2.1',
          versioningApi,
        ),
      ).toBe('minor');
    });

    it('treats a minor which isSame() calls unchanged as a patch', () => {
      const versioningApi = partial<VersioningApi>({
        getMajor: () => 1,
        getMinor: (version) => (version === '1.2.0' ? 2 : 3),
        isSame: () => true,
      });

      expect(
        getBucket(
          { separateMajorMinor: true, separateMinorPatch: true },
          '1.2.0',
          '1.3.0',
          versioningApi,
        ),
      ).toBe('patch');
    });

    it('separates a pvp major which its getMajor() cannot distinguish', () => {
      const pvpVersioning = allVersioning.get('pvp');

      expect(
        getBucket(
          { separateMajorMinor: true },
          '1.1.0.0',
          '1.10.0.0',
          pvpVersioning,
        ),
      ).toBe('major');
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
