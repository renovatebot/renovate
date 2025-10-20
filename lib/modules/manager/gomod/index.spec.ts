import { codeBlock } from 'common-tags';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { readLocalFile } from '../../../util/fs';
import { extractPackageFile } from './extract';
import { extractAllPackageFiles } from './index';

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

const defaultExtractConfig = {
  skipInstalls: null,
} satisfies ExtractConfig;

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
      const result = await extractAllPackageFiles(defaultExtractConfig, []);

      expect(result).toBeNull();
    });

    it('returns null when all files have no content', async () => {
      mockReadLocalFile.mockResolvedValue(null);

      const result = await extractAllPackageFiles(defaultExtractConfig, [
        'go.mod',
        'submodule/go.mod',
      ]);

      expect(result).toBeNull();
      expect(mockReadLocalFile).toHaveBeenCalledTimes(2);
      expect(mockReadLocalFile).toHaveBeenNthCalledWith(1, 'go.mod', 'utf8');
      expect(mockReadLocalFile).toHaveBeenNthCalledWith(
        2,
        'submodule/go.mod',
        'utf8',
      );
    });

    it('returns null when all files fail to extract', async () => {
      mockReadLocalFile.mockImplementation((path) => {
        if (path === 'go.mod') {
          return Promise.resolve(sampleGoMod);
        }
        if (path === 'submodule/go.mod') {
          return Promise.resolve(sampleGoMod2);
        }
        return Promise.resolve(null);
      });
      mockExtractPackageFile.mockReturnValue(null);

      const result = await extractAllPackageFiles(defaultExtractConfig, [
        'go.mod',
        'submodule/go.mod',
      ]);

      expect(result).toBeNull();
      expect(mockExtractPackageFile).toHaveBeenCalledTimes(2);
      expect(mockExtractPackageFile).toHaveBeenNthCalledWith(1, sampleGoMod);
      expect(mockExtractPackageFile).toHaveBeenNthCalledWith(2, sampleGoMod2);
    });

    it('extracts package files successfully', async () => {
      mockReadLocalFile.mockImplementation((path) => {
        if (path === 'go.mod') {
          return Promise.resolve(sampleGoMod);
        }
        if (path === 'submodule/go.mod') {
          return Promise.resolve(sampleGoMod2);
        }
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

      const result = await extractAllPackageFiles(defaultExtractConfig, [
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
        if (path === 'go.mod') {
          return Promise.resolve(sampleGoMod);
        }
        if (path === 'invalid/go.mod') {
          return Promise.resolve(sampleGoMod2);
        }
        if (path === 'empty/go.mod') {
          return Promise.resolve(null);
        }
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

      const result = await extractAllPackageFiles(
        {
          manager: 'gomod',
          fileList: ['go.mod', 'invalid/go.mod', 'empty/go.mod'],
        },
        ['go.mod', 'invalid/go.mod', 'empty/go.mod'],
      );

      expect(result).toEqual([
        {
          deps: [{ depName: 'github.com/pkg/errors', currentValue: 'v0.7.0' }],
          packageFile: 'go.mod',
        },
      ]);
    });
  });
});
