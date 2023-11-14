import { logger } from '../../../test/util';
import { defaultVersioning } from '../versioning';
import {
  applyConstraintsFiltering,
  applyExtractVersion,
  applyVersionCompatibility,
  filterValidVersions,
  getDatasourceFor,
  getDefaultVersioning,
  isGetPkgReleasesConfig,
  sortAndRemoveDuplicates,
} from './common';
import { CustomDatasource } from './custom';
import { NpmDatasource } from './npm';
import type { ReleaseResult } from './types';

describe('modules/datasource/common', () => {
  describe('getDatasourceFor', () => {
    it('returns null for unknown datasource', () => {
      expect(getDatasourceFor('foobar')).toBeNull();
    });

    it('supports custom datasource', () => {
      expect(getDatasourceFor('custom.foobar')).toEqual(
        getDatasourceFor(CustomDatasource.id),
      );
    });

    it('returns datasource for known datasource', () => {
      expect(getDatasourceFor('npm')).toMatchObject({
        id: NpmDatasource.id,
      });
    });
  });

  describe('getDefaultVersioning', () => {
    it('returns default versioning for undefined datasource', () => {
      expect(getDefaultVersioning(undefined)).toBe(defaultVersioning.id);
    });

    it('returns default versioning for unknown datasource', () => {
      expect(getDefaultVersioning('foobar')).toBe(defaultVersioning.id);
      expect(logger.logger.warn).toHaveBeenCalledWith(
        { datasourceName: 'foobar' },
        'Missing datasource!',
      );
    });

    it('returns default versioning for datasource with missing default versioning configuration', () => {
      expect(getDefaultVersioning('artifactory')).toBe(defaultVersioning.id);
    });

    it('returns datasource-defined default versioning', () => {
      expect(getDefaultVersioning('crate')).toBe('cargo');
    });
  });

  describe('isGetPkgReleasesConfig', () => {
    it('returns true for valid input', () => {
      const input = {
        datasource: 'npm',
        packageName: 'lodash',
      };
      expect(isGetPkgReleasesConfig(input)).toBe(true);
    });

    it('returns false for invalid input', () => {
      const input = {
        datasource: '',
        packageName: 'lodash',
      };
      expect(isGetPkgReleasesConfig(input)).toBe(false);
    });

    it('returns false for input with missing properties', () => {
      const input = {
        datasource: 'npm',
      };
      expect(isGetPkgReleasesConfig(input)).toBe(false);
    });

    it('returns false for input with non-string properties', () => {
      const input = {
        datasource: 123,
        packageName: 'lodash',
      };
      expect(isGetPkgReleasesConfig(input)).toBe(false);
    });
  });

  describe('applyExtractVersion', () => {
    it('should return the same release result if extractVersion is not defined', () => {
      const releaseResult: ReleaseResult = {
        releases: [{ version: '1.0.0' }, { version: '2.0.0' }],
      };
      const res = applyExtractVersion(releaseResult, undefined);
      expect(res).toBe(releaseResult);
    });

    it('should extract version from release using provided regex', () => {
      const releaseResult: ReleaseResult = {
        releases: [{ version: 'v1.0.0' }, { version: 'v2.0.0' }],
      };
      const res = applyExtractVersion(releaseResult, '^v(?<version>.+)$');
      expect(res).toEqual({
        releases: [{ version: '1.0.0' }, { version: '2.0.0' }],
      });
    });

    it('should return null for releases with invalid version', () => {
      const releaseResult: ReleaseResult = {
        releases: [{ version: 'v1.0.0' }, { version: 'invalid' }],
      };
      const result = applyExtractVersion(releaseResult, '^v(?<version>.+)$');
      expect(result).toEqual({
        releases: [{ version: '1.0.0' }],
      });
    });
  });

  describe('filterValidVersions', () => {
    const releaseResult: ReleaseResult = {
      releases: [
        { version: '1.0.0' },
        { version: '2.0.0' },
        { version: 'invalid' },
      ],
    };

    it('should filter out invalid versions', () => {
      const config = { datasource: 'npm' };
      const res = filterValidVersions(releaseResult, config);
      expect(res).toEqual({
        releases: [{ version: '1.0.0' }, { version: '2.0.0' }],
      });
    });

    it('should use default versioning if none is specified', () => {
      const config = { datasource: 'foobar' };
      const res = filterValidVersions(releaseResult, config);
      expect(res).toEqual({
        releases: [{ version: '1.0.0' }, { version: '2.0.0' }],
      });
    });

    it('should use specified versioning if provided', () => {
      const config = { datasource: 'npm', versioning: 'semver' };
      const res = filterValidVersions(releaseResult, config);
      expect(res).toEqual({
        releases: [{ version: '1.0.0' }, { version: '2.0.0' }],
      });
    });
  });

  describe('sortAndRemoveDuplicates', () => {
    it('sorts releases by version and removes duplicates', () => {
      const config = { datasource: 'npm' };
      const releaseResult: ReleaseResult = {
        releases: [
          { version: '2.0.0' },
          { version: '1.0.0' },
          { version: '1.0.0' },
          { version: '3.0.0' },
        ],
      };
      const expected: ReleaseResult = {
        releases: [
          { version: '1.0.0' },
          { version: '2.0.0' },
          { version: '3.0.0' },
        ],
      };
      const result = sortAndRemoveDuplicates(releaseResult, config);
      expect(result).toEqual(expected);
    });

    it('uses default versioning if none is specified', () => {
      const config = { datasource: 'foobar' };
      const releaseResult: ReleaseResult = {
        releases: [{ version: '1.0.0' }, { version: '2.0.0' }],
      };
      const result = sortAndRemoveDuplicates(releaseResult, config);
      expect(result).toEqual({
        releases: [{ version: '1.0.0' }, { version: '2.0.0' }],
      });
      expect(logger.logger.warn).toHaveBeenCalledWith(
        { datasourceName: 'foobar' },
        'Missing datasource!',
      );
    });
  });

  describe('applyConstraintsFiltering', () => {
    it('should remove constraints from releases if constraintsFiltering is not strict', () => {
      const config = {
        datasource: 'foo',
        packageName: 'bar',
        constraintsFiltering: 'none' as const,
      };
      const releaseResult: ReleaseResult = {
        releases: [
          { version: '1.0.0', constraints: { foo: ['^1.0.0'] } },
          { version: '2.0.0', constraints: { foo: ['^2.0.0'] } },
        ],
      };
      expect(applyConstraintsFiltering(releaseResult, config)).toEqual({
        releases: [{ version: '1.0.0' }, { version: '2.0.0' }],
      });
    });

    it('should filter releases based on constraints if constraintsFiltering is strict', () => {
      const config = {
        datasource: 'foo',
        packageName: 'bar',
        constraintsFiltering: 'strict' as const,
        constraints: { baz: '^1.0.0', qux: 'invalid' },
      };
      const releaseResult = {
        releases: [
          { version: '1.0.0' },
          { version: '2.0.0', constraints: {} as never },
          { version: '3.0.0', constraints: { baz: ['^0.9.0'] } },
        ],
      };
      expect(applyConstraintsFiltering(releaseResult, config)).toEqual({
        releases: [{ version: '1.0.0' }, { version: '2.0.0' }],
      });
    });
  });

  describe('applyVersionCompatibility', () => {
    let input: ReleaseResult;

    beforeEach(() => {
      input = {
        releases: [
          { version: '1.0.0' },
          { version: '2.0.0' },
          { version: '2.0.0-alpine' },
        ],
      };
    });

    it('returns immediately if no versionCompatibility', () => {
      const result = applyVersionCompatibility(input, undefined, undefined);
      expect(result).toBe(input);
    });

    it('filters out non-matching', () => {
      const versionCompatibility = '^(?<version>[^-]+)$';
      expect(
        applyVersionCompatibility(input, versionCompatibility, undefined),
      ).toMatchObject({
        releases: [{ version: '1.0.0' }, { version: '2.0.0' }],
      });
    });

    it('filters out incompatible', () => {
      const versionCompatibility = '^(?<version>[^-]+)(?<compatibility>.*)?$';
      expect(
        applyVersionCompatibility(input, versionCompatibility, '-alpine'),
      ).toMatchObject({
        releases: [{ version: '2.0.0' }],
      });
    });
  });
});
