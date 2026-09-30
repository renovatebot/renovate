import type { PackageDependency } from '../../../types.ts';
import { getExtractedConstraints, parseDepName } from './dependency.ts';

describe('modules/manager/npm/extract/common/dependency', () => {
  describe('getExtractedConstraints', () => {
    it('returns empty object when no deps and no devEngines are given', () => {
      expect(getExtractedConstraints([])).toEqual({});
    });

    it('extracts a single devEngines.runtime object', () => {
      expect(
        getExtractedConstraints([], {
          runtime: { name: 'bun', version: '1.4.0' },
        }),
      ).toEqual({ bun: '1.4.0' });
    });

    it('extracts an array of devEngines.runtime entries', () => {
      expect(
        getExtractedConstraints([], {
          runtime: [
            { name: 'node', version: '20.0.0' },
            { name: 'bun', version: '1.4.0' },
          ],
        }),
      ).toEqual({ node: '20.0.0', bun: '1.4.0' });
    });

    it('prefers devEngines.runtime over engines for the same tool', () => {
      const deps: PackageDependency[] = [
        { depType: 'engines', depName: 'node', currentValue: '18.0.0' },
      ];
      expect(
        getExtractedConstraints(deps, {
          runtime: { name: 'node', version: '20.0.0' },
        }),
      ).toEqual({ node: '20.0.0' });
    });

    it('ignores devEngines.runtime entries with an unknown name', () => {
      expect(
        getExtractedConstraints([], {
          runtime: { name: 'deno', version: '1.0.0' },
        }),
      ).toEqual({});
    });

    it('ignores devEngines.runtime entries with a missing version', () => {
      expect(
        getExtractedConstraints([], {
          runtime: { name: 'bun' },
        }),
      ).toEqual({});
    });

    it('ignores null devEngines.runtime array entries', () => {
      expect(
        getExtractedConstraints([], {
          runtime: [null as never, { name: 'bun', version: '1.2.0' }],
        }),
      ).toEqual({ bun: '1.2.0' });
    });
  });

  describe('parseDepName', () => {
    it('returns key unchanged for non-resolutions depTypes', () => {
      expect(parseDepName('dependencies', '@cypress/request/qs@~6.14.1')).toBe(
        '@cypress/request/qs@~6.14.1',
      );
    });

    it('returns simple package name unchanged', () => {
      expect(parseDepName('resolutions', 'left-pad')).toBe('left-pad');
    });

    it('returns scoped package name unchanged', () => {
      expect(parseDepName('resolutions', '@angular/cli')).toBe('@angular/cli');
    });

    it('extracts child package name from nested path', () => {
      expect(parseDepName('resolutions', 'config/glob')).toBe('glob');
    });

    it('extracts child package name from wildcard nested path', () => {
      expect(parseDepName('resolutions', '**/config')).toBe('config');
    });

    it('extracts scoped child package name from wildcard nested path', () => {
      expect(parseDepName('resolutions', '**/@angular/cli')).toBe(
        '@angular/cli',
      );
    });

    // https://github.com/renovatebot/renovate/discussions/44768
    it('strips version discriminator from unscoped final segment', () => {
      expect(parseDepName('resolutions', 'foo/bar@1.0.0')).toBe('bar');
    });

    it('strips version discriminator from scoped parent path', () => {
      expect(parseDepName('resolutions', '@cypress/request/qs@~6.14.1')).toBe(
        'qs',
      );
    });

    it('strips version discriminator with plain semver final segment', () => {
      expect(parseDepName('resolutions', '@verdaccio/core/ajv@8.17.1')).toBe(
        'ajv',
      );
    });

    it('strips version discriminator when final segment is itself scoped', () => {
      expect(parseDepName('resolutions', 'foo/@babel/core@7.0.0')).toBe(
        '@babel/core',
      );
    });
  });
});
