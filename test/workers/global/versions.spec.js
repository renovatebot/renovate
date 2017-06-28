const versions = require('../../../lib/workers/global/versions');
const logger = require('../../_fixtures/logger');
const root = require('root-require');
const cp = require('child_process');
const tmp = require('tmp');

jest.mock('tmp');
jest.mock('root-require');
jest.mock('child_process');

describe('lib/workers/global/versions', () => {
  let config;
  beforeEach(() => {
    tmp.dirSync.mockReturnValueOnce({ name: 'foo' });
    config = {
      logger,
    };
  });
  it('returns versions', () => {
    root.mockReturnValueOnce({ version: '1.0.0' });
    cp.spawnSync.mockReturnValueOnce({ stdout: '5.0.4\n' });
    cp.spawnSync.mockReturnValueOnce({ stdout: '' });
    const res = versions.detectVersions(config);
    expect(config.logger.error.mock.calls.length).toBe(0);
    expect(res).toMatchSnapshot();
  });
  it('catches errors', () => {
    const res = versions.detectVersions(config);
    expect(config.logger.error.mock.calls.length).toBe(1);
    expect(res).toMatchSnapshot();
  });
});
