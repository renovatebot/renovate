import { extractPackageFile } from '.';

describe('modules/manager/rust/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns a result', () => {
      const res = extractPackageFile('182.0.0\n');
      expect(res.deps).toEqual([
        {
          currentValue: '182.0.0',
          datasource: 'github-releases',
          depName: 'rust',
          packageName: 'rust-lang/rust',
        },
      ]);
    });
  });
});
