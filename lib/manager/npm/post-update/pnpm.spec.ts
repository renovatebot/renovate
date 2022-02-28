import { envMock, exec, mockExecAll } from '../../../../test/exec-util';
import { env, fs, mocked } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { PostUpdateConfig } from '../../types';
import * as _pnpmHelper from './pnpm';

jest.mock('child_process');
jest.mock('../../../util/exec/env');
jest.mock('../../../util/fs');
jest.mock('./node-version');

const pnpmHelper = mocked(_pnpmHelper);
delete process.env.NPM_CONFIG_CACHE;

describe('manager/npm/post-update/pnpm', () => {
  let config: PostUpdateConfig;
  beforeEach(() => {
    jest.clearAllMocks();
    config = { cacheDir: 'some-cache-dir', constraints: { pnpm: '^2.0.0' } };
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    GlobalConfig.set({ localDir: '' });
  });

  it('generates lock files', async () => {
    const execSnapshots = mockExecAll(exec);
    fs.readLocalFile.mockResolvedValueOnce('package-lock-contents');
    const res = await pnpmHelper.generateLockFile('some-dir', {}, config);
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });

  it('catches errors', async () => {
    const execSnapshots = mockExecAll(exec);
    fs.readLocalFile.mockRejectedValue(new Error('not found'));
    const res = await pnpmHelper.generateLockFile('some-dir', {}, config);
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.error).toBeTrue();
    expect(res.lockFile).toBeUndefined();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('finds pnpm globally', async () => {
    const execSnapshots = mockExecAll(exec);
    fs.readLocalFile.mockResolvedValueOnce('package-lock-contents');
    const res = await pnpmHelper.generateLockFile('some-dir', {}, config);
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });

  it('performs lock file maintenance', async () => {
    const execSnapshots = mockExecAll(exec);
    fs.readLocalFile.mockResolvedValueOnce('package-lock-contents');
    const res = await pnpmHelper.generateLockFile('some-dir', {}, config, [
      { isLockFileMaintenance: true },
    ]);
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(fs.deleteLocalFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });

  it('uses the new version if packageManager is updated', async () => {
    const execSnapshots = mockExecAll(exec);
    fs.readLocalFile.mockResolvedValueOnce('package-lock-contents');
    const res = await pnpmHelper.generateLockFile('some-dir', {}, config, [
      {
        depType: 'packageManager',
        depName: 'pnpm',
        newValue: '6.16.1',
      },
    ]);
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
    // TODO: check docker preCommands
  });
});
