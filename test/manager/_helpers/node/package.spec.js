const nodeManager = require('../../../../lib/manager/_helpers/node/package');
const { getRepoTags } = require('../../../../lib/datasource/github');

jest.mock('../../../../lib/datasource/github');

describe('manager/npm/engines', () => {
  let config;
  beforeEach(() => {
    config = {
      depName: 'node',
    };
  });
  it('skips non-pinned versions', async () => {
    config.currentVersion = '8';
    const res = await nodeManager.getPackageUpdates(config);
    expect(res).toEqual([]);
  });
  it('returns empty', async () => {
    config.currentVersion = '8.9.0';
    getRepoTags.mockReturnValueOnce([]);
    const res = await nodeManager.getPackageUpdates(config);
    expect(res).toEqual([]);
  });
  it('filters v', async () => {
    config.currentVersion = '8.9.0';
    getRepoTags.mockReturnValueOnce(['v8.0.0', 'v8.9.1']);
    const res = await nodeManager.getPackageUpdates(config);
    expect(res).toHaveLength(1);
    expect(res[0].newVersion).toEqual('8.9.1');
  });
  it('skips major versions', async () => {
    config.currentVersion = '8.9.0';
    getRepoTags.mockReturnValueOnce(['v9.4.0']);
    const res = await nodeManager.getPackageUpdates(config);
    expect(res).toHaveLength(0);
  });
});
