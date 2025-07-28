import { codeBlock } from 'common-tags';
import { mockDeep } from 'vitest-mock-extended';
import type { GoModuleFile } from './package-tree';
import { getTransitiveDependentModules } from './package-tree';
import { fs, scm } from '~test/util';

type FS = typeof import('../../../util/fs');

vi.mock('../../../util/fs', async () => {
  return mockDeep({
    isValidLocalPath: (await vi.importActual<FS>('../../../util/fs'))
      .isValidLocalPath,
  });
});

describe('modules/manager/gomod/package-tree', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('getTransitiveDependentModules', () => {
    it('returns self for single project', async () => {
      scm.getFileList.mockResolvedValue(['go.mod']);
      fs.readLocalFile.mockResolvedValueOnce(codeBlock`
        module test/project
        go 1.21
      `);

      const result = await getTransitiveDependentModules('go.mod');

      expect(result).toEqual<GoModuleFile[]>([
        { isLeaf: true, name: 'go.mod' },
      ]);
    });

    it('returns modules in dependency order (dependencies before dependents)', async () => {
      scm.getFileList.mockResolvedValue(['a/go.mod', 'b/go.mod']);

      // Module A - no local dependencies
      fs.readLocalFile.mockResolvedValueOnce(codeBlock`
        module monorepo/a
        go 1.21
        require go.uber.org/zap v1.19.0
      `);

      // Module B - depends on A via replace
      fs.readLocalFile.mockResolvedValueOnce(codeBlock`
        module monorepo/b
        go 1.21
        require (
          monorepo/a v0.0.0-00010101000000-000000000000
          go.uber.org/multierr v1.5.0 // indirect
        )
        replace monorepo/a => ../a
      `);

      const result = await getTransitiveDependentModules('a/go.mod');

      // Should return A first (dependency), then B (dependent)
      expect(result).toEqual<GoModuleFile[]>([
        { isLeaf: false, name: 'a/go.mod' },
        { isLeaf: true, name: 'b/go.mod' },
      ]);
    });

    it('handles complex dependency chains', async () => {
      scm.getFileList.mockResolvedValue([
        'root/go.mod',
        'shared/go.mod',
        'api/go.mod',
      ]);

      // Root module
      fs.readLocalFile.mockResolvedValueOnce(codeBlock`
        module monorepo/root
        go 1.21
        require github.com/external/dep v1.0.0
      `);

      // Shared depends on root
      fs.readLocalFile.mockResolvedValueOnce(codeBlock`
        module monorepo/shared
        go 1.21
        require monorepo/root v0.0.0-00010101000000-000000000000
        replace monorepo/root => ../root
      `);

      // API depends on shared
      fs.readLocalFile.mockResolvedValueOnce(codeBlock`
        module monorepo/api
        go 1.21
        require monorepo/shared v0.0.0-00010101000000-000000000000
        replace monorepo/shared => ../shared
      `);

      const result = await getTransitiveDependentModules('root/go.mod');

      // Should return root → shared → api (dependency order)
      expect(result).toEqual<GoModuleFile[]>([
        { isLeaf: false, name: 'root/go.mod' },
        { isLeaf: false, name: 'shared/go.mod' },
        { isLeaf: true, name: 'api/go.mod' },
      ]);
    });

    it('returns leaf module only for leaf nodes', async () => {
      scm.getFileList.mockResolvedValue(['a/go.mod', 'b/go.mod']);

      // Module A
      fs.readLocalFile.mockResolvedValueOnce(codeBlock`
        module monorepo/a
        go 1.21
      `);

      // Module B depends on A
      fs.readLocalFile.mockResolvedValueOnce(codeBlock`
        module monorepo/b
        go 1.21
        require monorepo/a v0.0.0-00010101000000-000000000000
        replace monorepo/a => ../a
      `);

      // Query for leaf module B
      const result = await getTransitiveDependentModules('b/go.mod');

      expect(result).toEqual<GoModuleFile[]>([
        { isLeaf: true, name: 'b/go.mod' },
      ]);
    });
  });
});
