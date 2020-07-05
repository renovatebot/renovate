import { exec as _exec } from 'child_process';
import { envMock, mockExecAll } from '../../../../test/execUtil';
import { mocked } from '../../../../test/util';
import * as _env from '../../../util/exec/env';
import * as _lernaHelper from './lerna';

jest.mock('child_process');
jest.mock('../../../util/exec/env');
jest.mock('../../../manager/npm/post-update/node-version');

const exec: jest.Mock<typeof _exec> = _exec as any;
const env = mocked(_env);
const lernaHelper = mocked(_lernaHelper);

function lernaPkgFieldWithClient(lernaClient: string) {
  return {
    lernaClient,
    deps: [{ depName: 'lerna', currentValue: '2.0.0' }],
  };
}

describe('generateLockFiles()', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
  });
  it('returns if no lernaClient', async () => {
    const res = await lernaHelper.generateLockFiles({}, 'some-dir', {}, {});
    expect(res.error).toBe(false);
  });
  it('returns if invalid lernaClient', async () => {
    const res = await lernaHelper.generateLockFiles(
      lernaPkgFieldWithClient('foo'),
      'some-dir',
      {},
      {}
    );
    expect(res.error).toBe(false);
  });
  it('generates package-lock.json files', async () => {
    const execSnapshots = mockExecAll(exec);
    const skipInstalls = true;
    const res = await lernaHelper.generateLockFiles(
      lernaPkgFieldWithClient('npm'),
      'some-dir',
      {},
      {},
      skipInstalls
    );
    expect(res.error).toBe(false);
    expect(execSnapshots).toMatchSnapshot();
  });
  it('performs full npm install', async () => {
    const execSnapshots = mockExecAll(exec);
    const skipInstalls = false;
    const res = await lernaHelper.generateLockFiles(
      lernaPkgFieldWithClient('npm'),
      'some-dir',
      {},
      {},
      skipInstalls
    );
    expect(res.error).toBe(false);
    expect(execSnapshots).toMatchSnapshot();
  });
  it('generates yarn.lock files', async () => {
    const execSnapshots = mockExecAll(exec);
    const res = await lernaHelper.generateLockFiles(
      lernaPkgFieldWithClient('yarn'),
      'some-dir',
      { compatibility: { yarn: '^1.10.0' } },
      {}
    );
    expect(execSnapshots).toMatchSnapshot();
    expect(res.error).toBe(false);
  });
  it('uses specified lerna version', async () => {
    // TODO: Docker preCommands don't seem to be captured in snapshots, so how could I test this?
  });
  it('defaults to latest if lerna version unspecified', async () => {
    const execSnapshots = mockExecAll(exec);
    const res = await lernaHelper.generateLockFiles(
      lernaPkgFieldWithClient('npm'),
      'some-dir',
      {},
      {}
    );
    expect(res.error).toBe(false);
    expect(execSnapshots).toMatchSnapshot();
  });
  it('maps dot files', async () => {
    const execSnapshots = mockExecAll(exec);
    const res = await lernaHelper.generateLockFiles(
      lernaPkgFieldWithClient('npm'),
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
    const execSnapshots = mockExecAll(exec);
    global.trustLevel = 'high';
    const res = await lernaHelper.generateLockFiles(
      lernaPkgFieldWithClient('npm'),
      'some-dir',
      {},
      {}
    );
    delete global.trustLevel;
    expect(res.error).toBe(false);
    expect(execSnapshots).toMatchSnapshot();
  });
});
