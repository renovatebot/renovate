import { extractPackageFile } from '.';

describe('modules/manager/nvm/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns a result', () => {
      const res = extractPackageFile('8.4.0\n');
      expect(res.deps).toEqual([
        {
          currentValue: '8.4.0',
          datasource: 'node-version',
          depName: 'node',
        },
      ]);
    });

    it('supports ranges', () => {
      const res = extractPackageFile('8.4\n');
      expect(res.deps).toEqual([
        {
          currentValue: '8.4',
          datasource: 'node-version',
          depName: 'node',
        },
      ]);
    });

    it('skips non ranges', () => {
      const res = extractPackageFile('latest\n');
      expect(res.deps).toEqual([
        {
          currentValue: 'latest',
          datasource: 'node-version',
          depName: 'node',
        },
      ]);
    });

    it('supports code comments', () => {
      const res = extractPackageFile(
        '# This is a comment\nv20.19.3 # This is an inline comment\n# This is another comment',
      );
      expect(res.deps).toEqual([
        {
          currentValue: 'v20.19.3',
          datasource: 'node-version',
          depName: 'node',
        },
      ]);
    });
  });
});
