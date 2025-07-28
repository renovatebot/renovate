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
        module github.com/renovate-tests/single-project
        go 1.21
      `);

      const result = await getTransitiveDependentModules('go.mod');

      expect(result).toEqual<GoModuleFile[]>([
        { isLeaf: true, name: 'go.mod' },
      ]);
    });

    it('returns modules in dependency order (dependencies before dependents)', async () => {
      scm.getFileList.mockResolvedValue(['common/go.mod', 'service/go.mod']);

      // Module common - no local dependencies
      fs.readLocalFile.mockResolvedValueOnce(codeBlock`
        module github.com/renovate-tests/monorepo/common
        go 1.21
        require go.uber.org/zap v1.19.0
      `);

      // Module service - depends on common via replace
      fs.readLocalFile.mockResolvedValueOnce(codeBlock`
        module github.com/renovate-tests/monorepo/service
        go 1.21
        require (
          github.com/renovate-tests/monorepo/common v0.0.0-00010101000000-000000000000
          go.uber.org/multierr v1.5.0 // indirect
        )
        replace github.com/renovate-tests/monorepo/common => ../common
      `);

      const result = await getTransitiveDependentModules('common/go.mod');

      // Should return common first (dependency), then service (dependent)
      expect(result).toEqual<GoModuleFile[]>([
        { isLeaf: false, name: 'common/go.mod' },
        { isLeaf: true, name: 'service/go.mod' },
      ]);
    });

    it('returns leaf module only for leaf nodes', async () => {
      scm.getFileList.mockResolvedValue(['common/go.mod', 'service/go.mod']);

      // Module common
      fs.readLocalFile.mockResolvedValueOnce(codeBlock`
        module github.com/renovate-tests/monorepo/common
        go 1.21
      `);

      // Module service - depends on common via replace
      fs.readLocalFile.mockResolvedValueOnce(codeBlock`
        module github.com/renovate-tests/monorepo/service
        go 1.21
        replace github.com/renovate-tests/monorepo/common => ../common
      `);

      // Query for leaf module service
      const result = await getTransitiveDependentModules('service/go.mod');

      expect(result).toEqual<GoModuleFile[]>([
        { isLeaf: true, name: 'service/go.mod' },
      ]);
    });

    it('handles complex dependency chains', async () => {
      scm.getFileList.mockResolvedValue([
        'common/go.mod',
        'service/go.mod',
        'api/go.mod',
      ]);

      // Common module
      fs.readLocalFile.mockResolvedValueOnce(codeBlock`
        module github.com/renovate-tests/monorepo/common
        go 1.21
        require github.com/external/dep v1.0.0
      `);

      // Service depends on common
      fs.readLocalFile.mockResolvedValueOnce(codeBlock`
        module github.com/renovate-tests/monorepo/service
        go 1.21
        replace github.com/renovate-tests/monorepo/common => ../common
      `);

      // API depends on service
      fs.readLocalFile.mockResolvedValueOnce(codeBlock`
        module github.com/renovate-tests/monorepo/api
        go 1.21
        require github.com/renovate-tests/monorepo/service v0.0.0-00010101000000-000000000000
        replace github.com/renovate-tests/monorepo/service => ../service
      `);

      const result = await getTransitiveDependentModules('common/go.mod');

      // Should return common → service → api (dependency order)
      expect(result).toEqual<GoModuleFile[]>([
        { isLeaf: false, name: 'common/go.mod' },
        { isLeaf: false, name: 'service/go.mod' },
        { isLeaf: true, name: 'api/go.mod' },
      ]);
    });
  });
});
