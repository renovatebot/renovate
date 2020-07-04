import { exec as _exec } from 'child_process';
import { envMock, mockExecAll } from '../../../../test/execUtil';
import { git, mocked } from '../../../../test/util';
import * as _env from '../../../util/exec/env';
import * as _lernaHelper from './lerna';

jest.mock('child_process');
jest.mock('../../../util/exec/env');
jest.mock('../../../util/git');
jest.mock('../../../manager/npm/post-update/node-version');

const exec: jest.Mock<typeof _exec> = _exec as any;
const env = mocked(_env);
const lernaHelper = mocked(_lernaHelper);

describe('generateLockFiles()', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
  });
  it('returns if no lernaClient', async () => {
    const res = await lernaHelper.generateLockFiles(
      undefined,
      'some-dir',
      {},
      {}
    );
    expect(res.error).toBe(false);
  });
  it('returns if invalid lernaClient', async () => {
    const res = await lernaHelper.generateLockFiles('foo', 'some-dir', {}, {});
    expect(res.error).toBe(false);
  });
  it('generates package-lock.json files', async () => {
    git.getFile.mockResolvedValueOnce(
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
    git.getFile.mockResolvedValueOnce(
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
    git.getFile.mockResolvedValueOnce(
      JSON.stringify({ devDependencies: { lerna: '2.0.0' } })
    );
    const execSnapshots = mockExecAll(exec);
    const res = await lernaHelper.generateLockFiles(
      'yarn',
      'some-dir',
      { compatibility: { yarn: '^1.10.0' } },
      {}
    );
    expect(execSnapshots).toMatchSnapshot();
    expect(res.error).toBe(false);
  });
  it('defaults to latest', async () => {
    git.getFile.mockReturnValueOnce(undefined);
    const execSnapshots = mockExecAll(exec);
    const res = await lernaHelper.generateLockFiles('npm', 'some-dir', {}, {});
    expect(res.error).toBe(false);
    expect(execSnapshots).toMatchSnapshot();
  });
  it('maps dot files', async () => {
    git.getFile.mockReturnValueOnce(undefined);
    const execSnapshots = mockExecAll(exec);
    const res = await lernaHelper.generateLockFiles(
      'npm',
      'some-dir',
      {
        dockerMapDotfiles: true,
        compatibility: { npm: '^6.0.0' },
      },
      {}
    );
    expect(res.error).toBe(false);
    expect(execSnapshots).toMatchSnapshot();
  });
  it('allows scripts for trust level high', async () => {
    git.getFile.mockReturnValueOnce(undefined);
    const execSnapshots = mockExecAll(exec);
    global.trustLevel = 'high';
    const res = await lernaHelper.generateLockFiles('npm', 'some-dir', {}, {});
    delete global.trustLevel;
    expect(res.error).toBe(false);
    expect(execSnapshots).toMatchSnapshot();
  });
});
