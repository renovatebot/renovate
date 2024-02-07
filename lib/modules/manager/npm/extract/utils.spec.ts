import { matchesAnyPattern } from './utils';

describe('modules/manager/npm/extract/utils', () => {
  describe('.matchesAnyPattern()', () => {
    it('matches package in nested directory', () => {
      const packageFile = 'packages/group/a/package.json';
      const packageFilters = ['packages/**'];

      const isPackageInWorkspace = matchesAnyPattern(
        packageFile,
        packageFilters,
      );

      expect(isPackageInWorkspace).toBeTrue();
    });

    it('matches package in non-nested directory', () => {
      const packageFile = 'non-nested-packages/a/package.json';
      const packageFilters = ['non-nested-packages/*/*'];

      const isPackageInWorkspace = matchesAnyPattern(
        packageFile,
        packageFilters,
      );

      expect(isPackageInWorkspace).toBeTrue();
    });

    it('matches package in explicitly defined directory', () => {
      const packageFile = 'solo-package/package.json';
      const packageFilters = ['solo-package/*'];

      const isPackageInWorkspace = matchesAnyPattern(
        packageFile,
        packageFilters,
      );

      expect(isPackageInWorkspace).toBeTrue();
    });
  });
});
