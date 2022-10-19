import { extractPackageFile } from '.';

describe('modules/manager/ruby-version/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns a result', () => {
      const res = extractPackageFile('8.4.0\n');
      expect(res.deps).toEqual([
        {
          currentValue: '8.4.0',
          datasource: 'ruby-version',
          depName: 'ruby',
        },
      ]);
    });

    it('supports ranges', () => {
      const res = extractPackageFile('8.4\n');
      expect(res.deps).toEqual([
        {
          currentValue: '8.4',
          datasource: 'ruby-version',
          depName: 'ruby',
        },
      ]);
    });

    it('skips non ranges', () => {
      const res = extractPackageFile('latestn');
      expect(res.deps).toEqual([
        {
          currentValue: 'latestn',
          datasource: 'ruby-version',
          depName: 'ruby',
        },
      ]);
    });
  });
});
