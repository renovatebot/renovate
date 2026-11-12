import { logger } from '~test/util.ts';
import type { Release } from '../../../../modules/datasource/types.ts';
import * as allVersioning from '../../../../modules/versioning/index.ts';
import type { NewValueConfig } from '../../../../modules/versioning/types.ts';
import { generateUpdate } from './generate.ts';
import type { LookupUpdateConfig } from './types.ts';

const versioning = allVersioning.get('semver');

const config: LookupUpdateConfig = {
  datasource: 'npm',
  packageName: 'some-dep',
  currentValue: '1.0.0',
  versioning: 'semver',
  rangeStrategy: 'replace',
};

const allVersions = new Set(['1.0.0', '1.1.0']);

function release(overrides: Partial<Release> = {}): Release {
  return { version: '1.1.0', ...overrides };
}

describe('workers/repository/process/lookup/generate', () => {
  describe('generateUpdate()', () => {
    it('copies checksumUrl, downloadUrl and newDigest from the release', async () => {
      const res = await generateUpdate(
        config,
        '1.0.0',
        versioning,
        'replace',
        '1.0.0',
        'non-major',
        release({
          checksumUrl: 'https://example.com/some-dep-1.1.0.tgz.sha256',
          downloadUrl: 'https://example.com/some-dep-1.1.0.tgz',
          newDigest: 'sha512-abc',
        }),
        allVersions,
      );

      expect(res).toMatchObject({
        checksumUrl: 'https://example.com/some-dep-1.1.0.tgz.sha256',
        downloadUrl: 'https://example.com/some-dep-1.1.0.tgz',
        newDigest: 'sha512-abc',
        newValue: '1.1.0',
        newVersion: '1.1.0',
      });
    });

    it('omits checksumUrl, downloadUrl and newDigest when the release has none', async () => {
      const res = await generateUpdate(
        config,
        '1.0.0',
        versioning,
        'replace',
        '1.0.0',
        'non-major',
        release(),
        allVersions,
      );

      expect(res).not.toHaveProperty('checksumUrl');
      expect(res).not.toHaveProperty('downloadUrl');
      expect(res).not.toHaveProperty('newDigest');
    });

    it('falls back to the current value when getNewValue throws', async () => {
      const throwingVersioning = {
        ...versioning,
        getNewValue: (): string => {
          throw new Error('getNewValue error');
        },
      };

      const res = await generateUpdate(
        config,
        '^1.0.0',
        throwingVersioning,
        'replace',
        '1.0.0',
        'non-major',
        release(),
        allVersions,
      );

      expect(res.newValue).toBe('^1.0.0');
    });

    it('keeps the update-lockfile value for a vulnerability alert when bump has none', async () => {
      const npmVersioning = allVersioning.get('npm');
      const noBumpVersioning = {
        ...npmVersioning,
        getNewValue: (newValueConfig: NewValueConfig): string | null =>
          newValueConfig.rangeStrategy === 'bump'
            ? null
            : npmVersioning.getNewValue(newValueConfig),
      };

      const res = await generateUpdate(
        { ...config, isVulnerabilityAlert: true },
        '^1.0.0',
        noBumpVersioning,
        'update-lockfile',
        '1.0.0',
        'major',
        release({ version: '2.0.1' }),
        allVersions,
      );

      expect(res.newValue).toBe('^2.0.0');
    });

    it('keeps the update-lockfile value for a vulnerability alert when bump throws', async () => {
      const npmVersioning = allVersioning.get('npm');
      const throwingBumpVersioning = {
        ...npmVersioning,
        getNewValue: (newValueConfig: NewValueConfig): string | null => {
          if (newValueConfig.rangeStrategy === 'bump') {
            throw new Error('getNewValue error');
          }
          return npmVersioning.getNewValue(newValueConfig);
        },
      };

      const res = await generateUpdate(
        { ...config, isVulnerabilityAlert: true },
        '^1.0.0',
        throwingBumpVersioning,
        'update-lockfile',
        '1.0.0',
        'major',
        release({ version: '2.0.1' }),
        allVersions,
      );

      expect(res.newValue).toBe('^2.0.0');
      expect(res.isLockfileUpdate).toBeUndefined();
      expect(logger.logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ newVersion: '2.0.1' }),
        'Could not bump the range for a vulnerability fix',
      );
    });

    it('returns early when there is no current version', async () => {
      const res = await generateUpdate(
        config,
        undefined,
        versioning,
        'replace',
        '',
        'non-major',
        release(),
        allVersions,
      );

      expect(res).toMatchObject({
        bucket: 'non-major',
        newVersion: '1.1.0',
      });
      expect(res.updateType).toBeUndefined();
    });
  });
});
