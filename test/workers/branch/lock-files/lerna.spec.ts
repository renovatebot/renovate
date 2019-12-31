import { exec as _exec } from 'child_process';
import * as _lernaHelper from '../../../../lib/manager/npm/post-update/lerna';
import { platform as _platform } from '../../../../lib/platform';
import { mocked } from '../../../util';

jest.mock('child_process');

const exec: jest.Mock<typeof _exec> = _exec as any;
const lernaHelper = mocked(_lernaHelper);
const platform = mocked(_platform);

describe('generateLockFiles()', () => {
  it('returns if no lernaClient', async () => {
    const res = await lernaHelper.generateLockFiles(undefined, 'some-dir', {});
    expect(res.error).toBe(false);
  });
  it('generates package-lock.json files', async () => {
    platform.getFile.mockResolvedValueOnce(
      JSON.stringify({ dependencies: { lerna: '2.0.0' } })
    );
    let command = null;
    let commandOptions = null;
    exec.mockImplementationOnce((cmd, options, callback) => {
      command = cmd;
      commandOptions = options;
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
    expect(command).toMatchSnapshot();
    expect(commandOptions).toMatchSnapshot();
    expect(res.error).toBe(false);
  });
  it('performs full npm install', async () => {
    platform.getFile.mockResolvedValueOnce(
      JSON.stringify({ dependencies: { lerna: '2.0.0' } })
    );
    let command = null;
    let commandOptions = null;
    exec.mockImplementationOnce((cmd, options, callback) => {
      command = cmd;
      commandOptions = options;
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
    expect(command).toMatchSnapshot();
    expect(commandOptions).toMatchSnapshot();
    expect(res.error).toBe(false);
  });
  it('generates yarn.lock files', async () => {
    platform.getFile.mockResolvedValueOnce(
      JSON.stringify({ devDependencies: { lerna: '2.0.0' } })
    );
    let command = null;
    let commandOptions = null;
    exec.mockImplementationOnce((cmd, options, callback) => {
      command = cmd;
      commandOptions = options;
      callback(null, { stdout: '', stderr: '' });
      return undefined;
    });
    const res = await lernaHelper.generateLockFiles('yarn', 'some-dir', {});
    expect(command).toMatchSnapshot();
    expect(commandOptions).toMatchSnapshot();
    expect(res.error).toBe(false);
  });
  it('defaults to latest', async () => {
    platform.getFile.mockReturnValueOnce(undefined);
    let command = null;
    let commandOptions = null;
    exec.mockImplementationOnce((cmd, options, callback) => {
      command = cmd;
      commandOptions = options;
      callback(null, { stdout: '', stderr: '' });
      return undefined;
    });
    const res = await lernaHelper.generateLockFiles('npm', 'some-dir', {});
    expect(command).toMatchSnapshot();
    expect(commandOptions).toMatchSnapshot();
    expect(res.error).toBe(false);
  });
});
