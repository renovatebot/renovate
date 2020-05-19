import { exec as _exec } from 'child_process';
import _fs from 'fs-extra';
import { envMock, mockExecAll } from '../../../../test/execUtil';
import { mocked } from '../../../../test/util';
import * as _env from '../../../util/exec/env';
import { PostUpdateConfig } from '../../common';
import * as _pnpmHelper from './pnpm';

jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('../../../util/exec/env');

const exec: jest.Mock<typeof _exec> = _exec as any;
const env = mocked(_env);
const fs = mocked(_fs);
const pnpmHelper = mocked(_pnpmHelper);

describe('generateLockFile', () => {
  let config: PostUpdateConfig;
  beforeEach(() => {
    config = { cacheDir: 'some-cache-dir' };
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
  });
  it('generates lock files', async () => {
    config.dockerMapDotfiles = true;
    const execSnapshots = mockExecAll(exec);
    fs.readFile = jest.fn(() => 'package-lock-contents') as never;
    const res = await pnpmHelper.generateLockFile('some-dir', {}, config);
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toEqual('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });
  it('catches errors', async () => {
    const execSnapshots = mockExecAll(exec);
    fs.readFile = jest.fn(() => {
      throw new Error('not found');
    }) as never;
    const res = await pnpmHelper.generateLockFile('some-dir', {}, config);
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(res.error).toBe(true);
    expect(res.lockFile).not.toBeDefined();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('finds pnpm globally', async () => {
    const execSnapshots = mockExecAll(exec);
    fs.readFile = jest.fn(() => 'package-lock-contents') as never;
    const res = await pnpmHelper.generateLockFile('some-dir', {}, config);
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toEqual('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });
});
