const lernaHelper = require('../../../lib/workers/branch/lerna');

jest.mock('child-process-promise');

const { exec } = require('child-process-promise');

describe('generateLockFiles()', () => {
  it('generates package-lock.json files', async () => {
    exec.mockReturnValueOnce({});
    const res = await lernaHelper.generateLockFiles('npm', 'some-dir', {});
    expect(res.error).toBe(false);
  });
  it('generates yarn.lock files', async () => {
    exec.mockReturnValueOnce({});
    const res = await lernaHelper.generateLockFiles('yarn', 'some-dir', {});
    expect(res.error).toBe(false);
  });
});
