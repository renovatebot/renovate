import { extractPackageFile } from '.';

describe('modules/manager/bun-version/index', () => {
  describe('extractPackageFile()', () => {
    it('returns a result', () => {
      const res = extractPackageFile('1.1.15\n');
      expect(res.deps).toEqual([
        {
          depName: 'Bun',
          packageName: 'oven-sh/bun',
          currentValue: '1.1.15',
          datasource: 'github-releases',
          extractVersion: '^bun-v(?<version>\\S+)',
          versioning: 'semver',
        },
      ]);
    });

    it('handles ranges', () => {
      const res = extractPackageFile('1.0\n');
      expect(res.deps).toEqual([
        {
          depName: 'Bun',
          packageName: 'oven-sh/bun',
          currentValue: '1.0',
          datasource: 'github-releases',
          extractVersion: '^bun-v(?<version>\\S+)',
          versioning: 'semver',
        },
      ]);
    });
  });
});
