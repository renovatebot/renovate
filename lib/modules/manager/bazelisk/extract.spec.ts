import { extractPackageFile } from '.';

describe('modules/manager/bazelisk/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns a result', () => {
      const res = extractPackageFile('5.2.0\n');
      expect(res.deps).toEqual([
        {
          currentValue: '5.2.0',
          datasource: 'github-releases',
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
          datasource: 'github-releases',
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
          datasource: 'github-releases',
          depName: 'bazel',
          packageName: 'bazelbuild/bazel',
        },
      ]);
    });

    it('ignores comments past the first line', () => {
      const res = extractPackageFile('5.2.0\n# comment1\n\n# comment2');
      expect(res.deps).toEqual([
        {
          currentValue: '5.2.0',
          datasource: 'github-releases',
          depName: 'bazel',
          packageName: 'bazelbuild/bazel',
        },
      ]);
    });
  });
});
