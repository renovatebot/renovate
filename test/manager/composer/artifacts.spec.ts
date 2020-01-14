import _fs from 'fs-extra';
import { exec as _exec } from 'child_process';
import * as composer from '../../../lib/manager/composer/artifacts';
import { platform as _platform } from '../../../lib/platform';
import { mocked } from '../../util';
import { StatusResult } from '../../../lib/platform/git/storage';
import { envMock, mockExecAll } from '../../execUtil';
import * as _env from '../../../lib/util/exec/env';

jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('../../../lib/util/exec/env');
jest.mock('../../../lib/util/host-rules');

const hostRules = require('../../../lib/util/host-rules');

const fs: jest.Mocked<typeof _fs> = _fs as any;
const exec: jest.Mock<typeof _exec> = _exec as any;
const env = mocked(_env);
const platform = mocked(_platform);

const config = {
  localDir: '/tmp/github/some/repo',
  cacheDir: '/tmp/renovate/cache',
};

describe('.updateArtifacts()', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
  });
  it('returns if no composer.lock found', async () => {
    expect(
      await composer.updateArtifacts('composer.json', [], '{}', config)
    ).toBeNull();
  });
  it('returns null if unchanged', async () => {
    platform.getFile.mockResolvedValueOnce('Current composer.lock');
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockReturnValueOnce('Current composer.lock' as any);
    platform.getRepoStatus.mockResolvedValue({ modified: [] } as StatusResult);
    expect(
      await composer.updateArtifacts('composer.json', [], '{}', config)
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('uses hostRules to write auth.json', async () => {
    platform.getFile.mockResolvedValueOnce('Current composer.lock');
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockReturnValueOnce('Current composer.lock' as any);
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
      await composer.updateArtifacts('composer.json', [], '{}', authConfig)
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('returns updated composer.lock', async () => {
    platform.getFile.mockResolvedValueOnce('Current composer.lock');
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockReturnValueOnce('New composer.lock' as any);
    platform.getRepoStatus.mockResolvedValue({
      modified: ['composer.lock'],
    } as StatusResult);
    expect(
      await composer.updateArtifacts('composer.json', [], '{}', config)
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('performs lockFileMaintenance', async () => {
    platform.getFile.mockResolvedValueOnce('Current composer.lock');
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockReturnValueOnce('New composer.lock' as any);
    platform.getRepoStatus.mockResolvedValue({
      modified: ['composer.lock'],
    } as StatusResult);
    expect(
      await composer.updateArtifacts('composer.json', [], '{}', {
        ...config,
        isLockFileMaintenance: true,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('supports docker mode', async () => {
    platform.getFile.mockResolvedValueOnce('Current composer.lock');

    const execSnapshots = mockExecAll(exec);

    fs.readFile.mockReturnValueOnce('New composer.lock' as any);
    expect(
      await composer.updateArtifacts('composer.json', [], '{}', {
        ...config,
        binarySource: 'docker',
        dockerUser: 'foobar',
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('supports global mode', async () => {
    platform.getFile.mockResolvedValueOnce('Current composer.lock');
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockReturnValueOnce('New composer.lock' as any);
    expect(
      await composer.updateArtifacts('composer.json', [], '{}', {
        ...config,
        binarySource: 'global',
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('catches errors', async () => {
    platform.getFile.mockResolvedValueOnce('Current composer.lock');
    fs.outputFile.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    expect(
      await composer.updateArtifacts('composer.json', [], '{}', config)
    ).toMatchSnapshot();
  });
  it('catches unmet requirements errors', async () => {
    platform.getFile.mockResolvedValueOnce('Current composer.lock');
    fs.outputFile.mockImplementationOnce(() => {
      throw new Error(
        'fooYour requirements could not be resolved to an installable set of packages.bar'
      );
    });
    expect(
      await composer.updateArtifacts('composer.json', [], '{}', config)
    ).toMatchSnapshot();
  });
  it('throws for disk space', async () => {
    platform.getFile.mockResolvedValueOnce('Current composer.lock');
    fs.outputFile.mockImplementationOnce(() => {
      throw new Error(
        'vendor/composer/07fe2366/sebastianbergmann-php-code-coverage-c896779/src/Report/Html/Renderer/Template/js/d3.min.js:  write error (disk full?).  Continue? (y/n/^C) '
      );
    });
    await expect(
      composer.updateArtifacts('composer.json', [], '{}', config)
    ).rejects.toThrow();
  });
});
