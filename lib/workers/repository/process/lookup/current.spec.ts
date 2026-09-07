import type { Release } from '../../../../modules/datasource/index.ts';
import * as allVersioning from '../../../../modules/versioning/index.ts';
import { getNewestMatchingVersion, resolveCurrentVersion } from './current.ts';

const versioningApi = allVersioning.get('npm');

const releases: Release[] = [
  { version: '1.0.0' },
  { version: '1.1.0' },
  { version: '1.2.0', isDeprecated: true },
];
const allVersions = releases.map((r) => r.version);
const nonDeprecatedVersions = releases
  .filter((r) => !r.isDeprecated)
  .map((r) => r.version);

describe('workers/repository/process/lookup/current', () => {
  describe('resolveCurrentVersion()', () => {
    it('uses lockedVersion for rangeStrategy=update-lockfile', () => {
      expect(
        resolveCurrentVersion(
          '^1.0.0',
          '1.1.0',
          versioningApi,
          'update-lockfile',
          '1.1.0',
          allVersions,
          nonDeprecatedVersions,
        ),
      ).toBe('1.1.0');
    });

    it('falls back to the range lookup if there is no lockedVersion', () => {
      expect(
        resolveCurrentVersion(
          '^1.0.0',
          undefined,
          versioningApi,
          'update-lockfile',
          '1.1.0',
          allVersions,
          nonDeprecatedVersions,
        ),
      ).toBe('1.1.0');
    });

    it('uses a single currentValue which exists as a release', () => {
      expect(
        resolveCurrentVersion(
          '1.0.0',
          undefined,
          versioningApi,
          'replace',
          '1.1.0',
          allVersions,
          nonDeprecatedVersions,
        ),
      ).toBe('1.0.0');
    });

    it('prefers non-deprecated versions', () => {
      expect(
        resolveCurrentVersion(
          '^1.0.0',
          undefined,
          versioningApi,
          'replace',
          '1.2.0',
          allVersions,
          nonDeprecatedVersions,
        ),
      ).toBe('1.1.0');
    });

    it('returns undefined if no version could be resolved', () => {
      expect(
        resolveCurrentVersion(
          '^9.0.0',
          undefined,
          versioningApi,
          'replace',
          '1.1.0',
          allVersions,
          nonDeprecatedVersions,
        ),
      ).toBeUndefined();
    });
  });

  describe('getNewestMatchingVersion()', () => {
    it('returns the newest non-deprecated matching version', () => {
      expect(
        getNewestMatchingVersion('^1.0.0', versioningApi, '1.2.0', releases),
      ).toBe('1.1.0');
    });

    it('falls back to deprecated versions', () => {
      expect(
        getNewestMatchingVersion('1.2.0', versioningApi, '1.2.0', releases),
      ).toBe('1.2.0');
    });

    it('returns null if nothing matches', () => {
      expect(
        getNewestMatchingVersion('^9.0.0', versioningApi, '1.2.0', releases),
      ).toBeNull();
    });
  });
});
