import type { Release } from '../../../../modules/datasource/index.ts';
import * as allVersioning from '../../../../modules/versioning/index.ts';
import {
  getCurrentVersion,
  getNewestMatchingVersion,
  resolveCurrentVersion,
} from './current.ts';

const versioningApi = allVersioning.get('npm');

const releases: Release[] = [
  { version: '1.0.0' },
  { version: '1.1.0' },
  { version: '1.2.0', isDeprecated: true },
];

describe('workers/repository/process/lookup/current', () => {
  describe('getCurrentVersion()', () => {
    it('returns null if the current value is not a string', () => {
      expect(
        getCurrentVersion(
          // the config is not always well-formed, so this is guarded at runtime
          null as unknown as string,
          '1.0.0',
          versioningApi,
          'replace',
          '1.1.0',
          ['1.0.0', '1.1.0'],
        ),
      ).toBeNull();
    });
  });

  describe('resolveCurrentVersion()', () => {
    it('uses lockedVersion for rangeStrategy=update-lockfile', () => {
      expect(
        resolveCurrentVersion(
          '^1.0.0',
          '1.1.0',
          versioningApi,
          'update-lockfile',
          '1.1.0',
          releases,
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
          releases,
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
          releases,
        ),
      ).toBe('1.0.0');
    });

    it('uses a deprecated currentValue version which exists as a release', () => {
      expect(
        resolveCurrentVersion(
          '8.0.9',
          undefined,
          allVersioning.get('nuget'),
          'bump',
          '8.0.11',
          [{ version: '8.0.9', isDeprecated: true }, { version: '8.0.11' }],
        ),
      ).toBe('8.0.9');
    });

    it('does not use a range currentValue which exists as a release', () => {
      expect(
        resolveCurrentVersion(
          'v8',
          undefined,
          allVersioning.get('github-actions'),
          'pin',
          'v8.0.1',
          [{ version: 'v8.0.1' }, { version: 'v8' }],
        ),
      ).toBe('v8.0.1');
    });

    it('prefers non-deprecated versions', () => {
      expect(
        resolveCurrentVersion(
          '^1.0.0',
          undefined,
          versioningApi,
          'replace',
          '1.2.0',
          releases,
        ),
      ).toBe('1.1.0');
    });

    it('falls back to deprecated versions', () => {
      expect(
        resolveCurrentVersion(
          '^1.2.0',
          undefined,
          versioningApi,
          'replace',
          '1.2.0',
          releases,
        ),
      ).toBe('1.2.0');
    });

    it('returns undefined if no version could be resolved', () => {
      expect(
        resolveCurrentVersion(
          '^9.0.0',
          undefined,
          versioningApi,
          'replace',
          '1.1.0',
          releases,
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
