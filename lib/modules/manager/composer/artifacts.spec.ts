import { mockDeep } from 'jest-mock-extended';
import { join } from 'upath';
import { envMock, mockExecAll } from '../../../../test/exec-util';
import { env, fs, git, mocked, partial } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import * as docker from '../../../util/exec/docker';
import type { StatusResult } from '../../../util/git/types';
import * as hostRules from '../../../util/host-rules';
import * as _datasource from '../../datasource';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { PackagistDatasource } from '../../datasource/packagist';
import type { UpdateArtifactsConfig } from '../types';
import * as composer from '.';

jest.mock('../../../util/exec/env');
jest.mock('../../datasource', () => mockDeep());
jest.mock('../../../util/fs');
jest.mock('../../../util/git');

process.env.CONTAINERBASE = 'true';

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
  containerbaseDir: join('/tmp/renovate/cache/containerbase'),
  dockerSidecarImage: 'ghcr.io/containerbase/sidecar',
};

const repoStatus = partial<StatusResult>({
  modified: [],
  not_added: [],
  deleted: [],
});

describe('modules/manager/composer/artifacts', () => {
  beforeEach(() => {
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
      }),
    ).toBeNull();
  });

  it('returns null if unchanged', async () => {
    fs.readLocalFile.mockResolvedValueOnce('{}');
    const execSnapshots = mockExecAll();
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
        updatedDeps: [
          { depName: 'foo', newVersion: '1.0.0' },
          { depName: 'bar', newVersion: '2.0.0' },
        ],
        newPackageFileContent: '{}',
        config,
      }),
    ).toBeNull();
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'composer update foo:1.0.0 bar:2.0.0 --with-dependencies --ignore-platform-reqs --no-ansi --no-interaction',
        options: {
          cwd: '/tmp/github/some/repo',
          env: {
            COMPOSER_CACHE_DIR: '/tmp/renovate/cache/others/composer',
          },
        },
      },
    ]);
  });

  it('uses hostRules to set COMPOSER_AUTH', async () => {
    hostRules.add({
      hostType: 'github',
      matchHost: 'api.github.com',
      token: 'ghp_github-token',
    });
    // This rule should not affect the result the Github rule has priority to avoid breaking changes.
    hostRules.add({
      hostType: GitTagsDatasource.id,
      matchHost: 'github.com',
      token: 'ghp_git-tags-token',
    });
    hostRules.add({
      hostType: 'gitlab',
      matchHost: 'gitlab.com',
      token: 'gitlab-token',
    });
    hostRules.add({
      hostType: PackagistDatasource.id,
      matchHost: 'packagist.renovatebot.com',
      username: 'some-username',
      password: 'some-password',
    });
    hostRules.add({
      hostType: PackagistDatasource.id,
      matchHost: 'https://artifactory.yyyyyyy.com/artifactory/api/composer/',
      username: 'some-other-username',
      password: 'some-other-password',
    });
    hostRules.add({
      hostType: PackagistDatasource.id,
      username: 'some-other-username',
      password: 'some-other-password',
    });
    hostRules.add({
      hostType: PackagistDatasource.id,
      matchHost: 'https://packages-bearer.example.com/',
      token: 'abcdef0123456789',
    });
    fs.readLocalFile.mockResolvedValueOnce('{}');
    const execSnapshots = mockExecAll();
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
      }),
    ).toBeNull();
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'composer update --with-dependencies --ignore-platform-reqs --no-ansi --no-interaction --no-scripts --no-autoloader --no-plugins',
        options: {
          cwd: '/tmp/github/some/repo',
          env: {
            COMPOSER_AUTH:
              '{"github-oauth":{"github.com":"ghp_git-tags-token"},' +
              '"gitlab-token":{"gitlab.com":"gitlab-token"},' +
              '"gitlab-domains":["gitlab.com"],' +
              '"http-basic":{' +
              '"packagist.renovatebot.com":{"username":"some-username","password":"some-password"},' +
              '"artifactory.yyyyyyy.com":{"username":"some-other-username","password":"some-other-password"}' +
              '},' +
              '"bearer":{"packages-bearer.example.com":"abcdef0123456789"}}',
            COMPOSER_CACHE_DIR: '/tmp/renovate/cache/others/composer',
          },
        },
      },
    ]);
  });

  it('git-tags hostRule for github.com set github-token in COMPOSER_AUTH', async () => {
    hostRules.add({
      hostType: GitTagsDatasource.id,
      matchHost: 'github.com',
      token: 'ghp_token',
    });
    fs.readLocalFile.mockResolvedValueOnce('{}');
    const execSnapshots = mockExecAll();
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
      }),
    ).toBeNull();

    expect(execSnapshots).toMatchObject([
      {
        options: {
          env: {
            COMPOSER_AUTH: '{"github-oauth":{"github.com":"ghp_token"}}',
          },
        },
      },
    ]);
  });

  it('Skip github application access token hostRules in COMPOSER_AUTH', async () => {
    hostRules.add({
      hostType: 'github',
      matchHost: 'api.github.com',
      token: 'ghs_token',
    });
    hostRules.add({
      hostType: GitTagsDatasource.id,
      matchHost: 'github.com',
      token: 'ghp_token',
    });
    fs.readLocalFile.mockResolvedValueOnce('{}');
    const execSnapshots = mockExecAll();
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
      }),
    ).toBeNull();
    expect(execSnapshots).toMatchObject([
      {
        options: {
          env: {
            COMPOSER_AUTH: '{"github-oauth":{"github.com":"ghp_token"}}',
          },
        },
      },
    ]);
  });

  it('github hostRule for github.com with x-access-token set github-token in COMPOSER_AUTH', async () => {
    hostRules.add({
      hostType: 'github',
      matchHost: 'https://api.github.com/',
      token: 'x-access-token:ghp_token',
    });
    fs.readLocalFile.mockResolvedValueOnce('{}');
    const execSnapshots = mockExecAll();
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
      }),
    ).toBeNull();

    expect(execSnapshots).toMatchObject([
      {
        options: {
          env: {
            COMPOSER_AUTH: '{"github-oauth":{"github.com":"ghp_token"}}',
          },
        },
      },
    ]);
  });

  it('does set github COMPOSER_AUTH for github when only hostType git-tags artifactAuth does not include composer', async () => {
    hostRules.add({
      hostType: 'github',
      matchHost: 'api.github.com',
      token: 'ghs_token',
    });
    hostRules.add({
      hostType: GitTagsDatasource.id,
      matchHost: 'github.com',
      token: 'ghp_token',
      artifactAuth: [],
    });
    fs.readLocalFile.mockResolvedValueOnce('{}');
    const execSnapshots = mockExecAll();
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
      }),
    ).toBeNull();
    expect(execSnapshots).toMatchObject([
      {
        options: {
          env: {
            COMPOSER_AUTH: '{"github-oauth":{"github.com":"ghs_token"}}',
          },
        },
      },
    ]);
  });

  it('does set github COMPOSER_AUTH for git-tags when only hostType github artifactAuth does not include composer', async () => {
    hostRules.add({
      hostType: 'github',
      matchHost: 'api.github.com',
      token: 'ghs_token',
      artifactAuth: [],
    });
    hostRules.add({
      hostType: GitTagsDatasource.id,
      matchHost: 'github.com',
      token: 'ghp_token',
    });
    fs.readLocalFile.mockResolvedValueOnce('{}');
    const execSnapshots = mockExecAll();
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
      }),
    ).toBeNull();
    expect(execSnapshots).toMatchObject([
      {
        options: {
          env: {
            COMPOSER_AUTH: '{"github-oauth":{"github.com":"ghp_token"}}',
          },
        },
      },
    ]);
  });

  it('does not set github COMPOSER_AUTH when artifactAuth does not include composer, for both hostType github & git-tags', async () => {
    hostRules.add({
      hostType: 'github',
      matchHost: 'api.github.com',
      token: 'ghs_token',
      artifactAuth: [],
    });
    hostRules.add({
      hostType: GitTagsDatasource.id,
      matchHost: 'github.com',
      token: 'ghp_token',
      artifactAuth: [],
    });
    fs.readLocalFile.mockResolvedValueOnce('{}');
    const execSnapshots = mockExecAll();
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
      }),
    ).toBeNull();
    expect(execSnapshots[0].options?.env).not.toContainKey('COMPOSER_AUTH');
  });

  it('does not set gitlab COMPOSER_AUTH when artifactAuth does not include composer', async () => {
    hostRules.add({
      hostType: GitTagsDatasource.id,
      matchHost: 'github.com',
      token: 'ghp_token',
    });
    hostRules.add({
      hostType: 'gitlab',
      matchHost: 'gitlab.com',
      token: 'gitlab-token',
      artifactAuth: [],
    });
    fs.readLocalFile.mockResolvedValueOnce('{}');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce('{}');
    const authConfig = {
      ...config,
      postUpdateOptions: ['composerGitlabToken'],
      registryUrls: ['https://packagist.renovatebot.com'],
    };
    git.getRepoStatus.mockResolvedValueOnce(repoStatus);
    expect(
      await composer.updateArtifacts({
        packageFileName: 'composer.json',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config: authConfig,
      }),
    ).toBeNull();

    expect(execSnapshots).toMatchObject([
      {
        options: {
          env: {
            COMPOSER_AUTH: '{"github-oauth":{"github.com":"ghp_token"}}',
          },
        },
      },
    ]);
  });

  it('does not set packagist COMPOSER_AUTH when artifactAuth does not include composer', async () => {
    hostRules.add({
      hostType: GitTagsDatasource.id,
      matchHost: 'github.com',
      token: 'ghp_token',
    });
    hostRules.add({
      hostType: PackagistDatasource.id,
      matchHost: 'packagist.renovatebot.com',
      username: 'some-username',
      password: 'some-password',
      artifactAuth: [],
    });
    hostRules.add({
      hostType: PackagistDatasource.id,
      matchHost: 'https://artifactory.yyyyyyy.com/artifactory/api/composer/',
      username: 'some-other-username',
      password: 'some-other-password',
      artifactAuth: [],
    });
    hostRules.add({
      hostType: PackagistDatasource.id,
      username: 'some-other-username',
      password: 'some-other-password',
      artifactAuth: [],
    });
    hostRules.add({
      hostType: PackagistDatasource.id,
      matchHost: 'https://packages-bearer.example.com/',
      token: 'abcdef0123456789',
      artifactAuth: [],
    });
    fs.readLocalFile.mockResolvedValueOnce('{}');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce('{}');
    const authConfig = {
      ...config,
      postUpdateOptions: ['composerGitlabToken'],
      registryUrls: ['https://packagist.renovatebot.com'],
    };
    git.getRepoStatus.mockResolvedValueOnce(repoStatus);
    expect(
      await composer.updateArtifacts({
        packageFileName: 'composer.json',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config: authConfig,
      }),
    ).toBeNull();

    expect(execSnapshots).toMatchObject([
      {
        options: {
          env: {
            COMPOSER_AUTH: '{"github-oauth":{"github.com":"ghp_token"}}',
          },
        },
      },
    ]);
  });

  it('does set gitlab COMPOSER_AUTH when artifactAuth does include composer', async () => {
    hostRules.add({
      hostType: GitTagsDatasource.id,
      matchHost: 'github.com',
      token: 'ghp_token',
    });
    hostRules.add({
      hostType: 'gitlab',
      matchHost: 'gitlab.com',
      token: 'gitlab-token',
      artifactAuth: ['composer'],
    });
    fs.readLocalFile.mockResolvedValueOnce('{}');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce('{}');
    const authConfig = {
      ...config,
      postUpdateOptions: ['composerGitlabToken'],
      registryUrls: ['https://packagist.renovatebot.com'],
    };
    git.getRepoStatus.mockResolvedValueOnce(repoStatus);
    expect(
      await composer.updateArtifacts({
        packageFileName: 'composer.json',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config: authConfig,
      }),
    ).toBeNull();

    expect(execSnapshots).toMatchObject([
      {
        options: {
          env: {
            COMPOSER_AUTH:
              '{"github-oauth":{"github.com":"ghp_token"},' +
              '"gitlab-token":{"gitlab.com":"gitlab-token"},' +
              '"gitlab-domains":["gitlab.com"]}',
          },
        },
      },
    ]);
  });

  it('does set packagist COMPOSER_AUTH when artifactAuth does include composer', async () => {
    hostRules.add({
      hostType: GitTagsDatasource.id,
      matchHost: 'github.com',
      token: 'ghp_token',
    });
    hostRules.add({
      hostType: PackagistDatasource.id,
      matchHost: 'packagist.renovatebot.com',
      username: 'some-username',
      password: 'some-password',
      artifactAuth: ['composer'],
    });
    hostRules.add({
      hostType: PackagistDatasource.id,
      matchHost: 'https://artifactory.yyyyyyy.com/artifactory/api/composer/',
      username: 'some-other-username',
      password: 'some-other-password',
      artifactAuth: ['composer'],
    });
    hostRules.add({
      hostType: PackagistDatasource.id,
      username: 'some-other-username',
      password: 'some-other-password',
      artifactAuth: ['composer'],
    });
    hostRules.add({
      hostType: PackagistDatasource.id,
      matchHost: 'https://packages-bearer.example.com/',
      token: 'abcdef0123456789',
      artifactAuth: ['composer'],
    });
    fs.readLocalFile.mockResolvedValueOnce('{}');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce('{}');
    const authConfig = {
      ...config,
      postUpdateOptions: ['composerGitlabToken'],
      registryUrls: ['https://packagist.renovatebot.com'],
    };
    git.getRepoStatus.mockResolvedValueOnce(repoStatus);
    expect(
      await composer.updateArtifacts({
        packageFileName: 'composer.json',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config: authConfig,
      }),
    ).toBeNull();

    expect(execSnapshots).toMatchObject([
      {
        options: {
          env: {
            COMPOSER_AUTH:
              '{"github-oauth":{"github.com":"ghp_token"},' +
              '"http-basic":{' +
              '"packagist.renovatebot.com":{"username":"some-username","password":"some-password"},' +
              '"artifactory.yyyyyyy.com":{"username":"some-other-username","password":"some-other-password"}' +
              '},' +
              '"bearer":{"packages-bearer.example.com":"abcdef0123456789"}}',
          },
        },
      },
    ]);
  });

  it('returns updated composer.lock', async () => {
    fs.readLocalFile.mockResolvedValueOnce('{}');
    const execSnapshots = mockExecAll();
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
      }),
    ).toEqual([
      {
        file: {
          contents: '{}',
          path: 'composer.lock',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'composer update --with-dependencies --ignore-platform-reqs --no-ansi --no-interaction --no-scripts --no-autoloader --no-plugins',
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });

  it('supports vendor directory update', async () => {
    const foo = join('vendor/foo/Foo.php');
    const bar = join('vendor/bar/Bar.php');
    const baz = join('vendor/baz/Baz.php');
    fs.localPathExists.mockResolvedValueOnce(true);
    fs.readLocalFile.mockResolvedValueOnce('{}');
    const execSnapshots = mockExecAll();
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
    expect(res).toEqual([
      {
        file: {
          contents: '{  }',
          path: 'composer.lock',
          type: 'addition',
        },
      },
      {
        file: {
          contents: 'Foo',
          path: 'vendor/foo/Foo.php',
          type: 'addition',
        },
      },
      {
        file: {
          contents: 'Bar',
          path: 'vendor/bar/Bar.php',
          type: 'addition',
        },
      },
      {
        file: {
          path: 'vendor/baz/Baz.php',
          type: 'deletion',
        },
      },
    ]);

    expect(execSnapshots).toMatchObject([
      {
        cmd: 'composer update --with-dependencies --ignore-platform-reqs --no-ansi --no-interaction --no-scripts --no-autoloader --no-plugins',
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });

  it('performs lockFileMaintenance', async () => {
    fs.readLocalFile.mockResolvedValueOnce('{}');
    const execSnapshots = mockExecAll();
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
      }),
    ).toEqual([
      {
        file: {
          contents: '{  }',
          path: 'composer.lock',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'composer update --ignore-platform-reqs --no-ansi --no-interaction --no-scripts --no-autoloader --no-plugins',
        options: { cwd: '/tmp/github/some/repo', encoding: 'utf-8' },
      },
    ]);
  });

  it('supports docker mode', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
    fs.readLocalFile.mockResolvedValueOnce('{}');

    const execSnapshots = mockExecAll();

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
      }),
    ).toEqual([
      {
        file: {
          contents: '{  }',
          path: 'composer.lock',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'docker pull ghcr.io/containerbase/sidecar',
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
        cmd:
          'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
          '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
          '-v "/tmp/renovate/cache":"/tmp/renovate/cache" ' +
          '-e COMPOSER_CACHE_DIR ' +
          '-e CONTAINERBASE_CACHE_DIR ' +
          '-w "/tmp/github/some/repo" ' +
          'ghcr.io/containerbase/sidecar' +
          ' bash -l -c "' +
          'install-tool php 7.3' +
          ' && ' +
          'install-tool composer 1.10.17' +
          ' && ' +
          'composer update --with-dependencies --ignore-platform-reqs --no-ansi --no-interaction --no-scripts --no-autoloader --no-plugins' +
          '"',
        options: {
          cwd: '/tmp/github/some/repo',
          env: {
            COMPOSER_CACHE_DIR: '/tmp/renovate/cache/others/composer',
          },
        },
      },
    ]);
  });

  it('supports install mode', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
    fs.readLocalFile.mockResolvedValueOnce('{}');

    const execSnapshots = mockExecAll();

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
      }),
    ).toEqual([
      {
        file: {
          contents: '{  }',
          path: 'composer.lock',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'install-tool php 7.3',
      },
      {
        cmd: 'install-tool composer 1.10.17',
      },
      {
        cmd: 'composer update --with-dependencies --ignore-platform-reqs --no-ansi --no-interaction --no-scripts --no-autoloader --no-plugins',
        options: {
          cwd: '/tmp/github/some/repo',
          env: {
            COMPOSER_CACHE_DIR: '/tmp/renovate/cache/others/composer',
          },
        },
      },
    ]);
  });

  it('supports global mode', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'global' });
    fs.readLocalFile.mockResolvedValueOnce('{}');
    const execSnapshots = mockExecAll();
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
      }),
    ).toEqual([
      {
        file: {
          contents: '{ }',
          path: 'composer.lock',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'composer update --with-dependencies --ignore-platform-reqs --no-ansi --no-interaction --no-scripts --no-autoloader --no-plugins',
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });

  it('catches errors', async () => {
    const execSnapshots = mockExecAll();
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
      }),
    ).toEqual([
      {
        artifactError: {
          lockFile: 'composer.lock',
          stderr: 'not found',
        },
      },
    ]);
    expect(execSnapshots).toBeEmptyArray();
  });

  it('catches unmet requirements errors', async () => {
    const execSnapshots = mockExecAll();
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
      }),
    ).toEqual([{ artifactError: { lockFile: 'composer.lock', stderr } }]);
    expect(execSnapshots).toBeEmptyArray();
  });

  it('throws for disk space', async () => {
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce('{}');
    fs.writeLocalFile.mockImplementationOnce(() => {
      throw new Error(
        'vendor/composer/07fe2366/sebastianbergmann-php-code-coverage-c896779/src/Report/Html/Renderer/Template/js/d3.min.js:  write error (disk full?).  Continue? (y/n/^C) ',
      );
    });
    await expect(
      composer.updateArtifacts({
        packageFileName: 'composer.json',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config,
      }),
    ).rejects.toThrow();
    expect(execSnapshots).toBeEmptyArray();
  });

  it('disables ignorePlatformReqs', async () => {
    fs.readLocalFile.mockResolvedValueOnce('{}');
    const execSnapshots = mockExecAll();
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
          composerIgnorePlatformReqs: undefined,
        },
      }),
    ).toEqual([
      {
        file: {
          contents: '{ }',
          path: 'composer.lock',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'composer update --with-dependencies --no-ansi --no-interaction --no-scripts --no-autoloader --no-plugins',
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });

  it('adds all ignorePlatformReq items', async () => {
    fs.readLocalFile.mockResolvedValueOnce('{}');
    const execSnapshots = mockExecAll();
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
      }),
    ).toEqual([
      {
        file: {
          contents: '{ }',
          path: 'composer.lock',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'composer update --with-dependencies --ignore-platform-req ext-posix --ignore-platform-req ext-sodium --no-ansi --no-interaction --no-scripts --no-autoloader --no-plugins',
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });

  it('installs before running the update when symfony flex is installed', async () => {
    fs.readLocalFile.mockResolvedValueOnce(
      '{"packages":[{"name":"symfony/flex","version":"1.17.1"}]}',
    );
    const execSnapshots = mockExecAll();
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
      }),
    ).toEqual([
      {
        file: {
          contents: '{ }',
          path: 'composer.lock',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'git stash -- composer.json',
      },
      {
        cmd: 'composer install --ignore-platform-reqs --no-ansi --no-interaction --no-scripts --no-autoloader --no-plugins',
        options: { cwd: '/tmp/github/some/repo' },
      },
      {
        cmd: 'git stash pop || true',
      },
      {
        cmd: 'composer update --with-dependencies --ignore-platform-reqs --no-ansi --no-interaction --no-scripts --no-autoloader --no-plugins',
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });

  it('installs before running the update when symfony flex is installed as dev', async () => {
    fs.readLocalFile.mockResolvedValueOnce(
      '{"packages-dev":[{"name":"symfony/flex","version":"1.17.1"}]}',
    );
    const execSnapshots = mockExecAll();
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
      }),
    ).toEqual([
      {
        file: {
          contents: '{ }',
          path: 'composer.lock',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'git stash -- composer.json',
      },
      {
        cmd: 'composer install --ignore-platform-reqs --no-ansi --no-interaction --no-scripts --no-autoloader --no-plugins',
        options: { cwd: '/tmp/github/some/repo', encoding: 'utf-8' },
      },
      {
        cmd: 'git stash pop || true',
      },
      {
        cmd: 'composer update --with-dependencies --ignore-platform-reqs --no-ansi --no-interaction --no-scripts --no-autoloader --no-plugins',
        options: { cwd: '/tmp/github/some/repo', encoding: 'utf-8' },
      },
    ]);
  });

  it('does not disable plugins when configured globally', async () => {
    fs.readLocalFile.mockResolvedValueOnce('{}');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce('{}');
    git.getRepoStatus.mockResolvedValueOnce(repoStatus);
    GlobalConfig.set({ ...adminConfig, allowPlugins: true });
    expect(
      await composer.updateArtifacts({
        packageFileName: 'composer.json',
        updatedDeps: [
          { depName: 'foo', newVersion: '1.0.0' },
          { depName: 'bar', newVersion: '2.0.0' },
        ],
        newPackageFileContent: '{}',
        config,
      }),
    ).toBeNull();
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'composer update foo:1.0.0 bar:2.0.0 --with-dependencies --ignore-platform-reqs --no-ansi --no-interaction --no-scripts --no-autoloader',
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });

  it('disable plugins when configured locally', async () => {
    fs.readLocalFile.mockResolvedValueOnce('{}');
    const execSnapshots = mockExecAll();
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
      }),
    ).toBeNull();
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'composer update foo bar --with-dependencies --ignore-platform-reqs --no-ansi --no-interaction --no-scripts --no-autoloader --no-plugins',
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });

  it('includes new dependency version in update command', async () => {
    fs.readLocalFile.mockResolvedValueOnce('{}');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce('{}');
    git.getRepoStatus.mockResolvedValueOnce(repoStatus);

    expect(
      await composer.updateArtifacts({
        packageFileName: 'composer.json',
        updatedDeps: [{ depName: 'foo', newVersion: '1.1.0' }],
        newPackageFileContent: '{}',
        config,
      }),
    ).toBeNull();
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'composer update foo:1.1.0 --with-dependencies --ignore-platform-reqs --no-ansi --no-interaction --no-scripts --no-autoloader --no-plugins',
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });
});
