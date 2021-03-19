import { exec as _exec } from 'child_process';
import { join } from 'upath';

import { envMock, mockExecAll } from '../../../../test/exec-util';
import { fs, mocked } from '../../../../test/util';
import { setExecConfig } from '../../../util/exec';
import { BinarySource } from '../../../util/exec/common';
import * as _env from '../../../util/exec/env';
import * as npmHelper from './npm';

jest.mock('child_process');
jest.mock('../../../util/exec/env');
jest.mock('../../../util/fs');
jest.mock('./node-version');

const exec: jest.Mock<typeof _exec> = _exec as any;
const env = mocked(_env);

const config = {
  localDir: join('some-dir'),
  cacheDir: join('/tmp/cache'),
};

describe('generateLockFile', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    jest.resetModules();
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    await setExecConfig(config);
  });
  it('generates lock files', async () => {
    const execSnapshots = mockExecAll(exec);
    fs.readLocalFile = jest.fn(() => 'package-lock-contents') as never;
    const skipInstalls = true;
    const dockerMapDotfiles = true;
    const postUpdateOptions = ['npmDedupe'];
    const updates = [
      { depName: 'some-dep', newVersion: '1.0.1', isLockfileUpdate: false },
    ];
    const res = await npmHelper.generateLockFile(
      {},
      'package-lock.json',
      { dockerMapDotfiles, skipInstalls, postUpdateOptions },
      updates
    );
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.error).toBeUndefined();
    expect(res.lockFile).toEqual('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });
  it('performs lock file updates', async () => {
    const execSnapshots = mockExecAll(exec);
    fs.readLocalFile = jest.fn(() => 'package-lock-contents') as never;
    const skipInstalls = true;
    const updates = [
      { depName: 'some-dep', newVersion: '1.0.1', isLockfileUpdate: true },
    ];
    const res = await npmHelper.generateLockFile(
      {},
      'package-lock.json',
      { skipInstalls },
      updates
    );
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.error).toBeUndefined();
    expect(res.lockFile).toEqual('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });
  it('performs npm-shrinkwrap.json updates', async () => {
    const execSnapshots = mockExecAll(exec);
    fs.getSiblingFileName = jest.fn((original, sibling) => sibling);
    fs.localPathExists.mockResolvedValueOnce(true);
    fs.renameLocalFile = jest.fn();
    fs.readLocalFile = jest.fn(() => 'package-lock-contents') as never;
    const skipInstalls = true;
    const res = await npmHelper.generateLockFile({}, 'npm-shrinkwrap.json', {
      skipInstalls,
    });
    expect(fs.localPathExists).toHaveBeenCalledTimes(1);
    expect(fs.localPathExists).toHaveBeenCalledWith('package-lock.json');
    expect(fs.renameLocalFile).toHaveBeenCalledTimes(1);
    expect(fs.renameLocalFile).toHaveBeenCalledWith(
      'package-lock.json',
      'npm-shrinkwrap.json'
    );
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(fs.readLocalFile).toHaveBeenCalledWith(
      'npm-shrinkwrap.json',
      'utf8'
    );
    expect(res.error).toBeUndefined();
    expect(res.lockFile).toEqual('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });
  it('performs npm-shrinkwrap.json updates (no package-lock.json)', async () => {
    const execSnapshots = mockExecAll(exec);
    fs.getSiblingFileName = jest.fn((original, sibling) => sibling);
    fs.localPathExists.mockResolvedValueOnce(false);
    fs.renameLocalFile = jest.fn();
    fs.readLocalFile = jest.fn((_, _1) => 'package-lock-contents') as never;
    const skipInstalls = true;
    const res = await npmHelper.generateLockFile({}, 'npm-shrinkwrap.json', {
      skipInstalls,
    });
    expect(fs.localPathExists).toHaveBeenCalledWith('package-lock.json');
    expect(fs.renameLocalFile).toHaveBeenCalledTimes(0);
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(fs.readLocalFile).toHaveBeenCalledWith(
      'npm-shrinkwrap.json',
      'utf8'
    );
    expect(res.error).toBeUndefined();
    expect(res.lockFile).toEqual('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });
  it('performs full install', async () => {
    const execSnapshots = mockExecAll(exec);
    fs.readLocalFile = jest.fn(() => 'package-lock-contents') as never;
    const skipInstalls = false;
    const binarySource = BinarySource.Global;
    const res = await npmHelper.generateLockFile({}, 'package-lock.json', {
      skipInstalls,
      binarySource,
    });
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.error).toBeUndefined();
    expect(res.lockFile).toEqual('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });
  it('runs twice if remediating', async () => {
    const execSnapshots = mockExecAll(exec);
    fs.readLocalFile = jest.fn(() => 'package-lock-contents') as never;
    const binarySource = BinarySource.Global;
    const res = await npmHelper.generateLockFile(
      {},
      'package-lock.json',
      { binarySource },
      [{ isRemediation: true }]
    );
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.error).toBeUndefined();
    expect(res.lockFile).toEqual('package-lock-contents');
    expect(execSnapshots).toHaveLength(2);
  });
  it('catches errors', async () => {
    const execSnapshots = mockExecAll(exec);
    fs.readLocalFile = jest.fn(() => {
      throw new Error('not found');
    }) as never;
    const res = await npmHelper.generateLockFile({}, 'package-lock.json');
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.error).toBe(true);
    expect(res.lockFile).not.toBeDefined();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('finds npm globally', async () => {
    const execSnapshots = mockExecAll(exec);
    fs.readLocalFile = jest.fn(() => 'package-lock-contents') as never;
    const res = await npmHelper.generateLockFile({}, 'package-lock.json');
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toEqual('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });
  it('uses docker npm', async () => {
    const execSnapshots = mockExecAll(exec);
    fs.readLocalFile = jest.fn(() => 'package-lock-contents') as never;
    const res = await npmHelper.generateLockFile({}, 'package-lock.json', {
      binarySource: BinarySource.Docker,
      constraints: { npm: '^6.0.0' },
    });
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toEqual('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });
  it('performs lock file maintenance', async () => {
    const execSnapshots = mockExecAll(exec);
    fs.readLocalFile = jest.fn(() => 'package-lock-contents') as never;
    const res = await npmHelper.generateLockFile({}, 'package-lock.json', {}, [
      { isLockFileMaintenance: true },
    ]);
    expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    expect(fs.deleteLocalFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toEqual('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });
});
