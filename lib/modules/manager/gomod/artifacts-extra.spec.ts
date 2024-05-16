import { codeBlock } from 'common-tags';
import {
  extraDepsTable,
  getExtraDeps,
  getExtraDepsNotice,
} from './artifacts-extra';
import type { ExtraDep } from './types';

describe('modules/manager/gomod/artifacts-extra', () => {
  const goModBefore = codeBlock`
    go 1.22.2

    require (
      github.com/foo/foo v1.0.0
      github.com/bar/bar v2.0.0
    )

    replace baz/baz => qux/qux
  `;

  const goModAfter = codeBlock`
    go 1.22.2

    // Note the order change
    require (
      github.com/bar/bar v2.2.2
      github.com/foo/foo v1.1.1
    )

    replace baz/baz => quux/quux
  `;

  describe('getExtraDeps', () => {
    it('detects extra dependencies', () => {
      const excludeDeps = ['github.com/foo/foo'];

      const res = getExtraDeps(goModBefore, goModAfter, excludeDeps);

      expect(res).toEqual([
        {
          depName: 'github.com/bar/bar',
          currentValue: 'v2.0.0',
          newValue: 'v2.2.2',
        },
      ] satisfies ExtraDep[]);
    });
  });

  describe('extraDepsTable', () => {
    it('generates a table', () => {
      const extraDeps: ExtraDep[] = [
        {
          depName: 'github.com/foo/foo',
          currentValue: 'v1.0.0',
          newValue: 'v1.1.1',
        },
        {
          depName: 'github.com/bar/bar',
          currentValue: 'v2.0.0',
          newValue: 'v2.2.2',
        },
      ];

      const res = extraDepsTable(extraDeps);

      expect(res).toEqual(codeBlock`
        | **Package** | **Change** |
        | ----------- | ---------- |
        | \`github.com/foo/foo\` | \`v1.0.0\` -> \`v1.1.1\` |
        | \`github.com/bar/bar\` | \`v2.0.0\` -> \`v2.2.2\` |
      `);
    });
  });

  describe('getExtraDepsNotice', () => {
    it('returns null when one of files is missing', () => {
      expect(getExtraDepsNotice(null, goModAfter, [])).toBeNull();
      expect(getExtraDepsNotice(goModBefore, null, [])).toBeNull();
    });

    it('returns null when all dependencies are excluded', () => {
      const excludeDeps = ['github.com/foo/foo', 'github.com/bar/bar'];
      const res = getExtraDepsNotice(goModBefore, goModAfter, excludeDeps);
      expect(res).toBeNull();
    });

    it('returns a notice when there are extra dependencies', () => {
      const excludeDeps = ['github.com/foo/foo'];

      const res = getExtraDepsNotice(goModBefore, goModAfter, excludeDeps);

      expect(res).toEqual(
        codeBlock`
          In addition to the dependencies listed above, the following packages will also be updated:


          | **Package** | **Change** |
          | ----------- | ---------- |
          | \`github.com/bar/bar\` | \`v2.0.0\` -> \`v2.2.2\` |
        ` + '\n\n',
      );
    });
  });
});
