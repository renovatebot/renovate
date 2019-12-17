import _fs from 'fs-extra';
import * as composer from '../../../lib/manager/composer/artifacts';
import { platform as _platform } from '../../../lib/platform';

jest.mock('fs-extra');
jest.mock('../../../lib/util/exec');
jest.mock('../../../lib/util/host-rules');

const { exec } = require('../../../lib/util/exec');
const hostRules = require('../../../lib/util/host-rules');

const platform: any = _platform;
const fs: any = _fs;

const config = {
  localDir: '/tmp/github/some/repo',
  cacheDir: '/tmp/renovate/cache',
};

describe('.updateArtifacts()', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });
  afterEach(() => {
    delete global.trustLevel;
  });
  it('returns if no composer.lock found', async () => {
    expect(
      await composer.updateArtifacts('composer.json', [], '{}', config)
    ).toBeNull();
  });
  it('returns null if unchanged', async () => {
    platform.getFile.mockReturnValueOnce('Current composer.lock');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'Current composer.lock');
    platform.getRepoStatus.mockResolvedValue({ modified: [] });
    expect(
      await composer.updateArtifacts('composer.json', [], '{}', config)
    ).toBeNull();
  });
  it('uses hostRules to write auth.json', async () => {
    platform.getFile.mockReturnValueOnce('Current composer.lock');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'Current composer.lock');
    const authConfig = {
      localDir: '/tmp/github/some/repo',
      registryUrls: ['https://packagist.renovatebot.com'],
    };
    hostRules.find.mockReturnValue({
      username: 'some-username',
      password: 'some-password',
    });
    platform.getRepoStatus.mockResolvedValue({ modified: [] });
    expect(
      await composer.updateArtifacts('composer.json', [], '{}', authConfig)
    ).toBeNull();
  });
  it('returns updated composer.lock', async () => {
    platform.getFile.mockReturnValueOnce('Current composer.lock');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'New composer.lock');
    global.trustLevel = 'high';
    platform.getRepoStatus.mockResolvedValue({ modified: ['composer.lock'] });
    expect(
      await composer.updateArtifacts('composer.json', [], '{}', config)
    ).not.toBeNull();
  });
  it('performs lockFileMaintenance', async () => {
    platform.getFile.mockReturnValueOnce('Current composer.lock');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'New composer.lock');
    platform.getRepoStatus.mockResolvedValue({ modified: ['composer.lock'] });
    expect(
      await composer.updateArtifacts('composer.json', [], '{}', {
        ...config,
        isLockFileMaintenance: true,
      })
    ).not.toBeNull();
  });
  it('supports docker mode', async () => {
    platform.getFile.mockReturnValueOnce('Current composer.lock');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'New composer.lock');
    expect(
      await composer.updateArtifacts('composer.json', [], '{}', {
        ...config,
        binarySource: 'docker',
      })
    ).not.toBeNull();
  });
  it('supports global mode', async () => {
    platform.getFile.mockReturnValueOnce('Current composer.lock');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'New composer.lock');
    expect(
      await composer.updateArtifacts('composer.json', [], '{}', {
        ...config,
        binarySource: 'global',
      })
    ).not.toBeNull();
  });
  it('catches errors', async () => {
    platform.getFile.mockReturnValueOnce('Current composer.lock');
    fs.outputFile = jest.fn(() => {
      throw new Error('not found');
    });
    expect(
      await composer.updateArtifacts('composer.json', [], '{}', config)
    ).toMatchSnapshot();
  });
  it('catches unmet requirements errors', async () => {
    platform.getFile.mockReturnValueOnce('Current composer.lock');
    fs.outputFile = jest.fn(() => {
      throw new Error(
        'fooYour requirements could not be resolved to an installable set of packages.bar'
      );
    });
    expect(
      await composer.updateArtifacts('composer.json', [], '{}', config)
    ).toMatchSnapshot();
  });
  it('throws for disk space', async () => {
    platform.getFile.mockReturnValueOnce('Current composer.lock');
    fs.outputFile = jest.fn(() => {
      throw new Error(
        'vendor/composer/07fe2366/sebastianbergmann-php-code-coverage-c896779/src/Report/Html/Renderer/Template/js/d3.min.js:  write error (disk full?).  Continue? (y/n/^C) '
      );
    });
    await expect(
      composer.updateArtifacts('composer.json', [], '{}', config)
    ).rejects.toThrow();
  });
});
