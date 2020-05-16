import { exec as _exec } from 'child_process';
import { join } from 'upath';
import { envMock, mockExecAll } from '../../../test/execUtil';
import { mocked } from '../../../test/util';
import { platform as _platform } from '../../platform';
import { StatusResult } from '../../platform/git/storage';
import { setUtilConfig } from '../../util';
import { BinarySource } from '../../util/exec/common';
import { resetPrefetchedImages } from '../../util/exec/docker';
import * as _env from '../../util/exec/env';
import * as _fs from '../../util/fs';
import * as composer from './artifacts';

jest.mock('child_process');
jest.mock('../../util/exec/env');
jest.mock('../../util/fs');
jest.mock('../../util/host-rules');

const hostRules = require('../../util/host-rules');

const fs: jest.Mocked<typeof _fs> = _fs as any;
const exec: jest.Mock<typeof _exec> = _exec as any;
const env = mocked(_env);
const platform = mocked(_platform);
jest.mock('../../util/exec/docker/index', () =>
  require('../../../test/util').mockPartial('../../util/exec/docker/index', {
    removeDanglingContainers: jest.fn(),
  })
);

const config = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/renovate/cache'),
  dockerUser: 'foobar',
  composerIgnorePlatformReqs: true,
};

describe('.updateArtifacts()', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    jest.resetModules();
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    await setUtilConfig(config);
    resetPrefetchedImages();
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
    platform.getRepoStatus.mockResolvedValue({ modified: [] } as StatusResult);
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
  it('uses hostRules to write auth.json', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current composer.lock' as any);
    const execSnapshots = mockExecAll(exec);
    fs.readLocalFile.mockReturnValueOnce('Current composer.lock' as any);
    const authConfig = {
      ...config,
      registryUrls: ['https://packagist.renovatebot.com'],
    };
    hostRules.find.mockReturnValue({
      username: 'some-username',
      password: 'some-password',
    });
    platform.getRepoStatus.mockResolvedValue({ modified: [] } as StatusResult);
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
    platform.getRepoStatus.mockResolvedValue({
      modified: ['composer.lock'],
    } as StatusResult);
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
  it('performs lockFileMaintenance', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current composer.lock' as any);
    const execSnapshots = mockExecAll(exec);
    fs.readLocalFile.mockReturnValueOnce('New composer.lock' as any);
    platform.getRepoStatus.mockResolvedValue({
      modified: ['composer.lock'],
    } as StatusResult);
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
    await setUtilConfig({ ...config, binarySource: BinarySource.Docker });
    fs.readLocalFile.mockResolvedValueOnce('Current composer.lock' as any);

    const execSnapshots = mockExecAll(exec);

    fs.readLocalFile.mockReturnValueOnce('New composer.lock' as any);
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
  it('supports global mode', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current composer.lock' as any);
    const execSnapshots = mockExecAll(exec);
    fs.readLocalFile.mockReturnValueOnce('New composer.lock' as any);
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
    platform.getRepoStatus.mockResolvedValue({
      modified: ['composer.lock'],
    } as StatusResult);
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
