import * as dockerVersioning from '../../../../modules/versioning/docker';
import * as semverVersioning from '../../../../modules/versioning/semver';
import { getCurrentVersion } from './current';

describe('workers/repository/process/lookup/current', () => {
  describe('getCurrentVersion', () => {
    const semver = semverVersioning.api;
    const docker = dockerVersioning.api;

    it('returns null when currentValue is not a string', () => {
      expect(
        getCurrentVersion(null as any, '', semver, 'replace', '', []),
      ).toBeNull();
    });

    it('returns exact match from allVersions', () => {
      expect(
        getCurrentVersion('1.0.0', '', semver, 'replace', '', [
          '1.0.0',
          '1.1.0',
          '2.0.0',
        ]),
      ).toBe('1.0.0');
    });

    it('filters versions greater than latestVersion', () => {
      expect(
        getCurrentVersion('1.x', '', semver, 'replace', '1.8.0', [
          '1.3.0',
          '1.5.0',
          '1.8.0',
          '2.0.0',
        ]),
      ).toBe('1.8.0');
    });

    it('returns locked version for pin strategy', () => {
      expect(
        getCurrentVersion('1.x', '1.3.0', semver, 'pin', '', [
          '1.3.0',
          '1.5.0',
          '1.8.0',
        ]),
      ).toBe('1.3.0');
    });

    it('returns satisfying version for pin strategy when no locked version', () => {
      expect(
        getCurrentVersion('1.x', '', semver, 'pin', '', [
          '1.3.0',
          '1.5.0',
          '1.8.0',
        ]),
      ).toBe('1.8.0');
    });

    it('returns min satisfying version for bump strategy', () => {
      expect(
        getCurrentVersion('1.x', '', semver, 'bump', '', [
          '1.3.0',
          '1.5.0',
          '1.8.0',
        ]),
      ).toBe('1.3.0');
    });

    it('returns satisfying version for replace strategy', () => {
      expect(
        getCurrentVersion('1.x', '', semver, 'replace', '', [
          '1.3.0',
          '1.5.0',
          '1.8.0',
        ]),
      ).toBe('1.8.0');
    });

    it('returns currentValue when it is a valid version and no satisfying version found', () => {
      expect(
        getCurrentVersion('1.4.0', '', semver, 'replace', '', [
          '1.3.0',
          '1.5.0',
          '1.8.0',
        ]),
      ).toBe('1.4.0');
    });

    it('returns cleaned single version when no satisfying version found', () => {
      // Using a custom versioning that recognizes =1.4.0 as a single version
      const customVersioning = {
        ...semver,
        isSingleVersion: (version: string) => version.startsWith('='),
      };

      expect(
        getCurrentVersion('=1.4.0', '', customVersioning, 'replace', '', [
          '1.3.0',
          '1.5.0',
          '1.8.0',
        ]),
      ).toBe('1.4.0');
    });

    it('returns null when no satisfying version and currentValue is not a version', () => {
      expect(
        getCurrentVersion('latest', '', semver, 'replace', '', [
          '1.3.0',
          '1.5.0',
          '1.8.0',
        ]),
      ).toBeNull();
    });

    // Docker versioning specific tests
    describe('docker versioning', () => {
      it('handles exact match with docker versioning', () => {
        expect(
          getCurrentVersion('1.0.0', '', docker, 'replace', '', [
            '1.0.0',
            '1.1.0',
            '2.0.0',
          ]),
        ).toBe('1.0.0');
      });

      it('handles prefixed versions', () => {
        expect(
          getCurrentVersion('v1.0.0', '', docker, 'replace', '', [
            'v1.0.0',
            'v1.1.0',
            'v2.0.0',
          ]),
        ).toBe('v1.0.0');
      });

      it('returns currentValue when not in allVersions for docker', () => {
        expect(
          getCurrentVersion('1.0.0-alpine', '', docker, 'replace', '', [
            '1.0.0',
            '1.1.0',
            '2.0.0',
          ]),
        ).toBe('1.0.0-alpine');
      });

      it('handles docker tags with multiple parts', () => {
        expect(
          getCurrentVersion('1.0.0-alpine3.10', '', docker, 'replace', '', [
            '1.0.0-alpine3.9',
            '1.0.0-alpine3.10',
            '1.0.0-alpine3.11',
          ]),
        ).toBe('1.0.0-alpine3.10');
      });
    });
  });
});
