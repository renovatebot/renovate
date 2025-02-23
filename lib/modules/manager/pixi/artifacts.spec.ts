import { mockDeep } from 'jest-mock-extended';
import { join } from 'upath';
import { envMock, mockExecAll } from '../../../../test/exec-util';
import { Fixtures } from '../../../../test/fixtures';
import { env, fs, mocked } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import * as docker from '../../../util/exec/docker';
import * as _hostRules from '../../../util/host-rules';
import * as _datasource from '../../datasource';
import type { UpdateArtifactsConfig } from '../types';
import { updateArtifacts } from '.';

const pyprojectToml = Fixtures.get('pyproject.toml');

jest.mock('../../../util/exec/env');
jest.mock('../../../util/fs');
jest.mock('../../datasource', () => mockDeep());
jest.mock('../../../util/host-rules', () => mockDeep());

process.env.CONTAINERBASE = 'true';

// process.env.PIXI_CACHE_DIR = '/tmp/cache/others/pixi';

const datasource = mocked(_datasource);
const hostRules = mocked(_hostRules);

const adminConfig: RepoGlobalConfig = {
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/cache'),
  containerbaseDir: join('/tmp/cache/containerbase'),
};

const config: UpdateArtifactsConfig = {};

describe('modules/manager/pixi/artifacts', () => {
  describe('updateArtifacts', () => {
    beforeEach(() => {
      env.getChildProcessEnv.mockReturnValue(envMock.basic);
      hostRules.getAll.mockReturnValue([]);
      GlobalConfig.set(adminConfig);
      docker.resetPrefetchedImages();
    });

    it('returns null if no pixi.lock found', async () => {
      const execSnapshots = mockExecAll();
      expect(
        await updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps: [],
          newPackageFileContent: '',
          config: { ...config, isLockFileMaintenance: true },
        }),
      ).toBeNull();
      expect(execSnapshots).toEqual([]);
    });

    it('returns null if updatedDeps is empty', async () => {
      const execSnapshots = mockExecAll();
      expect(
        await updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps: [],
          newPackageFileContent: '',
          config,
        }),
      ).toBeNull();
      expect(execSnapshots).toEqual([]);
    });

    it('returns null if unchanged', async () => {
      const execSnapshots = mockExecAll();
      fs.ensureCacheDir.mockResolvedValueOnce(
        '/tmp/renovate/cache/others/pixi',
      );
      fs.readLocalFile.mockResolvedValueOnce('Current pixi.lock');
      fs.readLocalFile.mockResolvedValueOnce('Current pixi.lock');
      expect(
        await updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps: [],
          newPackageFileContent: '',
          config: { ...config, isLockFileMaintenance: true },
        }),
      ).toBeNull();
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'pixi lock --no-progress --color=never',
          options: {
            cwd: '/tmp/github/some/repo',
            env: { PIXI_CACHE_DIR: '/tmp/renovate/cache/others/pixi' },
          },
        },
      ]);
    });

    it('returns updated pixi.lock using docker', async () => {
      GlobalConfig.set({
        ...adminConfig,
        binarySource: 'docker',
        dockerSidecarImage: 'ghcr.io/containerbase/sidecar',
      });
      const execSnapshots = mockExecAll();
      fs.ensureCacheDir.mockResolvedValueOnce(
        '/tmp/renovate/cache/others/pixi',
      );
      // pixi.lock
      fs.getSiblingFileName.mockReturnValueOnce('pixi.lock');
      fs.readLocalFile.mockResolvedValueOnce('[metadata]\n');
      fs.readLocalFile.mockResolvedValueOnce('New pixi.lock');
      // pixi
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '2.7.5' }, { version: '0.41.4' }],
      });
      const updatedDeps = [{ depName: 'dep1' }];
      expect(
        await updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps,
          newPackageFileContent: pyprojectToml,
          config: { ...config, isLockFileMaintenance: true },
        }),
      ).toEqual([
        {
          file: {
            type: 'addition',
            path: 'pixi.lock',
            contents: 'New pixi.lock',
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        { cmd: 'docker pull ghcr.io/containerbase/sidecar' },
        { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
        {
          cmd:
            'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
            '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
            '-v "/tmp/cache":"/tmp/cache" ' +
            '-e PIXI_CACHE_DIR ' +
            '-e CONTAINERBASE_CACHE_DIR ' +
            '-w "/tmp/github/some/repo" ' +
            'ghcr.io/containerbase/sidecar ' +
            'bash -l -c "' +
            'install-tool pixi 0.41.4 ' +
            '&& ' +
            'pixi lock --no-progress --color=never' +
            '"',
        },
      ]);
    });

    it('returns updated pixi.lock using install mode', async () => {
      GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
      const execSnapshots = mockExecAll();
      // pixi.lock
      fs.getSiblingFileName.mockReturnValueOnce('pixi.lock');
      fs.readLocalFile.mockResolvedValueOnce(
        '[metadata]\npython-versions = "~2.7 || ^3.4"',
      );
      fs.readLocalFile.mockResolvedValueOnce('New pixi.lock');
      // pixi
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '2.7.5' }, { version: '0.41.4' }],
      });
      const updatedDeps = [{ depName: 'dep1' }];
      expect(
        await updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps,
          newPackageFileContent: pyprojectToml,
          config: {
            ...config,
            constraints: {},
            isLockFileMaintenance: true,
          },
        }),
      ).toEqual([
        {
          file: {
            type: 'addition',
            path: 'pixi.lock',
            contents: 'New pixi.lock',
          },
        },
      ]);

      expect(execSnapshots).toMatchObject([
        { cmd: 'install-tool pixi 0.41.4' },
        { cmd: 'pixi lock --no-progress --color=never' },
      ]);
    });

    it('catches errors', async () => {
      const execSnapshots = mockExecAll();
      // pixi.lock
      fs.getSiblingFileName.mockReturnValueOnce('pixi.lock');
      fs.readLocalFile.mockResolvedValueOnce('Current pixi.lock');
      fs.writeLocalFile.mockImplementationOnce(() => {
        throw new Error('not found');
      });
      const updatedDeps = [{ depName: 'dep1' }];
      expect(
        await updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps,
          newPackageFileContent: '{}',
          config,
        }),
      ).toMatchObject([{ artifactError: { lockFile: 'pixi.lock' } }]);
      expect(execSnapshots).toMatchObject([]);
    });

    it('returns updated pixi.lock when doing lockfile maintenance', async () => {
      const execSnapshots = mockExecAll();
      // pixi.lock
      fs.getSiblingFileName.mockReturnValueOnce('pixi.lock');
      fs.readLocalFile.mockResolvedValueOnce('Old pixi.lock');
      fs.readLocalFile.mockResolvedValueOnce('New pixi.lock');
      expect(
        await updateArtifacts({
          packageFileName: 'pyproject.toml',
          updatedDeps: [],
          newPackageFileContent: '{}',
          config: {
            ...config,
            isLockFileMaintenance: true,
          },
        }),
      ).toEqual([
        {
          file: {
            contents: 'New pixi.lock',
            path: 'pixi.lock',
            type: 'addition',
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        { cmd: 'pixi lock --no-progress --color=never' },
      ]);
    });
  });
});
