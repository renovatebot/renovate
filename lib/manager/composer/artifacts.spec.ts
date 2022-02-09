import { join } from 'upath';
import { envMock, exec, mockExecAll } from '../../../test/exec-util';
import { env, fs, git, mocked, partial } from '../../../test/util';
import { GlobalConfig } from '../../config/global';
import type { RepoGlobalConfig } from '../../config/types';
import { PlatformId } from '../../constants';
import * as _datasource from '../../datasource';
import * as datasourcePackagist from '../../datasource/packagist';
import * as docker from '../../util/exec/docker';
import type { StatusResult } from '../../util/git/types';
import * as hostRules from '../../util/host-rules';
import type { UpdateArtifactsConfig } from '../types';
import * as composer from './artifacts';

jest.mock('child_process');
jest.mock('../../util/exec/env');
jest.mock('../../../lib/datasource');
jest.mock('../../util/fs');
jest.mock('../../util/git');

const datasource = mocked(_datasource);

const config: UpdateArtifactsConfig = {
  composerIgnorePlatformReqs: [],
  ignoreScripts: false,
};

const adminConfig: RepoGlobalConfig = {
  allowPlugins: false,
  allowScripts: false,
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/renovate/cache'),
};

const repoStatus = partial<StatusResult>({
  modified: [],
  not_added: [],
  deleted: [],
});

