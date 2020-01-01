import _fs from 'fs-extra';
import { exec as _exec } from 'child_process';
import * as pipenv from '../../../lib/manager/pipenv/artifacts';
import { platform as _platform } from '../../../lib/platform';
import { mocked } from '../../util';
import { StatusResult } from '../../../lib/platform/git/storage';

jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('../../../lib/util/host-rules');

const fs: jest.Mocked<typeof _fs> = _fs as any;
const exec: jest.Mock<typeof _exec> = _exec as any;
const platform = mocked(_platform);

const config = {
  localDir: '/tmp/github/some/repo',
  cacheDir: '/tmp/renovate/cache',
};

const processEnv = process.env;

describe('.updateArtifacts()', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    process.env = {
      HTTP_PROXY: 'http://example.com',
      HTTPS_PROXY: 'https://example.com',
      NO_PROXY: 'localhost',
      HOME: '/home/user',
      PATH: '/tmp/path',
    };
  });
  afterEach(() => {
    process.env = processEnv;
  });

  it('returns if no Pipfile.lock found', async () => {
    expect(await pipenv.updateArtifacts('Pipfile', [], '', config)).toBeNull();
  });
  it('returns null if unchanged', async () => {
    platform.getFile.mockResolvedValueOnce('Current Pipfile.lock');
    const execCommands = [];
    const execOptions = [];
    exec.mockImplementation((cmd, options, callback) => {
      execCommands.push(cmd.replace(/\\(\w)/g, '/$1'));
      execOptions.push(options);
      callback(null, { stdout: '', stderr: '' });
      return undefined;
    });
    fs.readFile.mockReturnValueOnce('Current Pipfile.lock' as any);
    expect(
      await pipenv.updateArtifacts('Pipfile', [], '{}', config)
    ).toBeNull();
    expect(execCommands).toMatchSnapshot();
    expect(execOptions).toMatchSnapshot();
  });
  it('returns updated Pipfile.lock', async () => {
    platform.getFile.mockResolvedValueOnce('Current Pipfile.lock');
    const execCommands = [];
    const execOptions = [];
    exec.mockImplementation((cmd, options, callback) => {
      execCommands.push(cmd.replace(/\\(\w)/g, '/$1'));
      execOptions.push(options);
      callback(null, { stdout: '', stderr: '' });
      return undefined;
    });
    platform.getRepoStatus.mockResolvedValue({
      modified: ['Pipfile.lock'],
    } as StatusResult);
    fs.readFile.mockReturnValueOnce('New Pipfile.lock' as any);
    expect(
      await pipenv.updateArtifacts('Pipfile', [], '{}', config)
    ).not.toBeNull();
    expect(execCommands).toMatchSnapshot();
    expect(execOptions).toMatchSnapshot();
  });
  it('supports docker mode', async () => {
    platform.getFile.mockResolvedValueOnce('Current Pipfile.lock');
    const execCommands = [];
    const execOptions = [];
    exec.mockImplementation((cmd, options, callback) => {
      execCommands.push(cmd.replace(/\\(\w)/g, '/$1'));
      execOptions.push(options);
      callback(null, { stdout: '', stderr: '' });
      return undefined;
    });
    platform.getRepoStatus.mockResolvedValue({
      modified: ['Pipfile.lock'],
    } as StatusResult);
    fs.readFile.mockReturnValueOnce('New Pipfile.lock' as any);
    expect(
      await pipenv.updateArtifacts('Pipfile', [], '{}', {
        ...config,
        binarySource: 'docker',
        dockerUser: 'foobar',
      })
    ).not.toBeNull();
    expect(execCommands).toMatchSnapshot();
    expect(execOptions).toMatchSnapshot();
  });
  it('catches errors', async () => {
    platform.getFile.mockResolvedValueOnce('Current Pipfile.lock');
    fs.outputFile.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    expect(
      await pipenv.updateArtifacts('Pipfile', [], '{}', config)
    ).toMatchSnapshot();
  });
});
