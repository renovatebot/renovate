import { codeBlock } from 'common-tags';
import { fs, scm } from '~test/util.ts';
import {
  getGoModulesInTidyOrder,
  parseLocalReplacePaths,
} from './package-tree.ts';

vi.mock('../../../util/fs/index.ts');

const monorepo: Record<string, string> = {
  'shared/go.mod': codeBlock`
    module example.com/shared
  `,
  'api/go.mod': codeBlock`
    module example.com/api

    replace example.com/shared => ../shared
    replace example.com/missing => ../missing
  `,
  'cmd/go.mod': codeBlock`
    module example.com/cmd

    replace example.com/api => ../api
  `,
};

describe('modules/manager/gomod/package-tree', () => {
  describe('parseLocalReplacePaths', () => {
    it('parses single line and block replaces, ignoring remote ones', () => {
      const content = codeBlock`
        module example.com/mymodule
        go 1.21

        replace github.com/example/a => ../a
        replace github.com/example/b v1 => ./b // keep in sync
        replace github.com/example/c => github.com/fork/c v1.0.0

        replace (
            // see also foo(bar)
            github.com/example/d => ../d
            github.com/example/e => github.com/fork/e v1.0.0
        )
      `;

      expect(parseLocalReplacePaths(content)).toEqual(['../a', './b', '../d']);
    });

    it('returns empty array for content without local replaces', () => {
      expect(parseLocalReplacePaths('')).toEqual([]);
      expect(parseLocalReplacePaths('module x\nrequire y v1\n')).toEqual([]);
      expect(
        parseLocalReplacePaths('// replace example.com/a => ../a\n'),
      ).toEqual([]);
    });

    it('parses bare ../ and ./ replace paths pointing to a parent or current directory', () => {
      const content = codeBlock`
        module example.com/e2e

        replace example.com/root => ../
        replace example.com/sibling => ./
      `;

      expect(parseLocalReplacePaths(content)).toEqual(['../', './']);
    });
  });

  describe('getGoModulesInTidyOrder', () => {
    it('returns dependents in topological order, excluding the given module', async () => {
      scm.getFileList.mockResolvedValue(Object.keys(monorepo));
      fs.readLocalFile.mockImplementation((f: string) =>
        Promise.resolve(monorepo[f]),
      );

      await expect(getGoModulesInTidyOrder('shared/go.mod')).resolves.toEqual([
        'api/go.mod',
        'cmd/go.mod',
      ]);
    });

    it('returns empty array when the module has no dependents or is unknown', async () => {
      scm.getFileList.mockResolvedValue(['a/go.mod']);
      fs.readLocalFile.mockResolvedValue('module example.com/a\n');

      await expect(getGoModulesInTidyOrder('a/go.mod')).resolves.toEqual([]);
      await expect(getGoModulesInTidyOrder('nowhere/go.mod')).resolves.toEqual(
        [],
      );
    });

    it('skips go.mod files which cannot be read', async () => {
      scm.getFileList.mockResolvedValue(Object.keys(monorepo));
      fs.readLocalFile.mockResolvedValue(null);

      await expect(getGoModulesInTidyOrder('shared/go.mod')).resolves.toEqual(
        [],
      );
    });

    it('traverses bare ../ replace directives pointing to a parent module', async () => {
      const files: Record<string, string> = {
        'go.mod': 'module example.com/root\n',
        'e2e/go.mod': codeBlock`
          module example.com/e2e

          replace example.com/root => ../
        `,
      };
      scm.getFileList.mockResolvedValue(Object.keys(files));
      fs.readLocalFile.mockImplementation((f: string) =>
        Promise.resolve(files[f]),
      );

      await expect(getGoModulesInTidyOrder('go.mod')).resolves.toEqual([
        'e2e/go.mod',
      ]);
    });
  });
});
