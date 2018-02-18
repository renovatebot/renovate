const lernaHelper = require('../../../lib/workers/branch/lerna');

jest.mock('child-process-promise');

const { exec } = require('child-process-promise');

describe('generateLockFiles()', () => {
  it('generates package-lock.json files', async () => {
    platform.getFile.mockReturnValueOnce(
      JSON.stringify({ dependencies: { lerna: '2.0.0' } })
    );
    exec.mockReturnValueOnce({});
    const res = await lernaHelper.generateLockFiles('npm', 'some-dir', {});
    expect(res.error).toBe(false);
  });
  it('generates yarn.lock files', async () => {
    platform.getFile.mockReturnValueOnce(
      JSON.stringify({ devDependencies: { lerna: '2.0.0' } })
    );
    exec.mockReturnValueOnce({});
    const res = await lernaHelper.generateLockFiles('yarn', 'some-dir', {});
    expect(res.error).toBe(false);
  });
  it('defaults to latest', async () => {
    platform.getFile.mockReturnValueOnce(undefined);
    exec.mockReturnValueOnce({});
    const res = await lernaHelper.generateLockFiles('npm', 'some-dir', {});
    expect(res.error).toBe(false);
  });
});
