import { exec as _exec } from 'child_process';
import { envMock, mockExecAll } from '../../../../test/exec-util';
import { mocked } from '../../../../test/util';
import * as _env from '../../../util/exec/env';
import * as _fs from '../../../util/fs/proxies';
import type { PostUpdateConfig } from '../../types';
import * as _pnpmHelper from './pnpm';
import * as fsutil from '../../../util/fs';

jest.mock('child_process');
jest.mock('../../../util/exec/env');
jest.mock('../../../util/fs/proxies');
jest.mock('./node-version');
jest.mock('../../../util/fs', () => {
  const originalModule = jest.requireActual('../../../util/fs');

  return {
    __esModule: true,
    ...originalModule,
    readLocalFile: jest.fn(),
    remove: jest.fn(),
  };
});

const exec: jest.Mock<typeof _exec> = _exec as any;
const env = mocked(_env);
const fs = mocked(_fs);
const pnpmHelper = mocked(_pnpmHelper);
const readLocalFile = mocked(fsutil.readLocalFile);
const remove = mocked(fsutil.remove);
delete process.env.NPM_CONFIG_CACHE;

describe('manager/npm/post-update/pnpm', () => {
  let config: PostUpdateConfig;
  beforeEach(() => {
    jest.resetAllMocks();
    config = { cacheDir: 'some-cache-dir', constraints: { pnpm: '^2.0.0' } };
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
  });

  it('generates lock files', async () => {
    const execSnapshots = mockExecAll(exec);
    readLocalFile.mockImplementation(() => 'package-lock-contents');
    const res = await pnpmHelper.generateLockFile('some-dir', {}, config);
    expect(readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });

  it('catches errors', async () => {
    const execSnapshots = mockExecAll(exec);
    readLocalFile.mockImplementation(() => {
      throw new Error('not found');
    });
    const res = await pnpmHelper.generateLockFile('some-dir', {}, config);
    expect(readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.error).toBeTrue();
    expect(res.lockFile).toBeUndefined();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('finds pnpm globally', async () => {
    const execSnapshots = mockExecAll(exec);
    readLocalFile.mockImplementation(() => 'package-lock-contents');
    const res = await pnpmHelper.generateLockFile('some-dir', {}, config);
    expect(readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });

  it('performs lock file maintenance', async () => {
    const execSnapshots = mockExecAll(exec);
    readLocalFile.mockImplementation(() => 'package-lock-contents');
    const res = await pnpmHelper.generateLockFile('some-dir', {}, config, [
      { isLockFileMaintenance: true },
    ]);
    expect(readLocalFile).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });

  it('uses the new version if packageManager is updated', async () => {
    const execSnapshots = mockExecAll(exec);
    readLocalFile.mockImplementation(() => 'package-lock-contents');
    const res = await pnpmHelper.generateLockFile('some-dir', {}, config, [
      {
        depType: 'packageManager',
        depName: 'pnpm',
        newValue: '6.16.1',
      },
    ]);
    expect(readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
    // TODO: check docker preCommands
  });
});
