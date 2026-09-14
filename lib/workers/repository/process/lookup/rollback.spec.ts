import { partial } from '~test/util.ts';
import type { Release } from '../../../../modules/datasource/types.ts';
import * as allVersioning from '../../../../modules/versioning/index.ts';
import type { VersioningApi } from '../../../../modules/versioning/types.ts';
import { getRollbackUpdate } from './rollback.ts';
import type { RollbackConfig } from './types.ts';

const versioning = allVersioning.get('semver');

const config: RollbackConfig = {
  packageName: 'some-dep',
  datasource: 'npm',
  currentValue: '1.5.0',
  versioning: 'semver',
};

const versions: Release[] = [
  { version: '1.0.0' },
  { version: '1.1.0' },
  { version: '1.2.0' },
];

describe('workers/repository/process/lookup/rollback', () => {
  describe('getRollbackUpdate()', () => {
    it('returns null if the versioning does not support isLessThanRange()', () => {
      const versioningApi = partial<VersioningApi>({});

      expect(getRollbackUpdate(config, versions, versioningApi)).toBeNull();
    });

    it('returns null if there is nothing to roll back to', () => {
      expect(
        getRollbackUpdate(
          { ...config, currentValue: '0.0.1' },
          versions,
          versioning,
        ),
      ).toBeNull();
    });

    it('ignores versions for which isLessThanRange() throws', () => {
      const versioningApi = partial<VersioningApi>({
        isLessThanRange: () => {
          throw new Error('isLessThanRange error');
        },
      });

      // every version is discarded by the throw, leaving nothing to roll back to
      expect(getRollbackUpdate(config, versions, versioningApi)).toBeNull();
    });
  });
});
