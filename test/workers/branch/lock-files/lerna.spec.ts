import { exec as _exec } from 'child_process';
import * as _lernaHelper from '../../../../lib/manager/npm/post-update/lerna';
import { platform as _platform } from '../../../../lib/platform';
import { mocked } from '../../../util';

jest.mock('child_process');

const exec: jest.Mock<typeof _exec> = _exec as any;
const lernaHelper = mocked(_lernaHelper);
const platform = mocked(_platform);

let processEnv;

describe('generateLockFiles()', () => {
  beforeEach(() => {
    jest.resetAllMocks();

    processEnv = process.env;
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
  it('returns if no lernaClient', async () => {
    const res = await lernaHelper.generateLockFiles(undefined, 'some-dir', {});
    expect(res.error).toBe(false);
  });
  it('generates package-lock.json files', async () => {
    platform.getFile.mockResolvedValueOnce(
      JSON.stringify({ dependencies: { lerna: '2.0.0' } })
    );
    const execCommands = [];
    const execOptions = [];
    exec.mockImplementation((cmd, options, callback) => {
      execCommands.push(cmd.replace(/\\(\w)/g, '/$1'));
      execOptions.push(options);
      callback(null, { stdout: '', stderr: '' });
      return undefined;
    });
    const skipInstalls = true;
    const res = await lernaHelper.generateLockFiles(
      'npm',
      'some-dir',
      {},
      skipInstalls
    );
    expect(res.error).toBe(false);
    expect(execCommands).toMatchSnapshot();
    expect(execOptions).toMatchSnapshot();
  });
  it('performs full npm install', async () => {
    platform.getFile.mockResolvedValueOnce(
      JSON.stringify({ dependencies: { lerna: '2.0.0' } })
    );
    const execCommands = [];
    const execOptions = [];
    exec.mockImplementation((cmd, options, callback) => {
      execCommands.push(cmd.replace(/\\(\w)/g, '/$1'));
      execOptions.push(options);
      callback(null, { stdout: '', stderr: '' });
      return undefined;
    });
    const skipInstalls = false;
    const binarySource = 'global';
    const res = await lernaHelper.generateLockFiles(
      'npm',
      'some-dir',
      {},
      skipInstalls,
      binarySource
    );
    expect(res.error).toBe(false);
    expect(execCommands).toMatchSnapshot();
    expect(execOptions).toMatchSnapshot();
  });
  it('generates yarn.lock files', async () => {
    platform.getFile.mockResolvedValueOnce(
      JSON.stringify({ devDependencies: { lerna: '2.0.0' } })
    );
    const execCommands = [];
    const execOptions = [];
    exec.mockImplementationOnce((cmd, options, callback) => {
      execCommands.push(cmd.replace(/\\(\w)/g, '/$1'));
      execOptions.push(options);
      callback(null, { stdout: '', stderr: '' });
      return undefined;
    });
    const res = await lernaHelper.generateLockFiles('yarn', 'some-dir', {});
    expect(res.error).toBe(false);
    expect(execCommands).toMatchSnapshot();
    expect(execOptions).toMatchSnapshot();
  });
  it('defaults to latest', async () => {
    platform.getFile.mockReturnValueOnce(undefined);
    const execCommands = [];
    const execOptions = [];
    exec.mockImplementationOnce((cmd, options, callback) => {
      execCommands.push(cmd.replace(/\\(\w)/g, '/$1'));
      execOptions.push(options);
      callback(null, { stdout: '', stderr: '' });
      return undefined;
    });
    const res = await lernaHelper.generateLockFiles('npm', 'some-dir', {});
    expect(res.error).toBe(false);
    expect(execCommands).toMatchSnapshot();
    expect(execOptions).toMatchSnapshot();
  });
});
