import { exec as _exec } from 'child_process';
import * as _lernaHelper from '../../../../lib/manager/npm/post-update/lerna';
import { platform as _platform } from '../../../../lib/platform';
import { mocked } from '../../../util';
import { envMock, mockExecAll } from '../../../execUtil';
import * as _env from '../../../../lib/util/exec/env';

jest.mock('child_process');
jest.mock('../../../../lib/util/exec/env');

const exec: jest.Mock<typeof _exec> = _exec as any;
const env = mocked(_env);
const lernaHelper = mocked(_lernaHelper);
const platform = mocked(_platform);

describe('generateLockFiles()', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
  });
  it('returns if no lernaClient', async () => {
    const res = await lernaHelper.generateLockFiles(undefined, 'some-dir', {});
    expect(res.error).toBe(false);
  });
  it('generates package-lock.json files', async () => {
    platform.getFile.mockResolvedValueOnce(
      JSON.stringify({ dependencies: { lerna: '2.0.0' } })
    );
    const execSnapshots = mockExecAll(exec);
    const skipInstalls = true;
    const res = await lernaHelper.generateLockFiles(
      'npm',
      'some-dir',
      {},
      skipInstalls
    );
    expect(res.error).toBe(false);
    expect(execSnapshots).toMatchSnapshot();
  });
  it('performs full npm install', async () => {
    platform.getFile.mockResolvedValueOnce(
      JSON.stringify({ dependencies: { lerna: '2.0.0' } })
    );
    const execSnapshots = mockExecAll(exec);
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
    expect(execSnapshots).toMatchSnapshot();
  });
  it('generates yarn.lock files', async () => {
    platform.getFile.mockResolvedValueOnce(
      JSON.stringify({ devDependencies: { lerna: '2.0.0' } })
    );
    const execSnapshots = mockExecAll(exec);
    const res = await lernaHelper.generateLockFiles('yarn', 'some-dir', {});
    expect(res.error).toBe(false);
    expect(execSnapshots).toMatchSnapshot();
  });
  it('defaults to latest', async () => {
    platform.getFile.mockReturnValueOnce(undefined);
    const execSnapshots = mockExecAll(exec);
    const res = await lernaHelper.generateLockFiles('npm', 'some-dir', {});
    expect(res.error).toBe(false);
    expect(execSnapshots).toMatchSnapshot();
  });
});
