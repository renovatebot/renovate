import { extractPackageFile } from '.';

describe('modules/manager/asdf/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns a result', () => {
      const res = extractPackageFile('nodejs 16.16.0\n');
      expect(res.deps).toEqual([
        {
          currentValue: 'nodejs 16.16.0',
          datasource: 'github-tags',
          depName: 'node',
          packageName: 'nodejs/node',
        },
      ]);
    });

    it('ignores lines with unsupported tooling', () => {
      const res = extractPackageFile('yarn 1.22.5\n');
      expect(res.deps).toEqual([]);
    });

    it('only captures the first version', () => {
      const res = extractPackageFile('nodejs 16.16.0 16.15.1\n');
      expect(res.deps).toEqual([
        {
          currentValue: 'nodejs 16.16.0',
          datasource: 'github-tags',
          depName: 'node',
          packageName: 'nodejs/node',
        },
      ]);
    });

    describe('comment handling', () => {
      it('ignores comments at the end of lines', () => {
        const res = extractPackageFile('nodejs 16.16.0 # this is a comment\n');
        expect(res.deps).toEqual([
          {
            currentValue: 'nodejs 16.16.0',
            datasource: 'github-tags',
            depName: 'node',
            packageName: 'nodejs/node',
          },
        ]);
      });

      it('ignores lines that are just comments at the end of lines', () => {
        const res = extractPackageFile('# this is a full line comment\n');
        expect(res.deps).toEqual([]);
      });

      it('ignores comments across multiple lines', () => {
        const res = extractPackageFile(
          '# this is a full line comment\nnodejs 16.16.0 # this is a comment\n'
        );
        expect(res.deps).toEqual([
          {
            currentValue: 'nodejs 16.16.0',
            datasource: 'github-tags',
            depName: 'node',
            packageName: 'nodejs/node',
          },
        ]);
      });
    });
  });
});
