import _fs from 'fs-extra';
import { exec as _exec } from '../../../lib/util/exec';
import * as pipenv from '../../../lib/manager/pipenv/artifacts';
import { platform as _platform } from '../../../lib/platform';

jest.mock('fs-extra');
jest.mock('../../../lib/util/exec');
jest.mock('../../../lib/util/host-rules');

const fs: any = _fs;
const exec: any = _exec;

const platform: any = _platform;

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
  it('returns if no Pipfile.lock found', async () => {
    expect(await pipenv.updateArtifacts('Pipfile', [], '', config)).toBeNull();
  });
  it('returns null if unchanged', async () => {
    platform.getFile.mockReturnValueOnce('Current Pipfile.lock');
    exec.mockReturnValueOnce({
      stdout: 'Locking',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'Current Pipfile.lock');
    expect(
      await pipenv.updateArtifacts('Pipfile', [], '{}', config)
    ).toBeNull();
  });
  it('returns updated Pipfile.lock', async () => {
    platform.getFile.mockReturnValueOnce('Current Pipfile.lock');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    platform.getRepoStatus.mockResolvedValue({ modified: ['Pipfile.lock'] });
    fs.readFile = jest.fn(() => 'New Pipfile.lock');
    global.trustLevel = 'high';
    expect(
      await pipenv.updateArtifacts('Pipfile', [], '{}', config)
    ).not.toBeNull();
  });
  it('supports docker mode', async () => {
    platform.getFile.mockReturnValueOnce('Current Pipfile.lock');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    platform.getRepoStatus.mockResolvedValue({ modified: ['Pipfile.lock'] });
    fs.readFile = jest.fn(() => 'New Pipfile.lock');
    expect(
      await pipenv.updateArtifacts('Pipfile', [], '{}', {
        ...config,
        binarySource: 'docker',
      })
    ).not.toBeNull();
  });
  it('catches errors', async () => {
    platform.getFile.mockReturnValueOnce('Current Pipfile.lock');
    fs.outputFile = jest.fn(() => {
      throw new Error('not found');
    });
    expect(
      await pipenv.updateArtifacts('Pipfile', [], '{}', config)
    ).toMatchSnapshot();
  });
});
