import { exec as _exec } from 'child_process';
import upath from 'upath';
import * as fsutil from '../../../util/fs';
import { envMock, mockExecAll } from '../../../../test/exec-util';
import { mocked } from '../../../../test/util';
import * as _env from '../../../util/exec/env';
import * as _fs from '../../../util/fs/proxies';
import * as npmHelper from './npm';

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
    move: jest.fn(),
  };
});

const exec: jest.Mock<typeof _exec> = _exec as any;
const env = mocked(_env);
const fs = mocked(_fs);
const readLocalFile = mocked(fsutil.readLocalFile);
const remove = mocked(fsutil.readLocalFile);
const move = mocked(fsutil.move);

describe('manager/npm/post-update/npm', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
  });
  it('generates lock files', async () => {
    const execSnapshots = mockExecAll(exec);
    readLocalFile.mockImplementation(() => 'package-lock-contents');
    const skipInstalls = true;
    const postUpdateOptions = ['npmDedupe'];
    const updates = [
      { depName: 'some-dep', newVersion: '1.0.1', isLockfileUpdate: false },
    ];
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json',
      { skipInstalls, postUpdateOptions },
      updates
    );
    expect(readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.error).toBeUndefined();
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });
  it('performs lock file updates', async () => {
    const execSnapshots = mockExecAll(exec);
    readLocalFile.mockImplementation(() => 'package-lock-contents');
    const skipInstalls = true;
    const updates = [
      { depName: 'some-dep', newVersion: '1.0.1', isLockfileUpdate: true },
    ];
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json',
      { skipInstalls },
      updates
    );
    expect(readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.error).toBeUndefined();
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });
  it('performs npm-shrinkwrap.json updates', async () => {
    const execSnapshots = mockExecAll(exec);
    fs.pathExists.mockResolvedValueOnce(true);
    readLocalFile.mockImplementation(() => 'package-lock-contents');
    const skipInstalls = true;
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'npm-shrinkwrap.json',
      { skipInstalls }
    );
    expect(fs.pathExists).toHaveBeenCalledWith(
      upath.join('some-dir', 'package-lock.json')
    );
    expect(move).toHaveBeenCalledTimes(1);
    expect(move).toHaveBeenCalledWith(
      upath.join('some-dir', 'package-lock.json'),
      upath.join('some-dir', 'npm-shrinkwrap.json')
    );
    expect(readLocalFile).toHaveBeenCalledTimes(1);
    expect(readLocalFile).toHaveBeenCalledWith('npm-shrinkwrap.json', 'utf8');
    expect(res.error).toBeUndefined();
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });
  it('performs npm-shrinkwrap.json updates (no package-lock.json)', async () => {
    const execSnapshots = mockExecAll(exec);
    fs.pathExists.mockResolvedValueOnce(false);
    fs.move = jest.fn();
    readLocalFile.mockImplementation((_, _1) => 'package-lock-contents');
    const skipInstalls = true;
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'npm-shrinkwrap.json',
      { skipInstalls }
    );
    expect(fs.pathExists).toHaveBeenCalledWith(
      upath.join('some-dir', 'package-lock.json')
    );
    expect(move).toHaveBeenCalledTimes(0);
    expect(readLocalFile).toHaveBeenCalledTimes(1);
    expect(readLocalFile).toHaveBeenCalledWith('npm-shrinkwrap.json', 'utf8');
    expect(res.error).toBeUndefined();
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });
  it('performs full install', async () => {
    const execSnapshots = mockExecAll(exec);
    readLocalFile.mockImplementation(() => 'package-lock-contents');
    const skipInstalls = false;
    const binarySource = 'global';
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json',
      { skipInstalls, binarySource }
    );
    expect(readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.error).toBeUndefined();
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });
  it('runs twice if remediating', async () => {
    const execSnapshots = mockExecAll(exec);
    readLocalFile.mockImplementation(() => 'package-lock-contents');
    const binarySource = 'global';
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json',
      { binarySource },
      [{ isRemediation: true }]
    );
    expect(readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.error).toBeUndefined();
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toHaveLength(2);
  });
  it('catches errors', async () => {
    const execSnapshots = mockExecAll(exec);
    readLocalFile.mockImplementation(() => {
      throw new Error('not found');
    });
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json'
    );
    expect(readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.error).toBeTrue();
    expect(res.lockFile).toBeUndefined();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('finds npm globally', async () => {
    const execSnapshots = mockExecAll(exec);
    readLocalFile.mockImplementation(() => 'package-lock-contents');
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json'
    );
    expect(readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });
  it('uses docker npm', async () => {
    const execSnapshots = mockExecAll(exec);
    readLocalFile.mockImplementation(() => 'package-lock-contents');
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json',
      { binarySource: 'docker', constraints: { npm: '^6.0.0' } }
    );
    expect(readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });
  it('performs lock file maintenance', async () => {
    const execSnapshots = mockExecAll(exec);
    readLocalFile.mockImplementation(() => 'package-lock-contents');
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json',
      {},
      [{ isLockFileMaintenance: true }]
    );
    expect(readLocalFile).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });
});
