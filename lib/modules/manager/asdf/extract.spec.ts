import { extractPackageFile } from '.';

describe('modules/manager/asdf/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns a result', () => {
      const res = extractPackageFile('nodejs 16.16.0\n');
      expect(res).toEqual({
        deps: [
          {
            currentValue: '16.16.0',
            datasource: 'github-tags',
            depName: 'node',
            packageName: 'nodejs/node',
            versioning: 'node',
          },
        ],
      });
    });

    it('provides skipReason for lines with unsupported tooling', () => {
      const res = extractPackageFile('unsupported 1.22.5\n');
      expect(res).toEqual({
        deps: [
          {
            depName: 'unsupported',
            skipReason: 'unsupported-datasource',
          },
        ],
      });
    });

    it('only captures the first version', () => {
      const res = extractPackageFile('nodejs 16.16.0 16.15.1\n');
      expect(res).toEqual({
        deps: [
          {
            currentValue: '16.16.0',
            datasource: 'github-tags',
            depName: 'node',
            packageName: 'nodejs/node',
            versioning: 'node',
          },
        ],
      });
    });

    it('can handle multiple tools in one file', () => {
      const res = extractPackageFile('nodejs 16.16.0\ndummy 1.2.3');
      expect(res).toEqual({
        deps: [
          {
            currentValue: '16.16.0',
            datasource: 'github-tags',
            depName: 'node',
            packageName: 'nodejs/node',
            versioning: 'node',
          },
          {
            depName: 'dummy',
            skipReason: 'unsupported-datasource',
          },
        ],
      });
    });

    describe('comment handling', () => {
      const comments = [
        ' # comment with spaces',
        '# comment without leading space',
        ' #comment without trailing space',
        '#comment with no spaces',
      ];

      describe.each(comments)(
        'ignores comments at the end of lines',
        (comment) => {
          it(`comment: '${comment}'`, () => {
            const res = extractPackageFile(`nodejs 16.16.0${comment}\n`);
            expect(res).toEqual({
              deps: [
                {
                  currentValue: '16.16.0',
                  datasource: 'github-tags',
                  depName: 'node',
                  packageName: 'nodejs/node',
                  versioning: 'node',
                },
              ],
            });
          });
        }
      );

      it('ignores lines that are just comments', () => {
        const res = extractPackageFile('# this is a full line comment\n');
        expect(res).toBeNull();
      });

      it('ignores comments across multiple lines', () => {
        const res = extractPackageFile(
          '# this is a full line comment\nnodejs 16.16.0 # this is a comment\n'
        );
        expect(res).toEqual({
          deps: [
            {
              currentValue: '16.16.0',
              datasource: 'github-tags',
              depName: 'node',
              packageName: 'nodejs/node',
              versioning: 'node',
            },
          ],
        });
      });

      it('ignores supported tooling with a renovate:ignore comment', () => {
        const res = extractPackageFile('nodejs 16.16.0 # renovate:ignore\n');
        expect(res).toEqual({
          deps: [
            {
              currentValue: '16.16.0',
              datasource: 'github-tags',
              depName: 'node',
              packageName: 'nodejs/node',
              versioning: 'node',
              skipReason: 'ignored',
            },
          ],
        });
      });
    });
  });
});
