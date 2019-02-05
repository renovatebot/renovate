// eslint-disable-next-line no-unused-vars
const URL = require('url');
// eslint-disable-next-line no-unused-vars
const responses = require('../../_fixtures/bitbucket-server/responses');

describe('platform/bitbucket', () => {
  let bitbucket;
  let api;
  let hostRules;
  let GitStorage;
  beforeEach(() => {
    // reset module
    jest.resetModules();
    jest.mock('../../../lib/platform/bitbucket-server/bb-got-wrapper');
    jest.mock('../../../lib/platform/git/storage');
    hostRules = require('../../../lib/util/host-rules');
    api = require('../../../lib/platform/bitbucket-server/bb-got-wrapper');
    bitbucket = require('../../../lib/platform/bitbucket-server');
    GitStorage = require('../../../lib/platform/git/storage');
    GitStorage.mockImplementation(() => ({
      initRepo: jest.fn(),
      cleanRepo: jest.fn(),
      getFileList: jest.fn(),
      branchExists: jest.fn(() => true),
      isBranchStale: jest.fn(() => false),
      setBaseBranch: jest.fn(),
      getBranchLastCommitTime: jest.fn(),
      getAllRenovateBranches: jest.fn(),
      getCommitMessages: jest.fn(),
      getFile: jest.fn(),
      commitFilesToBranch: jest.fn(),
      mergeBranch: jest.fn(),
      deleteBranch: jest.fn(),
      getRepoStatus: jest.fn(),
    }));

    // clean up hostRules
    hostRules.clear();
    hostRules.update({
      platform: 'bitbucket-server',
      token: 'token',
      username: 'username',
      password: 'password',
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
