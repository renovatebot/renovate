import { join } from 'upath';
import {
  envMock,
  mockExecAll,
  mockExecSequence,
} from '../../../../test/exec-util';
import { env, fs, git, mocked } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import {
  BUNDLER_INVALID_CREDENTIALS,
  TEMPORARY_ERROR,
} from '../../../constants/error-messages';
import * as docker from '../../../util/exec/docker';
import { ExecError } from '../../../util/exec/exec-error';
import type { StatusResult } from '../../../util/git/types';
import * as _datasource from '../../datasource';
import type { UpdateArtifactsConfig } from '../types';
import * as _bundlerHostRules from './host-rules';
import { updateArtifacts } from '.';

const datasource = mocked(_datasource);
const bundlerHostRules = mocked(_bundlerHostRules);

jest.mock('fs-extra');
jest.mock('../../../util/exec/env');
jest.mock('../../datasource');
jest.mock('../../../util/fs');
jest.mock('../../../util/git');
jest.mock('../../../util/host-rules');
jest.mock('./host-rules');

const adminConfig: RepoGlobalConfig = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/cache'),
  containerbaseDir: join('/tmp/cache/containerbase'),
};

const config: UpdateArtifactsConfig = {};

const updatedGemfileLock = {
  file: {
    type: 'addition',
    path: 'Gemfile.lock',
    contents: 'Updated Gemfile.lock',
  },
};

