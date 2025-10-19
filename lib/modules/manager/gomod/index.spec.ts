import { codeBlock } from 'common-tags';
import { mockDeep } from 'vitest-mock-extended';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { extractAllPackageFiles } from './index';
import { readLocalFile } from '../../../util/fs';
import { extractPackageFile } from './extract';
import { fs } from '~test/util';

// Mock dependencies
vi.mock('../../../util/fs');
vi.mock('./extract');

const mockReadLocalFile = vi.mocked(readLocalFile);
const mockExtractPackageFile = vi.mocked(extractPackageFile);

const adminConfig: RepoGlobalConfig = {
  localDir: '/tmp/github/some/repo',
  cacheDir: '/tmp/renovate/cache',
  containerbaseDir: '/tmp/renovate/cache/containerbase',
  dockerSidecarImage: 'ghcr.io/containerbase/sidecar',
};

const sampleGoMod = codeBlock`
  module github.com/example/project

  go 1.21

  require github.com/pkg/errors v0.7.0
`;

const sampleGoMod2 = codeBlock`
  module github.com/example/project/submodule

  go 1.21

  require github.com/pkg/errors v0.7.0
`;

describe('modules/manager/gomod/index', () => {
  beforeEach(() => {
    GlobalConfig.set(adminConfig);
    vi.clearAllMocks();
  });

  afterEach(() => {
    GlobalConfig.reset();
    // Clean up global dependency graph
    delete (globalThis as any).gomodDependencyGraph;
  });

  describe('extractAllPackageFiles', () => {
    it('returns null when no package files are provided', async () => {
      const result = await extractAllPackageFiles({}, []);

      expect(result).toBeNull();
    });

    it('returns null when all files have no content', async () => {
      mockReadLocalFile.mockResolvedValue(null);

      const result = await extractAllPackageFiles({}, [
        'go.mod',
        'submodule/go.mod',
      ]);

      expect(result).toBeNull();
      expect(mockReadLocalFile).toHaveBeenCalledTimes(2);
      expect(mockReadLocalFile).toHaveBeenCalledWith('go.mod', 'utf8');
      expect(mockReadLocalFile).toHaveBeenCalledWith(
        'submodule/go.mod',
        'utf8',
      );
    });

    it('returns null when all files fail to extract', async () => {
      mockReadLocalFile.mockImplementation((path) => {
        if (path === 'go.mod') return Promise.resolve(sampleGoMod);
        if (path === 'submodule/go.mod') return Promise.resolve(sampleGoMod2);
        return Promise.resolve(null);
      });
      mockExtractPackageFile.mockReturnValue(null);

      const result = await extractAllPackageFiles({}, [
        'go.mod',
        'submodule/go.mod',
      ]);

      expect(result).toBeNull();
      expect(mockExtractPackageFile).toHaveBeenCalledTimes(2);
      expect(mockExtractPackageFile).toHaveBeenCalledWith(sampleGoMod);
      expect(mockExtractPackageFile).toHaveBeenCalledWith(sampleGoMod2);
    });

    it('extracts package files successfully', async () => {
      mockReadLocalFile.mockImplementation((path) => {
        if (path === 'go.mod') return Promise.resolve(sampleGoMod);
        if (path === 'submodule/go.mod') return Promise.resolve(sampleGoMod2);
        return Promise.resolve(null);
      });

      mockExtractPackageFile.mockImplementation((content) => {
        if (content === sampleGoMod) {
          return {
            deps: [
              { depName: 'github.com/pkg/errors', currentValue: 'v0.7.0' },
            ],
          };
        }
        if (content === sampleGoMod2) {
          return {
            deps: [
              { depName: 'github.com/pkg/errors', currentValue: 'v0.7.0' },
            ],
          };
        }
        return null;
      });

      const result = await extractAllPackageFiles({}, [
        'go.mod',
        'submodule/go.mod',
      ]);

      expect(result).toEqual([
        {
          deps: [{ depName: 'github.com/pkg/errors', currentValue: 'v0.7.0' }],
          packageFile: 'go.mod',
        },
        {
          deps: [{ depName: 'github.com/pkg/errors', currentValue: 'v0.7.0' }],
          packageFile: 'submodule/go.mod',
        },
      ]);
    });

    it('handles mix of successful and failed extractions', async () => {
      mockReadLocalFile.mockImplementation((path) => {
        if (path === 'go.mod') return Promise.resolve(sampleGoMod);
        if (path === 'invalid/go.mod') return Promise.resolve(sampleGoMod2);
        if (path === 'empty/go.mod') return Promise.resolve(null);
        return Promise.resolve(null);
      });

      mockExtractPackageFile.mockImplementation((content) => {
        if (content === sampleGoMod) {
          return {
            deps: [
              { depName: 'github.com/pkg/errors', currentValue: 'v0.7.0' },
            ],
          };
        }
        if (content === sampleGoMod2) {
          return null; // This one fails to extract
        }
        return null;
      });

      const result = await extractAllPackageFiles({}, [
        'go.mod',
        'invalid/go.mod',
        'empty/go.mod',
      ]);

      expect(result).toEqual([
        {
          deps: [{ depName: 'github.com/pkg/errors', currentValue: 'v0.7.0' }],
          packageFile: 'go.mod',
        },
      ]);
    });

    describe('with gomodTidyAll enabled', () => {
      it('builds dependency graph when gomodTidyAll is enabled', async () => {
        mockReadLocalFile.mockResolvedValue(sampleGoMod);
        mockExtractPackageFile.mockReturnValue({
          deps: [{ depName: 'github.com/pkg/errors', currentValue: 'v0.7.0' }],
        });

        // Mock the package-tree module
        const mockBuildGoModDependencyGraph = vi.fn().mockResolvedValue({
          nodes: new Map([['go.mod', { path: 'go.mod' }]]),
          edges: [],
        });

        vi.doMock('./package-tree.js', () => ({
          buildGoModDependencyGraph: mockBuildGoModDependencyGraph,
        }));

        const result = await extractAllPackageFiles(
          { postUpdateOptions: ['gomodTidyAll'] },
          ['go.mod'],
        );

        expect(result).toEqual([
          {
            deps: [
              { depName: 'github.com/pkg/errors', currentValue: 'v0.7.0' },
            ],
            packageFile: 'go.mod',
          },
        ]);

        // Verify the dependency graph was built
        expect(mockBuildGoModDependencyGraph).toHaveBeenCalledWith(['go.mod']);
      });

      it('handles dependency graph building errors gracefully', async () => {
        mockReadLocalFile.mockResolvedValue(sampleGoMod);
        mockExtractPackageFile.mockReturnValue({
          deps: [{ depName: 'github.com/pkg/errors', currentValue: 'v0.7.0' }],
        });

        // Mock the package-tree module to throw an error
        vi.doMock('./package-tree.js', () => ({
          buildGoModDependencyGraph: vi
            .fn()
            .mockRejectedValue(new Error('Graph building failed')),
        }));

        const result = await extractAllPackageFiles(
          { postUpdateOptions: ['gomodTidyAll'] },
          ['go.mod'],
        );

        // Should still return the extracted package files despite graph error
        expect(result).toEqual([
          {
            deps: [
              { depName: 'github.com/pkg/errors', currentValue: 'v0.7.0' },
            ],
            packageFile: 'go.mod',
          },
        ]);
      });

      it('skips dependency graph building when gomodTidyAll is not enabled', async () => {
        mockReadLocalFile.mockResolvedValue(sampleGoMod);
        mockExtractPackageFile.mockReturnValue({
          deps: [{ depName: 'github.com/pkg/errors', currentValue: 'v0.7.0' }],
        });

        const result = await extractAllPackageFiles(
          { postUpdateOptions: ['otherOption'] }, // Not gomodTidyAll
          ['go.mod'],
        );

        expect(result).toEqual([
          {
            deps: [
              { depName: 'github.com/pkg/errors', currentValue: 'v0.7.0' },
            ],
            packageFile: 'go.mod',
          },
        ]);

        // The dependency graph should not be set
        expect((globalThis as any).gomodDependencyGraph).toBeUndefined();
      });
    });
  });
});
