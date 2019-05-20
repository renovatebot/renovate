const {
  autodiscoverRepositories,
} = require('../../../lib/workers/global/autodiscover');
const platform = require('../../../lib/platform');
const hostRules = require('../../../lib/util/host-rules');
const ghApi = require('../../../lib/platform/github');

jest.mock('../../../lib/platform/github');

describe('lib/workers/global/autodiscover', () => {
  let config;
  beforeEach(() => {
    jest.resetAllMocks();
    config = {};
    platform.initPlatform({ platform: 'github', token: 'abc123' });
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
  it('filters autodiscovered github repos', async () => {
    config.autodiscover = true;
    config.autodiscoverFilter = 'project/re*';
    config.platform = 'github';
    hostRules.find = jest.fn(() => ({
      token: 'abc',
    }));
    ghApi.getRepos = jest.fn(() => ['project/repo', 'project/another-repo']);
    const res = await autodiscoverRepositories(config);
    expect(res.repositories).toEqual(['project/repo']);
  });
  it('filters autodiscovered github repos but nothing matches', async () => {
    config.autodiscover = true;
    config.autodiscoverFilter = 'project/re*';
    config.platform = 'github';
    hostRules.find = jest.fn(() => ({
      token: 'abc',
    }));
    ghApi.getRepos = jest.fn(() => [
      'another-project/repo',
      'another-project/another-repo',
    ]);
    const res = await autodiscoverRepositories(config);
    expect(res).toEqual(config);
  });
});
