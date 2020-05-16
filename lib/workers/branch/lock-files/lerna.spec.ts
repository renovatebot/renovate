import { exec as _exec } from 'child_process';
import { envMock, mockExecAll } from '../../../../test/execUtil';
import { mocked } from '../../../../test/util';
import * as _lernaHelper from '../../../manager/npm/post-update/lerna';
import { platform as _platform } from '../../../platform';
import * as _env from '../../../util/exec/env';

jest.mock('child_process');
jest.mock('../../../util/exec/env');

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
    const res = await lernaHelper.generateLockFiles(
      'npm',
      'some-dir',
      {},
      {},
      skipInstalls
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

  // it('uses docker', async () => {
  //   platform.getFile.mockResolvedValueOnce(
  //     JSON.stringify({ dependencies: { lerna: '2.0.0' } })
  //   );
  //   const execSnapshots = mockExecAll(exec);
  //   const skipInstalls = false;

  //   const res = await lernaHelper.generateLockFiles(
  //     'npm',
  //     'some-dir',
  //     { binarySource: BinarySource.Docker, cacheDir: 'some-cache-dir' },
  //     {},
  //     skipInstalls
  //   );
  //   expect(res.error).toBe(false);
  //   expect(execSnapshots).toMatchSnapshot();
  // });
});
