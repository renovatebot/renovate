import { exec as _exec } from 'child_process';
import { join } from 'upath';
import { envMock, mockExecAll } from '../../../test/exec-util';
import { fs, git, mocked } from '../../../test/util';
import { setAdminConfig } from '../../config/admin';
import { BinarySource, RepoAdminConfig } from '../../config/types';
import * as _datasource from '../../datasource';
import * as docker from '../../util/exec/docker';
import * as _env from '../../util/exec/env';
import type { StatusResult } from '../../util/git';
import type { UpdateArtifactsConfig } from '../types';
import * as _bundlerHostRules from './host-rules';
import { updateArtifacts } from '.';

const exec: jest.Mock<typeof _exec> = _exec as any;
const env = mocked(_env);
const datasource = mocked(_datasource);
const bundlerHostRules = mocked(_bundlerHostRules);

jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('../../../lib/util/exec/env');
jest.mock('../../../lib/datasource');
jest.mock('../../../lib/util/fs');
jest.mock('../../../lib/util/git');
jest.mock('../../../lib/util/host-rules');
jest.mock('./host-rules');

const adminConfig: RepoAdminConfig = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/cache'),
};

const config: UpdateArtifactsConfig = {};

describe('bundler.updateArtifacts()', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();

    delete process.env.GEM_HOME;

    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    bundlerHostRules.findAllAuthenticatable.mockReturnValue([]);
    docker.resetPrefetchedImages();

    setAdminConfig(adminConfig);
  });
  afterEach(() => {
    setAdminConfig();
  });
  it('returns null by default', async () => {
    expect(
      await updateArtifacts({
        packageFileName: '',
        updatedDeps: ['foo', 'bar'],
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
        updatedDeps: ['foo', 'bar'],
        newPackageFileContent: 'Updated Gemfile content',
        config,
      })
    ).toMatchSnapshot();
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
        updatedDeps: ['foo', 'bar'],
        newPackageFileContent: 'Updated Gemfile content',
        config,
      })
    ).toMatchSnapshot();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('works explicit global binarySource', async () => {
    setAdminConfig({ ...adminConfig, binarySource: BinarySource.Global });
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
        updatedDeps: ['foo', 'bar'],
        newPackageFileContent: 'Updated Gemfile content',
        config,
      })
    ).toMatchSnapshot();
    expect(execSnapshots).toMatchSnapshot();
  });
  describe('Docker', () => {
    beforeEach(() => {
      setAdminConfig({
        ...adminConfig,
        binarySource: BinarySource.Docker,
      });
    });
    it('.ruby-version', async () => {
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
      const execSnapshots = mockExecAll(exec);
      git.getRepoStatus.mockResolvedValueOnce({
        modified: ['Gemfile.lock'],
      } as StatusResult);
      fs.readLocalFile.mockResolvedValueOnce('Updated Gemfile.lock' as any);
      expect(
        await updateArtifacts({
          packageFileName: 'Gemfile',
          updatedDeps: ['foo', 'bar'],
          newPackageFileContent: 'Updated Gemfile content',
          config,
        })
      ).toMatchSnapshot();
      expect(execSnapshots).toMatchSnapshot();
    });
    it('constraints options', async () => {
      setAdminConfig({ ...adminConfig, binarySource: BinarySource.Docker });
      fs.readLocalFile.mockResolvedValueOnce('Current Gemfile.lock');
      fs.writeLocalFile.mockResolvedValueOnce(null as never);
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
          updatedDeps: ['foo', 'bar'],
          newPackageFileContent: 'Updated Gemfile content',
          config: {
            ...config,
            constraints: {
              ruby: '1.2.5',
              bundler: '3.2.1',
            },
          },
        })
      ).toMatchSnapshot();
      expect(execSnapshots).toMatchSnapshot();
    });
    it('invalid constraints options', async () => {
      setAdminConfig({ ...adminConfig, binarySource: BinarySource.Docker });
      fs.readLocalFile.mockResolvedValueOnce('Current Gemfile.lock');
      fs.writeLocalFile.mockResolvedValueOnce(null as never);
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
          updatedDeps: ['foo', 'bar'],
          newPackageFileContent: 'Updated Gemfile content',
          config: {
            ...config,
            constraints: {
              ruby: 'foo',
              bundler: 'bar',
            },
          },
        })
      ).toMatchSnapshot();
      expect(execSnapshots).toMatchSnapshot();
    });

    it('injects bundler host configuration environment variables', async () => {
      setAdminConfig({ ...adminConfig, binarySource: BinarySource.Docker });
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
          updatedDeps: ['foo', 'bar'],
          newPackageFileContent: 'Updated Gemfile content',
          config,
        })
      ).toMatchSnapshot();
      expect(execSnapshots).toMatchSnapshot();
    });

    it('injects bundler host configuration as command with bundler < 2', async () => {
      setAdminConfig({ ...adminConfig, binarySource: BinarySource.Docker });
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
          updatedDeps: ['foo', 'bar'],
          newPackageFileContent: 'Updated Gemfile content',
          config: {
            ...config,
            constraints: {
              bundler: '1.2',
            },
          },
        })
      ).toMatchSnapshot();
      expect(execSnapshots).toMatchSnapshot();
    });

    it('injects bundler host configuration as command with bundler >= 2', async () => {
      setAdminConfig({ ...adminConfig, binarySource: BinarySource.Docker });
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
          updatedDeps: ['foo', 'bar'],
          newPackageFileContent: 'Updated Gemfile content',
          config: {
            ...config,
            constraints: {
              bundler: '2.1',
            },
          },
        })
      ).toMatchSnapshot();
      expect(execSnapshots).toMatchSnapshot();
    });

    it('injects bundler host configuration as command with bundler == latest', async () => {
      setAdminConfig({ ...adminConfig, binarySource: BinarySource.Docker });
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
          updatedDeps: ['foo', 'bar'],
          newPackageFileContent: 'Updated Gemfile content',
          config,
        })
      ).toMatchSnapshot();
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
    ).toMatchSnapshot();
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
