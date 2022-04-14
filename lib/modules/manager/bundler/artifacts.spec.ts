import { exec as _exec } from 'child_process';
import { join } from 'upath';
import { envMock, mockExecAll } from '../../../../test/exec-util';
import { fs, git, mocked } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import * as docker from '../../../util/exec/docker';
import * as _env from '../../../util/exec/env';
import type { StatusResult } from '../../../util/git/types';
import * as _datasource from '../../datasource';
import type { UpdateArtifactsConfig } from '../types';
import * as _bundlerHostRules from './host-rules';
import { updateArtifacts } from '.';

const exec: jest.Mock<typeof _exec> = _exec as any;
const env = mocked(_env);
const datasource = mocked(_datasource);
const bundlerHostRules = mocked(_bundlerHostRules);

jest.mock('fs-extra');
jest.mock('child_process');
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
    fs.writeLocalFile.mockResolvedValueOnce(null as never);
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValueOnce({
      modified: [],
    } as StatusResult);
    fs.readLocalFile.mockResolvedValueOnce('Updated Gemfile.lock' as any);
    expect(
      await updateArtifacts({
        packageFileName: 'Gemfile',
        updatedDeps: [{ depName: 'foo' }, { depName: 'bar' }],
        newPackageFileContent: 'Updated Gemfile content',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('works for default binarySource', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current Gemfile.lock');
    fs.writeLocalFile.mockResolvedValueOnce(null as never);
    fs.readLocalFile.mockResolvedValueOnce(null);
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['Gemfile.lock'],
    } as StatusResult);
    fs.readLocalFile.mockResolvedValueOnce('Updated Gemfile.lock' as any);
    expect(
      await updateArtifacts({
        packageFileName: 'Gemfile',
        updatedDeps: [{ depName: 'foo' }, { depName: 'bar' }],
        newPackageFileContent: 'Updated Gemfile content',
        config,
      })
    ).toEqual([updatedGemfileLock]);
    expect(execSnapshots).toMatchSnapshot();
  });

  it('works explicit global binarySource', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'global' });
    fs.readLocalFile.mockResolvedValueOnce('Current Gemfile.lock');
    fs.writeLocalFile.mockResolvedValueOnce(null as never);
    fs.readLocalFile.mockResolvedValueOnce(null);
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['Gemfile.lock'],
    } as StatusResult);
    fs.readLocalFile.mockResolvedValueOnce('Updated Gemfile.lock' as any);
    expect(
      await updateArtifacts({
        packageFileName: 'Gemfile',
        updatedDeps: [{ depName: 'foo' }, { depName: 'bar' }],
        newPackageFileContent: 'Updated Gemfile content',
        config,
      })
    ).toEqual([updatedGemfileLock]);
    expect(execSnapshots).toMatchSnapshot();
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
      fs.writeLocalFile.mockResolvedValueOnce(null as never);
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
      const execSnapshots = mockExecAll(exec);
      git.getRepoStatus.mockResolvedValueOnce({
        modified: ['Gemfile.lock'],
      } as StatusResult);
      fs.readLocalFile.mockResolvedValueOnce('Updated Gemfile.lock' as any);
      expect(
        await updateArtifacts({
          packageFileName: 'Gemfile',
          updatedDeps: [{ depName: 'foo' }, { depName: 'bar' }],
          newPackageFileContent: 'Updated Gemfile content',
          config,
        })
      ).toEqual([updatedGemfileLock]);
      expect(execSnapshots).toMatchSnapshot();
    });

    it('constraints options', async () => {
      GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
      fs.readLocalFile.mockResolvedValueOnce('Current Gemfile.lock');
      fs.writeLocalFile.mockResolvedValueOnce(null as never);
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
      const execSnapshots = mockExecAll(exec);
      git.getRepoStatus.mockResolvedValueOnce({
        modified: ['Gemfile.lock'],
      } as StatusResult);
      fs.readLocalFile.mockResolvedValueOnce('Updated Gemfile.lock' as any);
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
      expect(execSnapshots).toMatchSnapshot();
    });

    it('invalid constraints options', async () => {
      GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
      fs.readLocalFile.mockResolvedValueOnce('Current Gemfile.lock');
      fs.writeLocalFile.mockResolvedValueOnce(null as never);
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
      const execSnapshots = mockExecAll(exec);
      git.getRepoStatus.mockResolvedValueOnce({
        modified: ['Gemfile.lock'],
      } as StatusResult);
      fs.readLocalFile.mockResolvedValueOnce('Updated Gemfile.lock' as any);
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
      expect(execSnapshots).toMatchSnapshot();
    });

    it('injects bundler host configuration environment variables', async () => {
      GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
      fs.readLocalFile.mockResolvedValueOnce('Current Gemfile.lock');
      fs.writeLocalFile.mockResolvedValueOnce(null as never);
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
      const execSnapshots = mockExecAll(exec);
      git.getRepoStatus.mockResolvedValueOnce({
        modified: ['Gemfile.lock'],
      } as StatusResult);
      fs.readLocalFile.mockResolvedValueOnce('Updated Gemfile.lock' as any);
      expect(
        await updateArtifacts({
          packageFileName: 'Gemfile',
          updatedDeps: [{ depName: 'foo' }, { depName: 'bar' }],
          newPackageFileContent: 'Updated Gemfile content',
          config,
        })
      ).toEqual([updatedGemfileLock]);
      expect(execSnapshots).toMatchSnapshot();
    });

    it('injects bundler host configuration as command with bundler < 2', async () => {
      GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
      fs.readLocalFile.mockResolvedValueOnce('Current Gemfile.lock');
      fs.writeLocalFile.mockResolvedValueOnce(null as never);
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
      const execSnapshots = mockExecAll(exec);
      git.getRepoStatus.mockResolvedValueOnce({
        modified: ['Gemfile.lock'],
      } as StatusResult);
      fs.readLocalFile.mockResolvedValueOnce('Updated Gemfile.lock' as any);
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
      expect(execSnapshots).toMatchSnapshot();
    });

    it('injects bundler host configuration as command with bundler >= 2', async () => {
      GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
      fs.readLocalFile.mockResolvedValueOnce('Current Gemfile.lock');
      fs.writeLocalFile.mockResolvedValueOnce(null as never);
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
      const execSnapshots = mockExecAll(exec);
      git.getRepoStatus.mockResolvedValueOnce({
        modified: ['Gemfile.lock'],
      } as StatusResult);
      fs.readLocalFile.mockResolvedValueOnce('Updated Gemfile.lock' as any);
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
      expect(execSnapshots).toMatchSnapshot();
    });

    it('injects bundler host configuration as command with bundler == latest', async () => {
      GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
      fs.readLocalFile.mockResolvedValueOnce('Current Gemfile.lock');
      fs.writeLocalFile.mockResolvedValueOnce(null as never);
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
      const execSnapshots = mockExecAll(exec);
      git.getRepoStatus.mockResolvedValueOnce({
        modified: ['Gemfile.lock'],
      } as StatusResult);
      fs.readLocalFile.mockResolvedValueOnce('Updated Gemfile.lock' as any);
      expect(
        await updateArtifacts({
          packageFileName: 'Gemfile',
          updatedDeps: [{ depName: 'foo' }, { depName: 'bar' }],
          newPackageFileContent: 'Updated Gemfile content',
          config,
        })
      ).toEqual([updatedGemfileLock]);
      expect(execSnapshots).toMatchSnapshot();
    });
  });

  it('returns error when failing in lockFileMaintenance true', async () => {
    const execError = new Error();
    (execError as any).stdout = ' foo was resolved to';
    (execError as any).stderr = '';
    fs.readLocalFile.mockResolvedValueOnce('Current Gemfile.lock');
    fs.writeLocalFile.mockResolvedValueOnce(null as never);
    const execSnapshots = mockExecAll(exec, execError);
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
    ).toMatchSnapshot([
      {
        artifactError: {
          lockFile: 'Gemfile.lock',
        },
      },
    ]);
    expect(execSnapshots).toMatchSnapshot();
  });

  it('performs lockFileMaintenance', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current Gemfile.lock');
    fs.writeLocalFile.mockResolvedValueOnce(null as never);
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['Gemfile.lock'],
    } as StatusResult);
    fs.readLocalFile.mockResolvedValueOnce('Updated Gemfile.lock' as any);
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
    expect(execSnapshots).toMatchSnapshot();
  });
});
