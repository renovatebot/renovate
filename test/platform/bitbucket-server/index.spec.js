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

  function initRepo() {
    api.get.mockReturnValueOnce({
      body: responses['/rest/api/1.0/projects/some/repos/repo'],
    });
    api.get.mockReturnValueOnce({
      body:
        responses['/rest/api/1.0/projects/some/repos/repo/branches/default'],
    });
    return bitbucket.initRepo({ repository: 'some/repo' });
  }

  describe('getRepos()', () => {
    it('returns repos', async () => {
      api.get
        .mockReturnValueOnce({
          body: responses['/rest/api/1.0/projects'],
        })
        .mockReturnValueOnce({
          body: responses['/rest/api/1.0/projects/some/repos'],
        });
      expect(await bitbucket.getRepos()).toEqual(['some/repo']);
    });
  });

  describe('initRepo()', () => {
    it('works', async () => {
      const res = await initRepo();
      expect(res).toMatchSnapshot();
    });
  });

  describe('repoForceRebase()', () => {
    it('always return false, since bitbucket does not support force rebase', () => {
      const actual = bitbucket.getRepoForceRebase();
      const expected = false;
      expect(actual).toBe(expected);
    });
  });

  describe('setBaseBranch()', () => {
    it('updates file list', async () => {
      await initRepo();
      await bitbucket.setBaseBranch('branch');
      expect(api.get.mock.calls).toMatchSnapshot();
    });
  });

  describe('getFileList()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await bitbucket.getFileList();
    });
  });

  describe('branchExists()', () => {
    describe('getFileList()', () => {
      it('sends to gitFs', async () => {
        await initRepo();
        await bitbucket.branchExists();
      });
    });
  });

  describe('isBranchStale()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await bitbucket.isBranchStale();
    });
  });

  describe('deleteBranch()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await bitbucket.deleteBranch('branch');
    });
  });

  describe('commitFilesToBranch()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await bitbucket.commitFilesToBranch('some-branch', [{}]);
    });
  });

  describe('getFile()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await bitbucket.getFile();
    });
  });

  describe('getAllRenovateBranches()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await bitbucket.getAllRenovateBranches();
    });
  });

  describe('getBranchLastCommitTime()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await bitbucket.getBranchLastCommitTime();
    });
  });

  describe('addAssignees()', () => {
    it('does not throw', async () => {
      await bitbucket.addAssignees(3, ['some']);
    });
  });

  describe('addReviewers', () => {
    it('does not throw', async () => {
      await bitbucket.addReviewers(5, ['some']);
    });
  });

  describe('deleteLAbel()', () => {
    it('does not throw', async () => {
      await bitbucket.deleteLabel(5, 'renovate');
    });
  });

  describe('ensureComment()', () => {
    it('does not throw', async () => {
      await bitbucket.ensureComment(3, 'topic', 'content');
    });
  });

  describe('ensureCommentRemoval()', () => {
    it('does not throw', async () => {
      await bitbucket.ensureCommentRemoval(3, 'topic');
    });
  });

  describe('getPrList()', () => {
    it('exists', () => {
      expect(bitbucket.getPrList).toBeDefined();
      // TODO
    });
  });

  describe('findPr()', () => {
    it('exists', () => {
      expect(bitbucket.findPr).toBeDefined();
      // TODO
    });
  });

  describe('createPr()', () => {
    it('posts PR', async () => {
      await initRepo();
      api.post.mockReturnValueOnce({
        body: {
          id: 5,
          fromRef: { displayId: 'renovate/some-branch' },
          state: 'OPEN',
        },
      });
      const { id } = await bitbucket.createPr('branch', 'title', 'body');
      expect(id).toBe(5);
      expect(api.post.mock.calls).toMatchSnapshot();
    });
  });

  describe('getPr()', () => {
    // beforeEach(() => initRepo())
    it('returns null for no prNo', async () => {
      expect(await bitbucket.getPr()).toBe(null);
    });
    it('gets a PR', async () => {
      api.get.mockReturnValueOnce({
        body:
          responses['/rest/api/1.0/projects/some/repos/repo/pullrequests/5'],
      });
      api.get.mockReturnValueOnce({
        body: {
          conflicted: false,
        },
      });
      expect(await bitbucket.getPr(5)).toMatchSnapshot();
    });
  });

  describe('getPrFiles()', () => {
    it('returns empty files', async () => {
      expect(await bitbucket.getPrFiles(5)).toHaveLength(0);
    });
  });

  describe('updatePr()', () => {
    it('puts PR', async () => {
      await initRepo();
      api.get.mockReturnValueOnce({ body: { version: 1 } });
      await bitbucket.updatePr(5, 'title', 'body');
      expect(api.put.mock.calls).toMatchSnapshot();
    });
  });

  describe('mergePr()', () => {
    it('posts Merge', async () => {
      await initRepo();
      await bitbucket.mergePr(5, 'branch');
      expect(api.post.mock.calls).toMatchSnapshot();
    });
  });

  describe('getPrBody()', () => {
    it('returns diff files', () => {
      expect(
        bitbucket.getPrBody(
          '<details><summary>foo</summary>bar</details>text<details>'
        )
      ).toMatchSnapshot();
    });
  });

  describe('getCommitMessages()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await bitbucket.getCommitMessages();
    });
  });

  describe('getVulnerabilityAlerts()', () => {
    it('returns empty array', async () => {
      expect(await bitbucket.getVulnerabilityAlerts()).toEqual([]);
    });
  });
});
