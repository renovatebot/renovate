import { extractPackageFile } from '.';

describe('modules/manager/bun-version/index', () => {
  describe('extractPackageFile()', () => {
    it('returns a result', () => {
      const res = extractPackageFile('1.1.15\n');
      expect(res?.deps).toEqual([
        {
          depName: 'Bun',
          packageName: 'oven-sh/bun',
          currentValue: '1.1.15',
          datasource: 'github-releases',
          extractVersion: '^bun-v(?<version>\\S+)',
          versioning: 'semver-coerced',
        },
      ]);
    });

    it('handles empty files', () => {
      const res = extractPackageFile('');
      expect(res).toBeNull();
    });

    it('handles no newline at the end', () => {
      const res = extractPackageFile('1.1.15');
      expect(res).toBeNull();
    });

    it('handles multiple lines', () => {
      const res = extractPackageFile('1.1.15\n1.1.16\n');
      expect(res).toBeNull();
    });

    it('handles invalid versions', () => {
      const res = extractPackageFile('notaversion\n');
      expect(res?.deps).toEqual([
        {
          depName: 'Bun',
          packageName: 'oven-sh/bun',
          currentValue: 'notaversion',
          datasource: 'github-releases',
          extractVersion: '^bun-v(?<version>\\S+)',
          versioning: 'semver-coerced',
          skipReason: 'invalid-version',
        },
      ]);
    });

    it('handles ranges', () => {
      const res = extractPackageFile('1.0\n');
      expect(res?.deps).toEqual([
        {
          depName: 'Bun',
          packageName: 'oven-sh/bun',
          currentValue: '1.0',
          datasource: 'github-releases',
          extractVersion: '^bun-v(?<version>\\S+)',
          versioning: 'semver-coerced',
        },
      ]);
    });
  });
});