describe('modules/manager/bundler/artifacts', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();

    delete process.env.GEM_HOME;

    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    bundlerHostRules.findAllAuthenticatable.mockReturnValue([]);
    docker.resetPrefetchedImages();

    GlobalConfig.set(adminConfig);
    fs.ensureCacheDir.mockResolvedValue('/tmp/cache/others/gem');
  });

  afterEach(() => {
    GlobalConfig.reset();
  });

  it('returns null by default', async () => {
    expect(
      await updateArtifacts({
        packageFileName: '',
        updatedDeps: [{ depName: 'foo' }, { depName: 'bar' }],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });

  it('returns null if Gemfile.lock was not changed', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current Gemfile.lock');
    fs.writeLocalFile.mockResolvedValueOnce();
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce({
      modified: [] as string[],
    } as StatusResult);
    fs.readLocalFile.mockResolvedValueOnce('Updated Gemfile.lock');
    expect(
      await updateArtifacts({
        packageFileName: 'Gemfile',
        updatedDeps: [{ depName: 'foo' }, { depName: 'bar' }],
        newPackageFileContent: 'Updated Gemfile content',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchObject([
      { cmd: 'bundler lock --update foo bar' },
    ]);
  });

  it('works for default binarySource', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current Gemfile.lock');
    fs.readLocalFile.mockResolvedValueOnce(null);
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['Gemfile.lock'],
    } as StatusResult);
    fs.readLocalFile.mockResolvedValueOnce('Updated Gemfile.lock');
    expect(
      await updateArtifacts({
        packageFileName: 'Gemfile',
        updatedDeps: [{ depName: 'foo' }, { depName: 'bar' }],
        newPackageFileContent: 'Updated Gemfile content',
        config,
      })
    ).toEqual([updatedGemfileLock]);
    expect(execSnapshots).toMatchObject([
      { cmd: 'bundler lock --update foo bar' },
    ]);
  });

  it('works explicit global binarySource', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'global' });
    fs.readLocalFile.mockResolvedValueOnce('Current Gemfile.lock');
    fs.readLocalFile.mockResolvedValueOnce(null);
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['Gemfile.lock'],
    } as StatusResult);
    fs.readLocalFile.mockResolvedValueOnce('Updated Gemfile.lock');
    expect(
      await updateArtifacts({
        packageFileName: 'Gemfile',
        updatedDeps: [{ depName: 'foo' }, { depName: 'bar' }],
        newPackageFileContent: 'Updated Gemfile content',
        config,
      })
    ).toEqual([updatedGemfileLock]);
    expect(execSnapshots).toMatchObject([
      { cmd: 'bundler lock --update foo bar' },
    ]);
  });

  it('supports conservative mode', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current Gemfile.lock');
    fs.readLocalFile.mockResolvedValueOnce(null);
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['Gemfile.lock'],
    } as StatusResult);
    fs.readLocalFile.mockResolvedValueOnce('Updated Gemfile.lock');
    expect(
      await updateArtifacts({
        packageFileName: 'Gemfile',
        updatedDeps: [{ depName: 'foo' }, { depName: 'bar' }],
        newPackageFileContent: 'Updated Gemfile content',
        config: {
          ...config,
          postUpdateOptions: [
            ...(config.postUpdateOptions ?? []),
            'bundlerConservative',
          ],
        },
      })
    ).toEqual([updatedGemfileLock]);
    expect(execSnapshots).toMatchObject([
      expect.objectContaining({
        cmd: 'bundler lock --conservative --update foo bar',
      }),
    ]);
  });

  describe('Docker', () => {
    beforeEach(() => {
      GlobalConfig.set({
        ...adminConfig,
        binarySource: 'docker',
      });
    });

    it('.ruby-version', async () => {
      fs.readLocalFile.mockResolvedValueOnce('Current Gemfile.lock');
      fs.readLocalFile.mockResolvedValueOnce('1.2.0');
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '1.17.2' }, { version: '2.3.5' }],
      });
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [
          { version: '1.0.0' },
          { version: '1.2.0' },
          { version: '1.3.0' },
        ],
      });
      const execSnapshots = mockExecAll();
      git.getRepoStatus.mockResolvedValueOnce({
        modified: ['Gemfile.lock'],
      } as StatusResult);
      fs.readLocalFile.mockResolvedValueOnce('Updated Gemfile.lock');
      expect(
        await updateArtifacts({
          packageFileName: 'Gemfile',
          updatedDeps: [{ depName: 'foo' }, { depName: 'bar' }],
          newPackageFileContent: 'Updated Gemfile content',
          config,
        })
      ).toEqual([updatedGemfileLock]);
      expect(execSnapshots).toMatchObject([
        { cmd: 'docker pull renovate/ruby:1.2.0' },
        { cmd: 'docker ps --filter name=renovate_ruby -aq' },
        {
          cmd: 'docker run --rm --name=renovate_ruby --label=renovate_child -v "/tmp/github/some/repo":"/tmp/github/some/repo" -v "/tmp/cache":"/tmp/cache" -e GEM_HOME -e BUILDPACK_CACHE_DIR -w "/tmp/github/some/repo" renovate/ruby:1.2.0 bash -l -c "install-tool bundler 2.3.5 && ruby --version && bundler lock --update foo bar"',
        },
      ]);
    });

    it('constraints options', async () => {
      GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
      fs.readLocalFile.mockResolvedValueOnce('Current Gemfile.lock');
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '1.17.2' }, { version: '2.3.5' }],
      });
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [
          { version: '1.0.0' },
          { version: '1.2.0' },
          { version: '1.3.0' },
        ],
      });
      const execSnapshots = mockExecAll();
      git.getRepoStatus.mockResolvedValueOnce({
        modified: ['Gemfile.lock'],
      } as StatusResult);
      fs.readLocalFile.mockResolvedValueOnce('Updated Gemfile.lock');
      expect(
        await updateArtifacts({
          packageFileName: 'Gemfile',
          updatedDeps: [{ depName: 'foo' }, { depName: 'bar' }],
          newPackageFileContent: 'Updated Gemfile content',
          config: {
            ...config,
            constraints: {
              ruby: '1.2.5',
              bundler: '3.2.1',
            },
          },
        })
      ).toEqual([updatedGemfileLock]);
      expect(execSnapshots).toMatchObject([
        { cmd: 'docker pull renovate/ruby:latest' },
        { cmd: 'docker ps --filter name=renovate_ruby -aq' },
        {
          cmd: 'docker run --rm --name=renovate_ruby --label=renovate_child -v "/tmp/github/some/repo":"/tmp/github/some/repo" -v "/tmp/cache":"/tmp/cache" -e GEM_HOME -e BUILDPACK_CACHE_DIR -w "/tmp/github/some/repo" renovate/ruby:latest bash -l -c "install-tool bundler 3.2.1 && ruby --version && bundler lock --update foo bar"',
        },
      ]);
    });

    it('invalid constraints options', async () => {
      GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
      fs.readLocalFile.mockResolvedValueOnce('Current Gemfile.lock');
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '1.17.2' }, { version: '2.3.5' }],
      });
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [
          { version: '1.0.0' },
          { version: '1.2.0' },
          { version: '1.3.0' },
        ],
      });
      const execSnapshots = mockExecAll();
      git.getRepoStatus.mockResolvedValueOnce({
        modified: ['Gemfile.lock'],
      } as StatusResult);
      fs.readLocalFile.mockResolvedValueOnce('Updated Gemfile.lock');
      expect(
        await updateArtifacts({
          packageFileName: 'Gemfile',
          updatedDeps: [{ depName: 'foo' }, { depName: 'bar' }],
          newPackageFileContent: 'Updated Gemfile content',
          config: {
            ...config,
            constraints: {
              ruby: 'foo',
              bundler: 'bar',
            },
          },
        })
      ).toEqual([updatedGemfileLock]);
      expect(execSnapshots).toMatchObject([
        { cmd: 'docker pull renovate/ruby:latest' },
        { cmd: 'docker ps --filter name=renovate_ruby -aq' },
        {
          cmd: 'docker run --rm --name=renovate_ruby --label=renovate_child -v "/tmp/github/some/repo":"/tmp/github/some/repo" -v "/tmp/cache":"/tmp/cache" -e GEM_HOME -e BUILDPACK_CACHE_DIR -w "/tmp/github/some/repo" renovate/ruby:latest bash -l -c "install-tool bundler 2.3.5 && ruby --version && bundler lock --update foo bar"',
        },
      ]);
    });

    it('injects bundler host configuration environment variables', async () => {
      GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
      fs.readLocalFile.mockResolvedValueOnce('Current Gemfile.lock');
      fs.readLocalFile.mockResolvedValueOnce('1.2.0');
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '1.17.2' }, { version: '2.3.5' }],
      });
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [
          { version: '1.0.0' },
          { version: '1.2.0' },
          { version: '1.3.0' },
        ],
      });
      bundlerHostRules.findAllAuthenticatable.mockReturnValue([
        {
          hostType: 'bundler',
          matchHost: 'gems.private.com',
          resolvedHost: 'gems.private.com',
          username: 'some-user',
          password: 'some-password',
        },
      ]);
      bundlerHostRules.getAuthenticationHeaderValue.mockReturnValue(
        'some-user:some-password'
      );
      const execSnapshots = mockExecAll();
      git.getRepoStatus.mockResolvedValueOnce({
        modified: ['Gemfile.lock'],
      } as StatusResult);
      fs.readLocalFile.mockResolvedValueOnce('Updated Gemfile.lock');
      expect(
        await updateArtifacts({
          packageFileName: 'Gemfile',
          updatedDeps: [{ depName: 'foo' }, { depName: 'bar' }],
          newPackageFileContent: 'Updated Gemfile content',
          config,
        })
      ).toEqual([updatedGemfileLock]);
      expect(execSnapshots).toMatchObject([
        { cmd: 'docker pull renovate/ruby:1.2.0' },
        { cmd: 'docker ps --filter name=renovate_ruby -aq' },
        {
          cmd: 'docker run --rm --name=renovate_ruby --label=renovate_child -v "/tmp/github/some/repo":"/tmp/github/some/repo" -v "/tmp/cache":"/tmp/cache" -e BUNDLE_GEMS__PRIVATE__COM -e GEM_HOME -e BUILDPACK_CACHE_DIR -w "/tmp/github/some/repo" renovate/ruby:1.2.0 bash -l -c "install-tool bundler 2.3.5 && ruby --version && bundler lock --update foo bar"',
        },
      ]);
    });

    it('injects bundler host configuration as command with bundler < 2', async () => {
      GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
      fs.readLocalFile.mockResolvedValueOnce('Current Gemfile.lock');
      fs.readLocalFile.mockResolvedValueOnce('1.2.0');
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [
          { version: '1.0.0' },
          { version: '1.2.0' },
          { version: '1.3.0' },
        ],
      });
      bundlerHostRules.findAllAuthenticatable.mockReturnValue([
        {
          hostType: 'bundler',
          matchHost: 'gems-private.com',
          resolvedHost: 'gems-private.com',
          username: 'some-user',
          password: 'some-password',
        },
      ]);
      bundlerHostRules.getAuthenticationHeaderValue.mockReturnValue(
        'some-user:some-password'
      );
      const execSnapshots = mockExecAll();
      git.getRepoStatus.mockResolvedValueOnce({
        modified: ['Gemfile.lock'],
      } as StatusResult);
      fs.readLocalFile.mockResolvedValueOnce('Updated Gemfile.lock');
      expect(
        await updateArtifacts({
          packageFileName: 'Gemfile',
          updatedDeps: [{ depName: 'foo' }, { depName: 'bar' }],
          newPackageFileContent: 'Updated Gemfile content',
          config: {
            ...config,
            constraints: {
              bundler: '1.2',
            },
          },
        })
      ).toEqual([updatedGemfileLock]);
      expect(execSnapshots).toMatchObject([
        { cmd: 'docker pull renovate/ruby:1.2.0' },
        { cmd: 'docker ps --filter name=renovate_ruby -aq' },
        {
          cmd: 'docker run --rm --name=renovate_ruby --label=renovate_child -v "/tmp/github/some/repo":"/tmp/github/some/repo" -v "/tmp/cache":"/tmp/cache" -e GEM_HOME -e BUILDPACK_CACHE_DIR -w "/tmp/github/some/repo" renovate/ruby:1.2.0 bash -l -c "install-tool bundler 1.2 && ruby --version && bundler config --local gems-private.com some-user:some-password && bundler lock --update foo bar"',
        },
      ]);
    });

    it('injects bundler host configuration as command with bundler >= 2', async () => {
      GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
      fs.readLocalFile.mockResolvedValueOnce('Current Gemfile.lock');
      fs.readLocalFile.mockResolvedValueOnce('1.2.0');
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [
          { version: '1.0.0' },
          { version: '1.2.0' },
          { version: '1.3.0' },
        ],
      });
      bundlerHostRules.findAllAuthenticatable.mockReturnValue([
        {
          hostType: 'bundler',
          matchHost: 'gems-private.com',
          resolvedHost: 'gems-private.com',
          username: 'some-user',
          password: 'some-password',
        },
      ]);
      bundlerHostRules.getAuthenticationHeaderValue.mockReturnValue(
        'some-user:some-password'
      );
      const execSnapshots = mockExecAll();
      git.getRepoStatus.mockResolvedValueOnce({
        modified: ['Gemfile.lock'],
      } as StatusResult);
      fs.readLocalFile.mockResolvedValueOnce('Updated Gemfile.lock');
      expect(
        await updateArtifacts({
          packageFileName: 'Gemfile',
          updatedDeps: [{ depName: 'foo' }, { depName: 'bar' }],
          newPackageFileContent: 'Updated Gemfile content',
          config: {
            ...config,
            constraints: {
              bundler: '2.1',
            },
          },
        })
      ).toEqual([updatedGemfileLock]);
      expect(execSnapshots).toMatchObject([
        { cmd: 'docker pull renovate/ruby:1.2.0' },
        { cmd: 'docker ps --filter name=renovate_ruby -aq' },
        {
          cmd: 'docker run --rm --name=renovate_ruby --label=renovate_child -v "/tmp/github/some/repo":"/tmp/github/some/repo" -v "/tmp/cache":"/tmp/cache" -e GEM_HOME -e BUILDPACK_CACHE_DIR -w "/tmp/github/some/repo" renovate/ruby:1.2.0 bash -l -c "install-tool bundler 2.1 && ruby --version && bundler config set --local gems-private.com some-user:some-password && bundler lock --update foo bar"',
        },
      ]);
    });

    it('injects bundler host configuration as command with bundler == latest', async () => {
      GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
      fs.readLocalFile.mockResolvedValueOnce('Current Gemfile.lock');
      fs.readLocalFile.mockResolvedValueOnce('1.2.0');
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '1.17.2' }, { version: '2.3.5' }],
      });
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [
          { version: '1.0.0' },
          { version: '1.2.0' },
          { version: '1.3.0' },
        ],
      });
      bundlerHostRules.findAllAuthenticatable.mockReturnValue([
        {
          hostType: 'bundler',
          matchHost: 'gems-private.com',
          resolvedHost: 'gems-private.com',
          username: 'some-user',
          password: 'some-password',
        },
      ]);
      bundlerHostRules.getAuthenticationHeaderValue.mockReturnValue(
        'some-user:some-password'
      );
      const execSnapshots = mockExecAll();
      git.getRepoStatus.mockResolvedValueOnce({
        modified: ['Gemfile.lock'],
      } as StatusResult);
      fs.readLocalFile.mockResolvedValueOnce('Updated Gemfile.lock');
      expect(
        await updateArtifacts({
          packageFileName: 'Gemfile',
          updatedDeps: [{ depName: 'foo' }, { depName: 'bar' }],
          newPackageFileContent: 'Updated Gemfile content',
          config,
        })
      ).toEqual([updatedGemfileLock]);
      expect(execSnapshots).toMatchObject([
        { cmd: 'docker pull renovate/ruby:1.2.0' },
        { cmd: 'docker ps --filter name=renovate_ruby -aq' },
        {
          cmd: 'docker run --rm --name=renovate_ruby --label=renovate_child -v "/tmp/github/some/repo":"/tmp/github/some/repo" -v "/tmp/cache":"/tmp/cache" -e GEM_HOME -e BUILDPACK_CACHE_DIR -w "/tmp/github/some/repo" renovate/ruby:1.2.0 bash -l -c "install-tool bundler 2.3.5 && ruby --version && bundler config set --local gems-private.com some-user:some-password && bundler lock --update foo bar"',
        },
      ]);
    });
  });

  it('returns error when failing in lockFileMaintenance true', async () => {
    const execError = new ExecError('Exec error', {
      cmd: '',
      stdout: ' foo was resolved to',
      stderr: '',
      options: { encoding: 'utf8' },
    });
    fs.readLocalFile.mockResolvedValueOnce('Current Gemfile.lock');
    fs.writeLocalFile.mockResolvedValueOnce(null as never);
    const execSnapshots = mockExecAll(execError);
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['Gemfile.lock'],
    } as StatusResult);
    expect(
      await updateArtifacts({
        packageFileName: 'Gemfile',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config: {
          ...config,
          isLockFileMaintenance: true,
        },
      })
    ).toMatchObject([{ artifactError: { lockFile: 'Gemfile.lock' } }]);
    expect(execSnapshots).toMatchObject([{ cmd: 'bundler lock --update' }]);
  });

  it('performs lockFileMaintenance', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current Gemfile.lock');
    fs.writeLocalFile.mockResolvedValueOnce();
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['Gemfile.lock'],
    } as StatusResult);
    fs.readLocalFile.mockResolvedValueOnce('Updated Gemfile.lock');
    expect(
      await updateArtifacts({
        packageFileName: 'Gemfile',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config: {
          ...config,
          isLockFileMaintenance: true,
        },
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchObject([{ cmd: 'bundler lock --update' }]);
  });

  describe('Error handling', () => {
    it('returns error when failing in lockFileMaintenance true', async () => {
      const execError = new ExecError('Exec error', {
        cmd: '',
        stdout: ' foo was resolved to',
        stderr: '',
        options: { encoding: 'utf8' },
      });
      fs.readLocalFile.mockResolvedValueOnce('Current Gemfile.lock');
      const execSnapshots = mockExecAll(execError);
      git.getRepoStatus.mockResolvedValueOnce({
        modified: ['Gemfile.lock'],
      } as StatusResult);
      expect(
        await updateArtifacts({
          packageFileName: 'Gemfile',
          updatedDeps: [],
          newPackageFileContent: '{}',
          config: {
            ...config,
            isLockFileMaintenance: true,
          },
        })
      ).toMatchObject([
        {
          artifactError: {
            lockFile: 'Gemfile.lock',
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([{ cmd: 'bundler lock --update' }]);
    });

    it('rethrows for temporary error', async () => {
      const execError = new ExecError(TEMPORARY_ERROR, {
        cmd: '',
        stdout: '',
        stderr: '',
        options: { encoding: 'utf8' },
      });
      fs.readLocalFile.mockResolvedValueOnce('Current Gemfile.lock');
      mockExecAll(execError);
      await expect(
        updateArtifacts({
          packageFileName: 'Gemfile',
          updatedDeps: [],
          newPackageFileContent: '{}',
          config: {
            ...config,
            isLockFileMaintenance: true,
          },
        })
      ).rejects.toThrow(TEMPORARY_ERROR);
    });

    it('handles "Could not parse object" error', async () => {
      const execError = new ExecError('fatal: Could not parse object', {
        cmd: '',
        stdout: 'but that version could not be found',
        stderr: '',
        options: { encoding: 'utf8' },
      });
      fs.readLocalFile.mockResolvedValueOnce('Current Gemfile.lock');
      mockExecAll(execError);
      expect(
        await updateArtifacts({
          packageFileName: 'Gemfile',
          updatedDeps: [],
          newPackageFileContent: '{}',
          config: {
            ...config,
            isLockFileMaintenance: true,
          },
        })
      ).toMatchObject([{ artifactError: { lockFile: 'Gemfile.lock' } }]);
    });

    it('throws on authentication errors', async () => {
      const execError = new ExecError('Exec error', {
        cmd: '',
        stdout: 'Please supply credentials for this source',
        stderr: 'Please make sure you have the correct access rights',
        options: { encoding: 'utf8' },
      });
      fs.readLocalFile.mockResolvedValueOnce('Current Gemfile.lock');
      mockExecAll(execError);
      await expect(
        updateArtifacts({
          packageFileName: 'Gemfile',
          updatedDeps: [],
          newPackageFileContent: '{}',
          config: {
            ...config,
            isLockFileMaintenance: true,
          },
        })
      ).rejects.toThrow(BUNDLER_INVALID_CREDENTIALS);
    });

    it('handles recursive resolved dependencies', async () => {
      const execError = new ExecError('Exec error', {
        cmd: '',
        stdout: 'foo was resolved to foo',
        stderr: 'bar was resolved to bar',
        options: { encoding: 'utf8' },
      });
      fs.readLocalFile.mockResolvedValue('Current Gemfile.lock');
      const execSnapshots = mockExecSequence([
        execError,
        { stdout: '', stderr: '' },
      ]);
      git.getRepoStatus.mockResolvedValueOnce({
        modified: ['Gemfile.lock'],
      } as StatusResult);

      const res = await updateArtifacts({
        packageFileName: 'Gemfile',
        updatedDeps: [{ depName: 'foo' }],
        newPackageFileContent: '{}',
        config: {
          ...config,
          isLockFileMaintenance: false,
        },
      });

      expect(res).toMatchObject([{ file: { path: 'Gemfile.lock' } }]);
      expect(execSnapshots).toMatchObject([
        { cmd: 'bundler lock --update foo' },
        { cmd: 'bundler lock --update foo bar' },
      ]);
    });
  });
});
