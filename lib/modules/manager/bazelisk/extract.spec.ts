import { extractPackageFile } from './extract';

describe('modules/manager/bazelisk/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns a result', () => {
      const res = extractPackageFile('5.2.0\n');
      expect(res.deps).toEqual([
        {
          currentValue: '5.2.0',
          datasource: 'github-tags',
          depName: 'bazel',
          packageName: 'bazelbuild/bazel',
        },
      ]);
    });

    it('supports ranges', () => {
      const res = extractPackageFile('5.2\n');
      expect(res.deps).toEqual([
        {
          currentValue: '5.2',
          datasource: 'github-tags',
          depName: 'bazel',
          packageName: 'bazelbuild/bazel',
        },
      ]);
    });

    it('skips non ranges', () => {
      const res = extractPackageFile('latestn');
      expect(res.deps).toEqual([
        {
          currentValue: 'latestn',
          datasource: 'github-tags',
          depName: 'bazel',
          packageName: 'bazelbuild/bazel',
        },
      ]);
    });
  });
});
