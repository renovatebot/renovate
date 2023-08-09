import { join } from 'upath';
import { envMock, mockExecAll } from '../../../../test/exec-util';
import { env, fs, mocked } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import * as docker from '../../../util/exec/docker';
import * as _datasource from '../../datasource';
import type { UpdateArtifact, UpdateArtifactsConfig } from '../types';
import * as pub from '.';

jest.mock('../../../util/exec/env');
jest.mock('../../../util/fs');
jest.mock('../../../util/git');
jest.mock('../../../util/http');
jest.mock('../../datasource');

process.env.CONTAINERBASE = 'true';

const lockFile = 'pubspec.lock';
const oldLockFileContent = 'Old pubspec.lock';
const newLockFileContent = 'New pubspec.lock';
const depName = 'depName';

const datasource = mocked(_datasource);

const adminConfig: RepoGlobalConfig = {
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/cache'),
  containerbaseDir: join('/tmp/cache/containerbase'),
};

const config: UpdateArtifactsConfig = {};

const updateArtifact: UpdateArtifact = {
  packageFileName: 'pubspec.yaml',
  updatedDeps: [{ depName }],
  newPackageFileContent: '',
  config,
};

describe('modules/manager/pub/artifacts', () => {
  beforeEach(() => {
    jest.resetAllMocks();

    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    GlobalConfig.set(adminConfig);
    docker.resetPrefetchedImages();

    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [{ version: '2.10.5' }, { version: '3.3.9' }],
    });
  });

  afterEach(() => {
    GlobalConfig.set(adminConfig);
  });

  it('returns null if no pubspec.lock found', async () => {
    expect(await pub.updateArtifacts(updateArtifact)).toBeNull();
  });

  it('returns null if updatedDeps is empty', async () => {
    expect(
      await pub.updateArtifacts({ ...updateArtifact, updatedDeps: [] })
    ).toBeNull();
  });

  describe.each([
    { sdk: 'dart', packageFileContent: '' },
    { sdk: 'flutter', packageFileContent: 'sdk: flutter' },
  ])('validates pub tools', (params) => {
    it(`returns null for ${params.sdk} if unchanged`, async () => {
      const execSnapshots = mockExecAll();
      fs.readLocalFile.mockResolvedValueOnce(oldLockFileContent);
      fs.readLocalFile.mockResolvedValueOnce(oldLockFileContent);
      expect(
        await pub.updateArtifacts({
          ...updateArtifact,
          newPackageFileContent: params.packageFileContent,
        })
      ).toBeNull();
      expect(execSnapshots).toMatchObject([
        {
          cmd: `${params.sdk} pub upgrade ${depName}`,
        },
      ]);
    });

    it(`returns updated ${params.sdk} pubspec.lock`, async () => {
      const execSnapshots = mockExecAll();
      fs.getSiblingFileName.mockReturnValueOnce(lockFile);
      fs.readLocalFile.mockResolvedValueOnce(oldLockFileContent);
      fs.readLocalFile.mockResolvedValueOnce(newLockFileContent);
      expect(
        await pub.updateArtifacts({
          ...updateArtifact,
          newPackageFileContent: params.packageFileContent,
        })
      ).toEqual([
        {
          file: {
            type: 'addition',
            path: lockFile,
            contents: newLockFileContent,
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        {
          cmd: `${params.sdk} pub upgrade ${depName}`,
        },
      ]);
    });

    it(`returns updated ${params.sdk} pubspec.lock for lockfile maintenance`, async () => {
      const execSnapshots = mockExecAll();
      fs.getSiblingFileName.mockReturnValueOnce(lockFile);
      fs.readLocalFile.mockResolvedValueOnce(oldLockFileContent);
      fs.readLocalFile.mockResolvedValueOnce(newLockFileContent);
      expect(
        await pub.updateArtifacts({
          ...updateArtifact,
          newPackageFileContent: params.packageFileContent,
          config: { ...config, updateType: 'lockFileMaintenance' },
        })
      ).toEqual([
        {
          file: {
            type: 'addition',
            path: lockFile,
            contents: newLockFileContent,
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        {
          cmd: `${params.sdk} pub upgrade`,
        },
      ]);
    });

    it(`supports ${params.sdk} docker mode`, async () => {
      GlobalConfig.set({
        ...adminConfig,
        binarySource: 'docker',
        dockerSidecarImage: 'ghcr.io/containerbase/sidecar',
      });
      const execSnapshots = mockExecAll();
      fs.getSiblingFileName.mockReturnValueOnce(lockFile);
      fs.readLocalFile.mockResolvedValueOnce(oldLockFileContent);
      fs.readLocalFile.mockResolvedValueOnce(newLockFileContent);
      expect(
        await pub.updateArtifacts({
          ...updateArtifact,
          newPackageFileContent: params.packageFileContent,
        })
      ).toEqual([
        {
          file: {
            type: 'addition',
            path: lockFile,
            contents: newLockFileContent,
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'docker pull ghcr.io/containerbase/sidecar',
        },
        {
          cmd: 'docker ps --filter name=renovate_sidecar -aq',
        },
        {
          cmd:
            'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
            '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
            '-v "/tmp/cache":"/tmp/cache" ' +
            '-e CONTAINERBASE_CACHE_DIR ' +
            '-w "/tmp/github/some/repo" ' +
            'ghcr.io/containerbase/sidecar ' +
            'bash -l -c "' +
            `install-tool ${params.sdk} 3.3.9` +
            ' && ' +
            `${params.sdk} pub upgrade ${depName}` +
            '"',
        },
      ]);
    });

    it(`supports ${params.sdk} install mode`, async () => {
      GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
      const execSnapshots = mockExecAll();
      fs.getSiblingFileName.mockReturnValueOnce(lockFile);
      fs.readLocalFile.mockResolvedValueOnce(oldLockFileContent);
      fs.readLocalFile.mockResolvedValueOnce(newLockFileContent);
      expect(
        await pub.updateArtifacts({
          ...updateArtifact,
          newPackageFileContent: params.packageFileContent,
          config: { ...config, constraints: { dart: '3.3.9' } },
        })
      ).toEqual([
        {
          file: {
            type: 'addition',
            path: lockFile,
            contents: newLockFileContent,
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        { cmd: `install-tool ${params.sdk} 3.3.9` },
        { cmd: `${params.sdk} pub upgrade ${depName}` },
      ]);
    });

    it(`catches errors for ${params.sdk}`, async () => {
      const stderr = 'not found';
      fs.getSiblingFileName.mockReturnValueOnce(lockFile);
      fs.readLocalFile.mockResolvedValueOnce(oldLockFileContent);
      fs.readLocalFile.mockResolvedValueOnce(newLockFileContent);
      fs.writeLocalFile.mockImplementationOnce(() => {
        throw new Error(stderr);
      });
      expect(
        await pub.updateArtifacts({
          ...updateArtifact,
          newPackageFileContent: params.packageFileContent,
        })
      ).toEqual([{ artifactError: { lockFile, stderr } }]);
    });
  });
});
