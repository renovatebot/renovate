import * as _exec from '../../../../lib/util/exec';
import * as _lernaHelper from '../../../../lib/manager/npm/post-update/lerna';
import { platform as _platform } from '../../../../lib/platform';
import { mocked } from '../../../util';

jest.mock('../../../../lib/util/exec');

const exec = mocked(_exec).exec;
const lernaHelper = mocked(_lernaHelper);
const platform = mocked(_platform);

describe('generateLockFiles()', () => {
  it('returns if no lernaClient', async () => {
    const res = await lernaHelper.generateLockFiles(undefined, 'some-dir', {});
    expect(res.error).toBe(false);
  });
  it('generates package-lock.json files', async () => {
    platform.getFile.mockResolvedValueOnce(
      JSON.stringify({ dependencies: { lerna: '2.0.0' } })
    );
    exec.mockResolvedValueOnce({} as never);
    const skipInstalls = true;
    const res = await lernaHelper.generateLockFiles(
      'npm',
      'some-dir',
      {},
      skipInstalls
    );
    expect(res.error).toBe(false);
  });
  it('performs full npm install', async () => {
    platform.getFile.mockResolvedValueOnce(
      JSON.stringify({ dependencies: { lerna: '2.0.0' } })
    );
    exec.mockResolvedValueOnce({} as never);
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
  });
  it('generates yarn.lock files', async () => {
    platform.getFile.mockResolvedValueOnce(
      JSON.stringify({ devDependencies: { lerna: '2.0.0' } })
    );
    exec.mockResolvedValueOnce({} as never);
    const res = await lernaHelper.generateLockFiles('yarn', 'some-dir', {});
    expect(res.error).toBe(false);
  });
  it('defaults to latest', async () => {
    platform.getFile.mockReturnValueOnce(undefined);
    exec.mockResolvedValueOnce({} as never);
    const res = await lernaHelper.generateLockFiles('npm', 'some-dir', {});
    expect(res.error).toBe(false);
  });
});
