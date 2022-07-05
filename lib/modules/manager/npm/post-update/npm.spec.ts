import upath from 'upath';
import {
  envMock,
  mockSpawnAll,
  promisifiedSpawn,
} from '../../../../../test/exec-util';
import { Fixtures } from '../../../../../test/fixtures';
import { env, fs } from '../../../../../test/util';
import { GlobalConfig } from '../../../../config/global';
import * as npmHelper from './npm';

jest.mock('../../../../util/exec/common');
jest.mock('../../../../util/exec/env');
jest.mock('../../../../util/fs');
jest.mock('./node-version');

describe('modules/manager/npm/post-update/npm', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    GlobalConfig.set({ localDir: '' });
  });

  it('generates lock files', async () => {
    const execSnapshots = mockSpawnAll(promisifiedSpawn);
    fs.readLocalFile.mockResolvedValueOnce('package-lock-contents');
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
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.error).toBeUndefined();
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });

  it('performs lock file updates', async () => {
    const execSnapshots = mockSpawnAll(promisifiedSpawn);
    fs.readLocalFile.mockResolvedValueOnce('package-lock-contents');
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
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.error).toBeUndefined();
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });

  it('performs lock file updates retaining the package.json counterparts', async () => {
    const execSnapshots = mockSpawnAll(promisifiedSpawn);
    fs.readLocalFile.mockResolvedValueOnce(
      Fixtures.get('update-lockfile-massage-1/package-lock.json')
    );
    const skipInstalls = true;
    const updates = [
      {
        depName: 'postcss',
        depType: 'dependencies',
        newVersion: '8.4.8',
        newValue: '^8.0.0',
        isLockfileUpdate: true,
      },
    ];
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json',
      { skipInstalls },
      updates
    );
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.error).toBeUndefined();
    expect(res.lockFile).toMatchSnapshot();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('performs npm-shrinkwrap.json updates', async () => {
    const execSnapshots = mockSpawnAll(promisifiedSpawn);
    fs.localPathExists.mockResolvedValueOnce(true);
    fs.readLocalFile.mockResolvedValueOnce('package-lock-contents');
    const skipInstalls = true;
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'npm-shrinkwrap.json',
      { skipInstalls }
    );
    expect(fs.renameLocalFile).toHaveBeenCalledTimes(1);
    expect(fs.renameLocalFile).toHaveBeenCalledWith(
      upath.join('some-dir', 'package-lock.json'),
      upath.join('some-dir', 'npm-shrinkwrap.json')
    );
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(fs.readLocalFile).toHaveBeenCalledWith(
      'some-dir/npm-shrinkwrap.json',
      'utf8'
    );
    expect(res.error).toBeUndefined();
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });

  it('performs npm-shrinkwrap.json updates (no package-lock.json)', async () => {
    const execSnapshots = mockSpawnAll(promisifiedSpawn);
    fs.findLocalSiblingOrParent.mockResolvedValueOnce(null);
    fs.readLocalFile.mockResolvedValueOnce('package-lock-contents');
    const skipInstalls = true;
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'npm-shrinkwrap.json',
      { skipInstalls }
    );
    expect(fs.renameLocalFile).toHaveBeenCalledTimes(0);
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(fs.readLocalFile).toHaveBeenCalledWith(
      'some-dir/npm-shrinkwrap.json',
      'utf8'
    );
    expect(res.error).toBeUndefined();
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });

  it('performs full install', async () => {
    const execSnapshots = mockSpawnAll(promisifiedSpawn);
    fs.readLocalFile.mockResolvedValueOnce('package-lock-contents');
    const skipInstalls = false;
    const binarySource = 'global';
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json',
      { skipInstalls, binarySource }
    );
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.error).toBeUndefined();
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });

  it('runs twice if remediating', async () => {
    const execSnapshots = mockSpawnAll(promisifiedSpawn);
    fs.readLocalFile.mockResolvedValueOnce('package-lock-contents');
    const binarySource = 'global';
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json',
      { binarySource },
      [{ isRemediation: true }]
    );
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.error).toBeUndefined();
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toHaveLength(2);
  });

  it('catches errors', async () => {
    const execSnapshots = mockSpawnAll(promisifiedSpawn);
    fs.readLocalFile.mockImplementation(() => {
      throw new Error('not found');
    });
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json'
    );
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.error).toBeTrue();
    expect(res.lockFile).toBeUndefined();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('finds npm globally', async () => {
    const execSnapshots = mockSpawnAll(promisifiedSpawn);
    fs.readLocalFile.mockResolvedValue('package-lock-contents');
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json'
    );
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });

  it('uses docker npm', async () => {
    const execSnapshots = mockSpawnAll(promisifiedSpawn);
    fs.readLocalFile.mockResolvedValue('package-lock-contents');
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json',
      { binarySource: 'docker', constraints: { npm: '^6.0.0' } }
    );
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });

  it('performs lock file maintenance', async () => {
    const execSnapshots = mockSpawnAll(promisifiedSpawn);
    fs.readLocalFile.mockResolvedValue('package-lock-contents');
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json',
      {},
      [{ isLockFileMaintenance: true }]
    );
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(fs.deleteLocalFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });
});
