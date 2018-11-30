// eslint-disable-next-line no-unused-vars
const URL = require('url');
// eslint-disable-next-line no-unused-vars
const responses = require('../../_fixtures/bitbucket-server/responses');

describe('platform/bitbucket', () => {
  let bitbucket;
  let api;
  let hostRules;
  beforeEach(() => {
    // reset module
    jest.resetModules();
    jest.mock('../../../lib/platform/bitbucket-server/bb-got-wrapper');
    hostRules = require('../../../lib/util/host-rules');
    api = require('../../../lib/platform/bitbucket-server/bb-got-wrapper');
    bitbucket = require('../../../lib/platform/bitbucket-server');

    // clean up hostRules
    hostRules.clear();
    hostRules.update({
      platform: 'bitbucket-server',
      token: 'token',
    });
  });

  afterEach(() => {
    bitbucket.cleanRepo();
  });

  describe('getRepos()', () => {
    it('returns repos', async () => {
      api.get.mockReturnValueOnce({
        body: {
          values: [{ full_name: 'foo/bar' }, { full_name: 'some/repo' }],
        },
      });
      expect(await bitbucket.getRepos()).toEqual(['foo/bar', 'some/repo']);
    });
  });
});
