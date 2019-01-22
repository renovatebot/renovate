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
    jest.mock('../../../lib/platform/git/storage');
    hostRules = require('../../../lib/util/host-rules');
    api = require('../../../lib/platform/bitbucket-server/bb-got-wrapper');
    bitbucket = require('../../../lib/platform/bitbucket-server');
    let gitStorage = require('../../../lib/platform/git/storage');
    gitStorage.mockImplementation(() => ({
      initRepo: () => {},
      cleanRepo: () => {},
    }));

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
  async function mocked(fn) {
    const oldGet = api.get;
    try {
      api.get = jest.fn().mockImplementation(mockedGet);
      return await fn();
    } finally {
      api.get = oldGet;
    }
  }
  async function mockedGet(path) {
    let body = responses[URL.parse(path).pathname] || { values: [] };
    if (typeof body === 'function') {
      body = await body();
    }
    return { body };
  }

  function initRepo() {
    return mocked(() =>
      bitbucket.initRepo({
        repository: 'some/repo',
        localDir: '',
      })
    );
  }

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

  describe('initRepo()', () => {
    it('works', async () => {
      api.get.mockReturnValueOnce({
        body: responses['/rest/api/1.0/projects/SOME/repos/repo'],
      });

      expect(await initRepo()).toMatchSnapshot();
    });
  });
});
