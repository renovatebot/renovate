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

    it('returns empty array when circular reference is detected', async () => {
      scm.getFileList.mockResolvedValue(['module-a/go.mod', 'module-b/go.mod']);

      // Module A depends on Module B
      fs.readLocalFile.mockResolvedValueOnce(codeBlock`
        module github.com/renovate-tests/monorepo/module-a
        go 1.21
        require github.com/renovate-tests/monorepo/module-b v0.0.0-00010101000000-000000000000
        replace github.com/renovate-tests/monorepo/module-b => ../module-b
      `);

      // Module B depends on Module A (circular reference)
      fs.readLocalFile.mockResolvedValueOnce(codeBlock`
        module github.com/renovate-tests/monorepo/module-b
        go 1.21
        require github.com/renovate-tests/monorepo/module-a v0.0.0-00010101000000-000000000000
        replace github.com/renovate-tests/monorepo/module-a => ../module-a
      `);

      const result = await getTransitiveDependentModules('module-a/go.mod');

      // Should return empty array when circular reference is detected
      expect(result).toEqual<GoModuleFile[]>([]);
    });

    it('returns empty array when target file does not exist in repository', async () => {
      scm.getFileList.mockResolvedValue(['common/go.mod', 'service/go.mod']);

      // No file reading mocks needed since the target doesn't exist
      const result = await getTransitiveDependentModules('nonexistent/go.mod');

      // Should return empty array when the target file doesn't exist
      expect(result).toEqual<GoModuleFile[]>([]);
    });

    it('handles null content when reading go.mod file', async () => {
      scm.getFileList.mockResolvedValue(['go.mod']);

      // Mock readLocalFile to return null (file cannot be read)
      fs.readLocalFile.mockResolvedValueOnce(null);

      const result = await getTransitiveDependentModules('go.mod');

      // Should return the module itself even when content is null
      expect(result).toEqual<GoModuleFile[]>([
        { isLeaf: true, name: 'go.mod' },
      ]);
    });

    it('handles multiline replace blocks correctly', async () => {
      scm.getFileList.mockResolvedValue(['common/go.mod', 'service/go.mod']);

      // Module common
      fs.readLocalFile.mockResolvedValueOnce(codeBlock`
        module github.com/renovate-tests/monorepo/common
        go 1.21
      `);

      // Module service with multiline replace block
      fs.readLocalFile.mockResolvedValueOnce(codeBlock`
        module github.com/renovate-tests/monorepo/service
        go 1.21

        replace (
          github.com/renovate-tests/monorepo/common => ../common
          github.com/external/dep => ../external/dep
        )
      `);

      const result = await getTransitiveDependentModules('common/go.mod');

      // Should properly parse multiline replace blocks
      expect(result).toEqual<GoModuleFile[]>([
        { isLeaf: false, name: 'common/go.mod' },
        { isLeaf: true, name: 'service/go.mod' },
      ]);
    });

    it('handles multiline replace blocks with mixed formats', async () => {
      scm.getFileList.mockResolvedValue([
        'common/go.mod',
        'utils/go.mod',
        'service/go.mod',
      ]);

      // Module common
      fs.readLocalFile.mockResolvedValueOnce(codeBlock`
        module github.com/renovate-tests/monorepo/common
        go 1.21
      `);

      // Module utils
      fs.readLocalFile.mockResolvedValueOnce(codeBlock`
        module github.com/renovate-tests/monorepo/utils
        go 1.21
      `);

      // Module service with multiline replace block containing lines without 'replace' keyword
      fs.readLocalFile.mockResolvedValueOnce(codeBlock`
        module github.com/renovate-tests/monorepo/service
        go 1.21

        replace (
          github.com/renovate-tests/monorepo/common => ../common
          github.com/renovate-tests/monorepo/utils => ../utils
        )
      `);

      const result = await getTransitiveDependentModules('common/go.mod');

      // Should properly handle multiline blocks where lines don't have 'replace' keyword
      expect(result).toEqual<GoModuleFile[]>([
        { isLeaf: false, name: 'common/go.mod' },
        { isLeaf: true, name: 'service/go.mod' },
      ]);
    });
  });
});
