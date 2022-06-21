import { extractPackageFile } from '.';

describe('modules/manager/nvm/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns a result', () => {
      const res = extractPackageFile('8.4.0\n');
      expect(res.deps).toEqual([
        {
          currentValue: '8.4.0',
          datasource: 'github-tags',
          depName: 'node',
          packageName: 'nodejs/node',
        },
      ]);
    });

    it('supports ranges', () => {
      const res = extractPackageFile('8.4\n');
      expect(res.deps).toEqual([
        {
          currentValue: '8.4',
          datasource: 'github-tags',
          depName: 'node',
          packageName: 'nodejs/node',
        },
      ]);
    });

    it('skips non ranges', () => {
      const res = extractPackageFile('latestn');
      expect(res.deps).toEqual([
        {
          currentValue: 'latestn',
          datasource: 'github-tags',
          depName: 'node',
          packageName: 'nodejs/node',
        },
      ]);
    });
  });
});
