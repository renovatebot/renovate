import _fs from 'fs-extra';
import { join } from 'upath';
import { envMock, mockExecAll } from '../../../../test/exec-util';
import { Fixtures } from '../../../../test/fixtures';
import { env, git } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { logger } from '../../../logger';
import * as docker from '../../../util/exec/docker';
import type { StatusResult } from '../../../util/git/types';
import type { UpdateArtifactsConfig } from '../types';
import { constructPipCompileCmd } from './artifacts';
import { updateArtifacts } from '.';

jest.mock('fs-extra');
jest.mock('../../../util/exec/env');
jest.mock('../../../util/git');
jest.mock('../../../util/host-rules');
jest.mock('../../../util/http');

const fs: jest.Mocked<typeof _fs> = _fs as any;

const adminConfig: RepoGlobalConfig = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/renovate/cache'),
};
const dockerAdminConfig = { ...adminConfig, binarySource: 'docker' };

process.env.BUILDPACK = 'true';

const config: UpdateArtifactsConfig = {};
const lockMaintenanceConfig = { ...config, isLockFileMaintenance: true };

describe('modules/manager/pip-compile/artifacts', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    env.getChildProcessEnv.mockReturnValue({
      ...envMock.basic,
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US',
    });
    GlobalConfig.set(adminConfig);
    docker.resetPrefetchedImages();
  });

  it('returns if no requirements.txt found', async () => {
    expect(
      await updateArtifacts({
        packageFileName: 'requirements.in',
        updatedDeps: [],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });

  it('returns null if unchanged', async () => {
    fs.readFile.mockResolvedValueOnce('content' as any);
    const execSnapshots = mockExecAll();
    fs.readFile.mockResolvedValueOnce('content' as any);
    expect(
      await updateArtifacts({
        packageFileName: 'requirements.in',
        updatedDeps: [],
        newPackageFileContent: 'some new content',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('returns updated requirements.txt', async () => {
    fs.readFile.mockResolvedValueOnce('current requirements.txt' as any);
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue({
      modified: ['requirements.txt'],
    } as StatusResult);
    fs.readFile.mockResolvedValueOnce('New requirements.txt' as any);
    expect(
      await updateArtifacts({
        packageFileName: 'requirements.in',
        updatedDeps: [],
        newPackageFileContent: 'some new content',
        config: { ...config, constraints: { python: '3.7' } },
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('supports docker mode', async () => {
    GlobalConfig.set(dockerAdminConfig);
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue({
      modified: ['requirements.txt'],
    } as StatusResult);
    fs.readFile.mockResolvedValueOnce('new lock' as any);
    expect(
      await updateArtifacts({
        packageFileName: 'requirements.in',
        updatedDeps: [],
        newPackageFileContent: 'some new content',
        config: { ...config, constraints: { python: '3.10.2' } },
      })
    ).not.toBeNull();

    expect(execSnapshots).toMatchObject([
      { cmd: 'docker pull renovate/sidecar' },
      { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
      {
        cmd:
          'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
          '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
          '-v "/tmp/renovate/cache":"/tmp/renovate/cache" ' +
          '-e PIP_CACHE_DIR ' +
          '-e BUILDPACK_CACHE_DIR ' +
          '-w "/tmp/github/some/repo" ' +
          'renovate/sidecar ' +
          'bash -l -c "' +
          'install-tool python 3.10.2 ' +
          '&& ' +
          'pip install --user pip-tools ' +
          '&& ' +
          'pip-compile requirements.in' +
          '"',
      },
    ]);
  });

  it('supports iunstall mode', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue({
      modified: ['requirements.txt'],
    } as StatusResult);
    fs.readFile.mockResolvedValueOnce('new lock' as any);
    expect(
      await updateArtifacts({
        packageFileName: 'requirements.in',
        updatedDeps: [],
        newPackageFileContent: 'some new content',
        config: { ...config, constraints: { python: '3.10.2' } },
      })
    ).not.toBeNull();

    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool python 3.10.2' },
      { cmd: 'pip install --user pip-tools' },
      {
        cmd: 'pip-compile requirements.in',
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });

  it('catches errors', async () => {
    fs.readFile.mockResolvedValueOnce('Current requirements.txt' as any);
    fs.outputFile.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    expect(
      await updateArtifacts({
        packageFileName: 'requirements.in',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config,
      })
    ).toEqual([
      {
        artifactError: { lockFile: 'requirements.txt', stderr: 'not found' },
      },
    ]);
  });

  it('returns updated requirements.txt when doing lockfile maintenance', async () => {
    fs.readFile.mockResolvedValueOnce('Current requirements.txt' as any);
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue({
      modified: ['requirements.txt'],
    } as StatusResult);
    fs.readFile.mockReturnValueOnce('New requirements.txt' as any);
    expect(
      await updateArtifacts({
        packageFileName: 'requirements.in',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config: lockMaintenanceConfig,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('uses pipenv version from config', async () => {
    GlobalConfig.set(dockerAdminConfig);
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue({
      modified: ['requirements.txt'],
    } as StatusResult);
    fs.readFile.mockResolvedValueOnce('new lock' as any);
    expect(
      await updateArtifacts({
        packageFileName: 'requirements.in',
        updatedDeps: [],
        newPackageFileContent: 'some new content',
        config: {
          ...config,
          constraints: { python: '3.10.2', pipTools: '==1.2.3' },
        },
      })
    ).not.toBeNull();

    expect(execSnapshots).toMatchObject([
      { cmd: 'docker pull renovate/sidecar' },
      { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
      {
        cmd:
          'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
          '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
          '-v "/tmp/renovate/cache":"/tmp/renovate/cache" ' +
          '-e PIP_CACHE_DIR ' +
          '-e BUILDPACK_CACHE_DIR ' +
          '-w "/tmp/github/some/repo" ' +
          'renovate/sidecar ' +
          'bash -l -c "' +
          'install-tool python 3.10.2 ' +
          '&& ' +
          'pip install --user pip-tools==1.2.3 ' +
          '&& ' +
          'pip-compile requirements.in' +
          '"',
      },
    ]);
  });

  describe('constructPipCompileCmd()', () => {
    it('returns default cmd for garbage', () => {
      expect(
        constructPipCompileCmd(
          Fixtures.get('requirementsNoHeaders.txt'),
          'subdir/requirements.in',
          'subdir/requirements.txt'
        )
      ).toBe('pip-compile requirements.in');
    });

    it('returns extracted common arguments (like those featured in the README)', () => {
      expect(
        constructPipCompileCmd(
          Fixtures.get('requirementsWithHashes.txt'),
          'subdir/requirements.in',
          'subdir/requirements.txt'
        )
      ).toBe(
        'pip-compile --allow-unsafe --generate-hashes --no-emit-index-url --output-file=requirements.txt requirements.in'
      );
    });

    it('skips unknown arguments', () => {
      expect(
        constructPipCompileCmd(
          Fixtures.get('requirementsWithUnknownArguments.txt'),
          'subdir/requirements.in',
          'subdir/requirements.txt'
        )
      ).toBe('pip-compile --generate-hashes requirements.in');
      expect(logger.trace).toHaveBeenCalledWith(
        { argument: '--version' },
        'pip-compile argument is not (yet) supported'
      );
    });

    it('skips exploitable subcommands and files', () => {
      expect(
        constructPipCompileCmd(
          Fixtures.get('requirementsWithExploitingArguments.txt'),
          'subdir/requirements.in',
          'subdir/requirements.txt'
        )
      ).toBe(
        'pip-compile --generate-hashes --output-file=requirements.txt requirements.in'
      );
      expect(logger.warn).toHaveBeenCalledWith(
        { argument: '--output-file=/etc/shadow' },
        'pip-compile was previously executed with an unexpected `--output-file` filename'
      );
    });
  });
});
