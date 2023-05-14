import { join } from 'upath';
import { mockExecAll } from '../../../../../test/exec-util';
import { fs, mockedFunction } from '../../../../../test/util';
import { GlobalConfig } from '../../../../config/global';
import type { RepoGlobalConfig } from '../../../../config/types';
import { getPkgReleases as _getPkgReleases } from '../../../datasource';
import type { UpdateArtifactsConfig } from '../../types';
import { PdmProcessor } from './pdm';

jest.mock('../../../../util/fs');
jest.mock('../../../datasource');

const getPkgReleases = mockedFunction(_getPkgReleases);

const config: UpdateArtifactsConfig = {};
const adminConfig: RepoGlobalConfig = {
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/cache'),
  containerbaseDir: join('/tmp/cache/containerbase'),
};

const processor = new PdmProcessor();

describe('modules/manager/pep621/processors/pdm', () => {
  describe('updateArtifacts()', () => {
    it('return null if there is no lock file', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('pdm.lock');
      const updatedDeps = [{ depName: 'dep1' }];
      const result = await processor.updateArtifacts({
        packageFileName: 'pyproject.toml',
        newPackageFileContent: '',
        config,
        updatedDeps,
      });
      expect(result).toBeNull();
    });

    it('return null if the lock file is unchanged', async () => {
      const execSnapshots = mockExecAll();
      GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
      fs.getSiblingFileName.mockReturnValueOnce('pdm.lock');
      fs.readLocalFile.mockResolvedValueOnce('test content');
      fs.readLocalFile.mockResolvedValueOnce('test content');
      // pdm
      getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: 'v2.6.1' }, { version: 'v2.5.0' }],
      });

      const updatedDeps = [{ depName: 'dep1' }];
      const result = await processor.updateArtifacts({
        packageFileName: 'pyproject.toml',
        newPackageFileContent: '',
        config: {},
        updatedDeps,
      });
      expect(result).toBeNull();
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'docker pull containerbase/sidecar',
          options: {
            encoding: 'utf-8',
          },
        },
        {
          cmd: 'docker ps --filter name=renovate_sidecar -aq',
          options: {
            encoding: 'utf-8',
          },
        },
        {
          cmd: 'docker run --rm --name=renovate_sidecar --label=renovate_child -v "/tmp/github/some/repo":"/tmp/github/some/repo" -v "/tmp/cache":"/tmp/cache" -e BUILDPACK_CACHE_DIR -e CONTAINERBASE_CACHE_DIR -w "/tmp/github/some/repo" containerbase/sidecar bash -l -c "install-tool pdm v2.5.0 && pdm update dep1"',
          options: {
            cwd: '/tmp/github/some/repo',
            encoding: 'utf-8',
            env: {
              BUILDPACK_CACHE_DIR: '/tmp/cache/containerbase',
              CONTAINERBASE_CACHE_DIR: '/tmp/cache/containerbase',
            },
            maxBuffer: 10485760,
            timeout: 900000,
          },
        },
      ]);
    });

    it('rethrow error', async () => {
      const execSnapshots = mockExecAll();
      GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
      fs.getSiblingFileName.mockReturnValueOnce('pdm.lock');
      fs.readLocalFile.mockImplementationOnce(() => {
        throw new Error('test error');
      });

      const updatedDeps = [{ depName: 'dep1' }];
      const result = await processor.updateArtifacts({
        packageFileName: 'pyproject.toml',
        newPackageFileContent: '',
        config: {},
        updatedDeps,
      });
      expect(result).toEqual([
        { artifactError: { lockFile: 'pdm.lock', stderr: 'test error' } },
      ]);
      expect(execSnapshots).toEqual([]);
    });
  });
});
