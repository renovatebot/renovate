const {
  autodiscoverRepositories,
} = require('../../../lib/workers/global/autodiscover');

const hostRules = require('../../../lib/util/host-rules');
const ghApi = require('../../../lib/platform/github');

describe('lib/workers/global/autodiscover', () => {
  let config;
  beforeEach(() => {
    jest.resetAllMocks();
    config = {};
  });
  it('returns if not autodiscovering', async () => {
    expect(await autodiscoverRepositories(config)).toEqual(config);
  });
  it('autodiscovers github but empty', async () => {
    config.autodiscover = true;
    config.platform = 'github';
    hostRules.find = jest.fn(() => ({
      token: 'abc',
    }));
    ghApi.getRepos = jest.fn(() => []);
    const res = await autodiscoverRepositories(config);
    expect(res).toEqual(config);
  });
  it('autodiscovers github repos', async () => {
    config.autodiscover = true;
    config.platform = 'github';
    hostRules.find = jest.fn(() => ({
      token: 'abc',
    }));
    ghApi.getRepos = jest.fn(() => [{}, {}]);
    const res = await autodiscoverRepositories(config);
    expect(res.repositories).toHaveLength(2);
  });
});
