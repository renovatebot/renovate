import { parseDepName } from './dependency.ts';

describe('modules/manager/npm/extract/common/dependency', () => {
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
    // A version discriminator on the final path segment is incorrectly
    // treated as the package name instead of being stripped.
    it('incorrectly returns version discriminator instead of unscoped package name', () => {
      expect(parseDepName('resolutions', 'foo/bar@1.0.0')).toBe('1.0.0');
    });

    it('incorrectly returns version discriminator instead of package name behind scoped parent path', () => {
      expect(parseDepName('resolutions', '@cypress/request/qs@~6.14.1')).toBe(
        '~6.14.1',
      );
    });

    it('incorrectly returns plain semver instead of package name', () => {
      expect(parseDepName('resolutions', '@verdaccio/core/ajv@8.17.1')).toBe(
        '8.17.1',
      );
    });

    it('incorrectly returns version discriminator instead of scoped package name', () => {
      expect(parseDepName('resolutions', 'foo/@babel/core@7.0.0')).toBe(
        '7.0.0',
      );
    });
  });
});
