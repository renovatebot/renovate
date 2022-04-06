import { exec as _exec } from 'child_process';
import { envMock, mockExecAll } from '../../../../../test/exec-util';
import { Fixtures } from '../../../../../test/fixtures';
import { mocked } from '../../../../../test/util';
import * as _env from '../../../../util/exec/env';
import * as _fs from '../../../../util/fs/proxies';
import type { PostUpdateConfig } from '../../types';
import * as _pnpmHelper from './pnpm';

jest.mock('child_process');
jest.mock('../../../../util/exec/env');
jest.mock('../../../../util/fs/proxies');
jest.mock('./node-version');

const exec: jest.Mock<typeof _exec> = _exec as any;
const env = mocked(_env);
const fs = mocked(_fs);
const pnpmHelper = mocked(_pnpmHelper);
delete process.env.NPM_CONFIG_CACHE;

describe('modules/manager/npm/post-update/pnpm', () => {
  let config: PostUpdateConfig;
  beforeEach(() => {
    config = { cacheDir: 'some-cache-dir', constraints: { pnpm: '^2.0.0' } };
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
  });
  it('generates lock files', async () => {
    const execSnapshots = mockExecAll(exec);
    fs.readFile = jest
      .fn()
      .mockReturnValueOnce(undefined)
      .mockReturnValue('package-lock-contents');
    const res = await pnpmHelper.generateLockFile('some-dir', {}, config);
    expect(fs.readFile).toHaveBeenCalledTimes(2);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });
  it('catches errors', async () => {
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockReturnValueOnce(undefined).mockImplementation(() => {
      throw new Error('not found');
    });
    const res = await pnpmHelper.generateLockFile('some-dir', {}, config);
    expect(fs.readFile).toHaveBeenCalledTimes(2);
    expect(res.error).toBeTrue();
    expect(res.lockFile).toBeUndefined();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('finds pnpm globally', async () => {
    const execSnapshots = mockExecAll(exec);
    fs.readFile = jest
      .fn()
      .mockReturnValueOnce(undefined)
      .mockReturnValue('package-lock-contents');
    const res = await pnpmHelper.generateLockFile('some-dir', {}, config);
    expect(fs.readFile).toHaveBeenCalledTimes(2);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });
  it('performs lock file maintenance', async () => {
    const execSnapshots = mockExecAll(exec);
    fs.readFile = jest
      .fn()
      .mockReturnValueOnce(undefined)
      .mockReturnValue('package-lock-contents');
    const res = await pnpmHelper.generateLockFile('some-dir', {}, config, [
      { isLockFileMaintenance: true },
    ]);
    expect(fs.readFile).toHaveBeenCalledTimes(2);
    expect(fs.remove).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });

  it('uses the new version if packageManager is updated', async () => {
    const execSnapshots = mockExecAll(exec);
    // when(fs.readFile).calledWith(1).mockReturnValue('yay!')
    fs.readFile = jest
      .fn()
      .mockReturnValueOnce(undefined)
      .mockReturnValue('package-lock-contents');
    const res = await pnpmHelper.generateLockFile('some-dir', {}, config, [
      {
        depType: 'packageManager',
        depName: 'pnpm',
        newValue: '6.16.1',
      },
    ]);
    expect(fs.readFile).toHaveBeenCalledTimes(2);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
    // TODO: check docker preCommands
  });

  it('uses constraint version if parent json has constraints', async () => {
    const childPkgJson = Fixtures.get('parent/package.json');
    const execSnapshots = mockExecAll(exec);
    const configTemp = { cacheDir: 'some-cache-dir' };
    fs.readFile = jest
      .fn()
      .mockReturnValueOnce(childPkgJson)
      .mockReturnValue('package-lock-contents');
    const res = await pnpmHelper.generateLockFile(
      'some-folder',
      {},
      configTemp,
      [
        {
          depType: 'packageManager',
          depName: 'pnpm',
        },
      ]
    );
    expect(fs.readFile).toHaveBeenCalledTimes(2);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot([
      {
        cmd: 'pnpm install --recursive --lockfile-only --ignore-scripts --ignore-pnpmfile',
        options: {
          cwd: 'some-folder',
          encoding: 'utf-8',
          env: {
            HTTP_PROXY: 'http://example.com',
            HTTPS_PROXY: 'https://example.com',
            NO_PROXY: 'localhost',
            HOME: '/home/user',
            PATH: '/tmp/path',
            LANG: 'en_US.UTF-8',
            LC_ALL: 'en_US',
          },
          maxBuffer: 10485760,
          timeout: 900000,
        },
      },
    ]);
  });
});