describe('manager/composer/artifacts', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    docker.resetPrefetchedImages();
    hostRules.clear();
    GlobalConfig.set(adminConfig);
    fs.ensureCacheDir.mockResolvedValue('/tmp/renovate/cache/others/composer');
    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [
        { version: '1.0.0' },
        { version: '1.1.0' },
        { version: '1.3.0' },
        { version: '1.10.0' },
        { version: '1.10.17' },
        { version: '2.0.14' },
        { version: '2.1.0' },
      ],
    });
  });

  afterEach(() => {
    GlobalConfig.reset();
  });

  it('returns if no composer.lock found', async () => {
    expect(
      await composer.updateArtifacts({
        packageFileName: 'composer.json',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config,
      })
    ).toBeNull();
  });

  it('returns null if unchanged', async () => {
    fs.readLocalFile.mockResolvedValueOnce('{}');
    const execSnapshots = mockExecAll(exec);
    fs.readLocalFile.mockResolvedValueOnce('{}');
    git.getRepoStatus.mockResolvedValueOnce(repoStatus);
    GlobalConfig.set({
      ...adminConfig,
      allowScripts: true,
      allowPlugins: true,
    });
    expect(
      await composer.updateArtifacts({
        packageFileName: 'composer.json',
        updatedDeps: [{ depName: 'foo' }, { depName: 'bar' }],
        newPackageFileContent: '{}',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('uses hostRules to set COMPOSER_AUTH', async () => {
    hostRules.add({
      hostType: PlatformId.Github,
      matchHost: 'api.github.com',
      token: 'github-token',
    });
    hostRules.add({
      hostType: PlatformId.Gitlab,
      matchHost: 'gitlab.com',
      token: 'gitlab-token',
    });
    hostRules.add({
      hostType: datasourcePackagist.id,
      matchHost: 'packagist.renovatebot.com',
      username: 'some-username',
      password: 'some-password',
    });
    hostRules.add({
      hostType: datasourcePackagist.id,
      matchHost: 'https://artifactory.yyyyyyy.com/artifactory/api/composer/',
      username: 'some-other-username',
      password: 'some-other-password',
    });
    hostRules.add({
      hostType: datasourcePackagist.id,
      username: 'some-other-username',
      password: 'some-other-password',
    });
    hostRules.add({
      hostType: datasourcePackagist.id,
      matchHost: 'https://packages-bearer.example.com/',
      token: 'abcdef0123456789',
    });
    fs.readLocalFile.mockResolvedValueOnce('{}');
    const execSnapshots = mockExecAll(exec);
    fs.readLocalFile.mockResolvedValueOnce('{}');
    const authConfig = {
      ...config,
      registryUrls: ['https://packagist.renovatebot.com'],
    };
    git.getRepoStatus.mockResolvedValueOnce(repoStatus);
    expect(
      await composer.updateArtifacts({
        packageFileName: 'composer.json',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config: authConfig,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('returns updated composer.lock', async () => {
    fs.readLocalFile.mockResolvedValueOnce('{}');
    const execSnapshots = mockExecAll(exec);
    fs.readLocalFile.mockResolvedValueOnce('{}');
    git.getRepoStatus.mockResolvedValueOnce({
      ...repoStatus,
      modified: ['composer.lock'],
    });
    expect(
      await composer.updateArtifacts({
        packageFileName: 'composer.json',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('supports vendor directory update', async () => {
    const foo = join('vendor/foo/Foo.php');
    const bar = join('vendor/bar/Bar.php');
    const baz = join('vendor/baz/Baz.php');
    fs.localPathExists.mockResolvedValueOnce(true);
    fs.readLocalFile.mockResolvedValueOnce('{}');
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValueOnce({
      ...repoStatus,
      modified: ['composer.lock', foo],
      not_added: [bar],
      deleted: [baz],
    });
    fs.readLocalFile.mockResolvedValueOnce('{  }');
    fs.readLocalFile.mockResolvedValueOnce('Foo');
    fs.readLocalFile.mockResolvedValueOnce('Bar');
    fs.getSiblingFileName.mockReturnValueOnce('vendor');
    const res = await composer.updateArtifacts({
      packageFileName: 'composer.json',
      updatedDeps: [],
      newPackageFileContent: '{}',
      config,
    });
    expect(res).not.toBeNull();
    expect(res?.map(({ file }) => file)).toEqual([
      { type: 'addition', path: 'composer.lock', contents: '{  }' },
      { type: 'addition', path: foo, contents: 'Foo' },
      { type: 'addition', path: bar, contents: 'Bar' },
      { type: 'deletion', path: baz },
    ]);
    expect(execSnapshots).toMatchSnapshot();
  });

  it('performs lockFileMaintenance', async () => {
    fs.readLocalFile.mockResolvedValueOnce('{}');
    const execSnapshots = mockExecAll(exec);
    fs.readLocalFile.mockResolvedValueOnce('{  }');
    git.getRepoStatus.mockResolvedValueOnce({
      ...repoStatus,
      modified: ['composer.lock'],
    });
    expect(
      await composer.updateArtifacts({
        packageFileName: 'composer.json',
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

  it('supports docker mode', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
    fs.readLocalFile.mockResolvedValueOnce('{}');

    const execSnapshots = mockExecAll(exec);

    fs.readLocalFile.mockResolvedValueOnce('{  }');

    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [
        { version: '7.2.34' },
        { version: '7.3' }, // composer versioning bug
        { version: '7.3.29' },
        { version: '7.4.22' },
        { version: '8.0.6' },
      ],
    });

    git.getRepoStatus.mockResolvedValueOnce({
      ...repoStatus,
      modified: ['composer.lock'],
    });

    expect(
      await composer.updateArtifacts({
        packageFileName: 'composer.json',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config: { ...config, constraints: { composer: '^1.10.0', php: '7.3' } },
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
    expect(execSnapshots).toHaveLength(3);
  });

  it('supports global mode', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'global' });
    fs.readLocalFile.mockResolvedValueOnce('{}');
    const execSnapshots = mockExecAll(exec);
    fs.readLocalFile.mockResolvedValueOnce('{ }');
    git.getRepoStatus.mockResolvedValueOnce({
      ...repoStatus,
      modified: ['composer.lock'],
    });
    expect(
      await composer.updateArtifacts({
        packageFileName: 'composer.json',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('catches errors', async () => {
    fs.readLocalFile.mockResolvedValueOnce('{}');
    fs.writeLocalFile.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    expect(
      await composer.updateArtifacts({
        packageFileName: 'composer.json',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config,
      })
    ).toMatchSnapshot([{ artifactError: { lockFile: 'composer.lock' } }]);
  });

  it('catches unmet requirements errors', async () => {
    const stderr =
      'fooYour requirements could not be resolved to an installable set of packages.bar';
    fs.readLocalFile.mockResolvedValueOnce('{}');
    fs.writeLocalFile.mockImplementationOnce(() => {
      throw new Error(stderr);
    });
    expect(
      await composer.updateArtifacts({
        packageFileName: 'composer.json',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config,
      })
    ).toMatchSnapshot([
      { artifactError: { lockFile: 'composer.lock', stderr } },
    ]);
  });

  it('throws for disk space', async () => {
    fs.readLocalFile.mockResolvedValueOnce('{}');
    fs.writeLocalFile.mockImplementationOnce(() => {
      throw new Error(
        'vendor/composer/07fe2366/sebastianbergmann-php-code-coverage-c896779/src/Report/Html/Renderer/Template/js/d3.min.js:  write error (disk full?).  Continue? (y/n/^C) '
      );
    });
    await expect(
      composer.updateArtifacts({
        packageFileName: 'composer.json',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config,
      })
    ).rejects.toThrow();
  });

  it('disables ignorePlatformReqs', async () => {
    fs.readLocalFile.mockResolvedValueOnce('{}');
    const execSnapshots = mockExecAll(exec);
    fs.readLocalFile.mockResolvedValueOnce('{ }');
    git.getRepoStatus.mockResolvedValueOnce({
      ...repoStatus,
      modified: ['composer.lock'],
    });
    expect(
      await composer.updateArtifacts({
        packageFileName: 'composer.json',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config: {
          ...config,
          composerIgnorePlatformReqs: null,
        },
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('adds all ignorePlatformReq items', async () => {
    fs.readLocalFile.mockResolvedValueOnce('{}');
    const execSnapshots = mockExecAll(exec);
    fs.readLocalFile.mockResolvedValueOnce('{ }');
    git.getRepoStatus.mockResolvedValueOnce({
      ...repoStatus,
      modified: ['composer.lock'],
    });
    expect(
      await composer.updateArtifacts({
        packageFileName: 'composer.json',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config: {
          ...config,
          composerIgnorePlatformReqs: ['ext-posix', 'ext-sodium'],
        },
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('installs before running the update when symfony flex is installed', async () => {
    fs.readLocalFile.mockResolvedValueOnce(
      '{"packages":[{"name":"symfony/flex","version":"1.17.1"}]}'
    );
    const execSnapshots = mockExecAll(exec);
    fs.readLocalFile.mockResolvedValueOnce('{ }');
    git.getRepoStatus.mockResolvedValueOnce({
      ...repoStatus,
      modified: ['composer.lock'],
    });
    expect(
      await composer.updateArtifacts({
        packageFileName: 'composer.json',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config: {
          ...config,
        },
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
    expect(execSnapshots).toHaveLength(2);
  });

  it('installs before running the update when symfony flex is installed as dev', async () => {
    fs.readLocalFile.mockResolvedValueOnce(
      '{"packages-dev":[{"name":"symfony/flex","version":"1.17.1"}]}'
    );
    const execSnapshots = mockExecAll(exec);
    fs.readLocalFile.mockResolvedValueOnce('{ }');
    git.getRepoStatus.mockResolvedValueOnce({
      ...repoStatus,
      modified: ['composer.lock'],
    });
    expect(
      await composer.updateArtifacts({
        packageFileName: 'composer.json',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config: {
          ...config,
        },
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
    expect(execSnapshots).toHaveLength(2);
  });

  it('does not disable plugins when configured globally', async () => {
    fs.readLocalFile.mockResolvedValueOnce('{}');
    const execSnapshots = mockExecAll(exec);
    fs.readLocalFile.mockResolvedValueOnce('{}');
    git.getRepoStatus.mockResolvedValueOnce(repoStatus);
    GlobalConfig.set({ ...adminConfig, allowPlugins: true });
    expect(
      await composer.updateArtifacts({
        packageFileName: 'composer.json',
        updatedDeps: [{ depName: 'foo' }, { depName: 'bar' }],
        newPackageFileContent: '{}',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('disable plugins when configured locally', async () => {
    fs.readLocalFile.mockResolvedValueOnce('{}');
    const execSnapshots = mockExecAll(exec);
    fs.readLocalFile.mockResolvedValueOnce('{}');
    git.getRepoStatus.mockResolvedValueOnce(repoStatus);
    GlobalConfig.set({ ...adminConfig, allowPlugins: true });
    expect(
      await composer.updateArtifacts({
        packageFileName: 'composer.json',
        updatedDeps: [{ depName: 'foo' }, { depName: 'bar' }],
        newPackageFileContent: '{}',
        config: {
          ...config,
          ignorePlugins: true,
        },
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
});
