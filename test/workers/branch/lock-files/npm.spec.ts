import { getInstalledPath } from 'get-installed-path';
import path from 'path';
import _fs from 'fs-extra';
import * as _exec from '../../../../lib/util/exec';
import * as npmHelper from '../../../../lib/manager/npm/post-update/npm';
import { mocked } from '../../../util';

jest.mock('fs-extra');
jest.mock('../../../../lib/util/exec');
jest.mock('get-installed-path');

getInstalledPath.mockImplementation(() => null);
const exec = mocked(_exec).exec;
const fs = mocked(_fs);

describe('generateLockFile', () => {
  it('generates lock files', async () => {
    getInstalledPath.mockReturnValueOnce('node_modules/npm');
    exec.mockResolvedValueOnce({
      stdout: '',
      stderr: '',
    });
    exec.mockResolvedValueOnce({
      stdout: '',
      stderr: '',
    });
    fs.readFile = jest.fn(() => 'package-lock-contents') as never;
    const skipInstalls = true;
    const postUpdateOptions = ['npmDedupe'];
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json',
      { skipInstalls, postUpdateOptions }
    );
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(res.error).toBeUndefined();
    expect(res.lockFile).toEqual('package-lock-contents');
  });
  it('performs lock file updates', async () => {
    getInstalledPath.mockReturnValueOnce('node_modules/npm');
    exec.mockResolvedValueOnce({
      stdout: '',
      stderr: '',
    });
    exec.mockResolvedValueOnce({
      stdout: '',
      stderr: '',
    });
    fs.readFile = jest.fn(() => 'package-lock-contents') as never;
    const skipInstalls = true;
    const updates = [
      { depName: 'some-dep', toVersion: '1.0.1', isLockfileUpdate: true },
    ];
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json',
      { skipInstalls },
      updates
    );
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(res.error).toBeUndefined();
    expect(res.lockFile).toEqual('package-lock-contents');
  });
  it('performs npm-shrinkwrap.json updates', async () => {
    getInstalledPath.mockReturnValueOnce('node_modules/npm');
    exec.mockResolvedValueOnce({
      stdout: '',
      stderr: '',
    });
    exec.mockResolvedValueOnce({
      stdout: '',
      stderr: '',
    });
    fs.pathExists.mockImplementationOnce(() => true);
    fs.move = jest.fn();
    fs.readFile = jest.fn(() => 'package-lock-contents') as never;
    const skipInstalls = true;
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'npm-shrinkwrap.json',
      { skipInstalls }
    );
    expect(fs.pathExists).toHaveBeenCalledWith(
      path.join('some-dir', 'package-lock.json')
    );
    expect(fs.move).toHaveBeenCalledTimes(1);
    expect(fs.move).toHaveBeenCalledWith(
      path.join('some-dir', 'package-lock.json'),
      path.join('some-dir', 'npm-shrinkwrap.json')
    );
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(fs.readFile).toHaveBeenCalledWith(
      path.join('some-dir', 'npm-shrinkwrap.json'),
      'utf8'
    );
    expect(res.error).toBeUndefined();
    expect(res.lockFile).toEqual('package-lock-contents');
  });
  it('performs npm-shrinkwrap.json updates (no package-lock.json)', async () => {
    getInstalledPath.mockReturnValueOnce('node_modules/npm');
    exec.mockResolvedValueOnce({
      stdout: '',
      stderr: '',
    });
    exec.mockResolvedValueOnce({
      stdout: '',
      stderr: '',
    });
    fs.pathExists.mockImplementationOnce(() => false);
    fs.move = jest.fn();
    fs.readFile = jest.fn((_, _1) => 'package-lock-contents') as never;
    const skipInstalls = true;
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'npm-shrinkwrap.json',
      { skipInstalls }
    );
    expect(fs.pathExists).toHaveBeenCalledWith(
      path.join('some-dir', 'package-lock.json')
    );
    expect(fs.move).toHaveBeenCalledTimes(0);
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(fs.readFile).toHaveBeenCalledWith(
      path.join('some-dir', 'npm-shrinkwrap.json'),
      'utf8'
    );
    expect(res.error).toBeUndefined();
    expect(res.lockFile).toEqual('package-lock-contents');
  });
  it('performs full install', async () => {
    getInstalledPath.mockReturnValueOnce('node_modules/npm');
    exec.mockResolvedValueOnce({
      stdout: '',
      stderr: '',
    });
    fs.readFile = jest.fn(() => 'package-lock-contents') as never;
    const skipInstalls = false;
    const binarySource = 'global';
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json',
      { skipInstalls, binarySource }
    );
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(res.error).toBeUndefined();
    expect(res.lockFile).toEqual('package-lock-contents');
  });
  it('catches errors', async () => {
    getInstalledPath.mockReturnValueOnce('node_modules/npm');
    exec.mockResolvedValueOnce({
      stdout: '',
      stderr: 'some-error',
    });
    fs.readFile = jest.fn(() => {
      throw new Error('not found');
    }) as never;
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json'
    );
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(res.error).toBe(true);
    expect(res.lockFile).not.toBeDefined();
  });
  it('finds npm embedded in renovate', async () => {
    getInstalledPath.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    getInstalledPath.mockImplementationOnce(() => '/node_modules/renovate');
    getInstalledPath.mockImplementationOnce(
      () => '/node_modules/renovate/node_modules/npm'
    );
    exec.mockResolvedValueOnce({
      stdout: '',
      stderr: '',
    });
    fs.readFile = jest.fn(() => 'package-lock-contents') as never;
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json'
    );
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toEqual('package-lock-contents');
  });
  it('finds npm globally', async () => {
    getInstalledPath.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    getInstalledPath.mockImplementationOnce(() => '/node_modules/renovate');
    getInstalledPath.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    getInstalledPath.mockImplementationOnce(() => '/node_modules/npm');
    exec.mockResolvedValueOnce({
      stdout: '',
      stderr: '',
    });
    fs.readFile = jest.fn(() => 'package-lock-contents') as never;
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json'
    );
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toEqual('package-lock-contents');
  });
  it('uses fallback npm', async () => {
    getInstalledPath.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    getInstalledPath.mockImplementationOnce(() => '/node_modules/renovate');
    getInstalledPath.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    getInstalledPath.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    exec.mockResolvedValueOnce({
      stdout: '',
      stderr: '',
    });
    fs.readFile = jest.fn(() => 'package-lock-contents') as never;
    const res = await npmHelper.generateLockFile(
      'some-dir',
      {},
      'package-lock.json'
    );
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toEqual('package-lock-contents');
  });
});
