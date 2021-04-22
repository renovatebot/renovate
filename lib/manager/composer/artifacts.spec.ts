import { exec as _exec } from 'child_process';
import { join } from 'upath';
import { envMock, mockExecAll } from '../../../test/exec-util';
import { env, fs, git, mocked, partial } from '../../../test/util';
import { setAdminConfig } from '../../config/admin';
import {
  PLATFORM_TYPE_GITHUB,
  PLATFORM_TYPE_GITLAB,
} from '../../constants/platforms';
import * as _datasource from '../../datasource';
import * as datasourcePackagist from '../../datasource/packagist';
import { setUtilConfig } from '../../util';
import { BinarySource } from '../../util/exec/common';
import * as docker from '../../util/exec/docker';
import { StatusResult } from '../../util/git';
import * as hostRules from '../../util/host-rules';
import * as composer from './artifacts';

jest.mock('child_process');
jest.mock('../../util/exec/env');
jest.mock('../../../lib/datasource');
jest.mock('../../util/fs');
jest.mock('../../util/git');

const exec: jest.Mock<typeof _exec> = _exec as any;
const datasource = mocked(_datasource);

const config = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/renovate/cache'),
  composerIgnorePlatformReqs: true,
  ignoreScripts: false,
};

const repoStatus = partial<StatusResult>({
  modified: [],
  not_added: [],
  deleted: [],
});

describe('.updateArtifacts()', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    jest.resetModules();
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    await setUtilConfig(config);
    docker.resetPrefetchedImages();
    hostRules.clear();
    setAdminConfig({ allowScripts: false });
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
    fs.readLocalFile.mockResolvedValueOnce('Current composer.lock' as any);
    const execSnapshots = mockExecAll(exec);
    fs.readLocalFile.mockReturnValueOnce('Current composer.lock' as any);
    git.getRepoStatus.mockResolvedValue(repoStatus);
    setAdminConfig({ allowScripts: true });
    expect(
      await composer.updateArtifacts({
        packageFileName: 'composer.json',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('uses hostRules to set COMPOSER_AUTH', async () => {
    hostRules.add({
      hostType: PLATFORM_TYPE_GITHUB,
      hostName: 'api.github.com',
      token: 'github-token',
    });
    hostRules.add({
      hostType: PLATFORM_TYPE_GITLAB,
      hostName: 'gitlab.com',
      token: 'gitlab-token',
    });
    hostRules.add({
      hostType: datasourcePackagist.id,
      hostName: 'packagist.renovatebot.com',
      username: 'some-username',
      password: 'some-password',
    });
    hostRules.add({
      hostType: datasourcePackagist.id,
      endpoint: 'https://artifactory.yyyyyyy.com/artifactory/api/composer/',
      username: 'some-other-username',
      password: 'some-other-password',
    });
    hostRules.add({
      hostType: datasourcePackagist.id,
      username: 'some-other-username',
      password: 'some-other-password',
    });
    fs.readLocalFile.mockResolvedValueOnce('Current composer.lock' as any);
    const execSnapshots = mockExecAll(exec);
    fs.readLocalFile.mockReturnValueOnce('Current composer.lock' as any);
    const authConfig = {
      ...config,
      registryUrls: ['https://packagist.renovatebot.com'],
    };
    git.getRepoStatus.mockResolvedValue(repoStatus);
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
    fs.readLocalFile.mockResolvedValueOnce('Current composer.lock' as any);
    const execSnapshots = mockExecAll(exec);
    fs.readLocalFile.mockReturnValueOnce('New composer.lock' as any);
    git.getRepoStatus.mockResolvedValue({
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
    fs.readLocalFile.mockResolvedValueOnce('Current composer.lock' as any);
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValueOnce({
      ...repoStatus,
      modified: ['composer.lock', foo],
      not_added: [bar],
      deleted: [baz],
    });
    fs.readLocalFile.mockResolvedValueOnce('New composer.lock' as any);
    fs.readLocalFile.mockResolvedValueOnce('Foo' as any);
    fs.readLocalFile.mockResolvedValueOnce('Bar' as any);
    fs.getSiblingFileName.mockReturnValueOnce('vendor' as any);
    const res = await composer.updateArtifacts({
      packageFileName: 'composer.json',
      updatedDeps: [],
      newPackageFileContent: '{}',
      config,
    });
    expect(res).not.toBeNull();
    expect(res?.map(({ file }) => file)).toEqual([
      { contents: 'New composer.lock', name: 'composer.lock' },
      { contents: 'Foo', name: foo },
      { contents: 'Bar', name: bar },
      { contents: baz, name: '|delete|' },
    ]);
    expect(execSnapshots).toMatchSnapshot();
  });
  it('performs lockFileMaintenance', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current composer.lock' as any);
    const execSnapshots = mockExecAll(exec);
    fs.readLocalFile.mockReturnValueOnce('New composer.lock' as any);
    git.getRepoStatus.mockResolvedValue({
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
    jest.spyOn(docker, 'removeDanglingContainers').mockResolvedValueOnce();
    await setUtilConfig({ ...config, binarySource: BinarySource.Docker });
    fs.readLocalFile.mockResolvedValueOnce('Current composer.lock' as any);

    const execSnapshots = mockExecAll(exec);

    fs.readLocalFile.mockReturnValueOnce('New composer.lock' as any);
    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [
        { version: '1.10.0' },
        { version: '1.10.17' },
        { version: '2.0.0' },
        { version: '2.0.7' },
      ],
    });

    git.getRepoStatus.mockResolvedValue({
      ...repoStatus,
      modified: ['composer.lock'],
    });

    expect(
      await composer.updateArtifacts({
        packageFileName: 'composer.json',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config: { ...config, constraints: { composer: '^1.10.0' } },
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('supports global mode', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current composer.lock' as any);
    const execSnapshots = mockExecAll(exec);
    fs.readLocalFile.mockReturnValueOnce('New composer.lock' as any);
    git.getRepoStatus.mockResolvedValue({
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
          binarySource: BinarySource.Global,
        },
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('catches errors', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current composer.lock' as any);
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
    ).toMatchSnapshot();
  });
  it('catches unmet requirements errors', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current composer.lock' as any);
    fs.writeLocalFile.mockImplementationOnce(() => {
      throw new Error(
        'fooYour requirements could not be resolved to an installable set of packages.bar'
      );
    });
    expect(
      await composer.updateArtifacts({
        packageFileName: 'composer.json',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config,
      })
    ).toMatchSnapshot();
  });
  it('throws for disk space', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current composer.lock' as any);
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
    fs.readLocalFile.mockResolvedValueOnce('Current composer.lock' as any);
    const execSnapshots = mockExecAll(exec);
    fs.readLocalFile.mockReturnValueOnce('New composer.lock' as any);
    git.getRepoStatus.mockResolvedValue({
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
          composerIgnorePlatformReqs: false,
        },
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
});
