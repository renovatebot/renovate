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
      endpoint: responses.baseURL,
    });
  });

  afterEach(() => {
    bitbucket.cleanRepo();
  });

  describe('getRepos()', () => {
    it('returns repos', async () => {
      api.get
        .mockReturnValueOnce({
          body: responses['/rest/api/1.0/projects'],
        })
        .mockReturnValueOnce({
          body: responses['/rest/api/1.0/projects/SOME/repos'],
        });
      expect(await bitbucket.getRepos()).toEqual(['some/repo']);
    });
  });
});
