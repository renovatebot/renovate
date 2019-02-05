const URL = require('url');
const responses = require('../../_fixtures/bitbucket/responses');

describe('platform/bitbucket', () => {
  let bitbucket;
  let api;
  let hostRules;
  let GitStorage;
  beforeEach(() => {
    // reset module
    jest.resetModules();
    jest.mock('../../../lib/platform/bitbucket/bb-got-wrapper');
    jest.mock('../../../lib/platform/git/storage');
    hostRules = require('../../../lib/util/host-rules');
    api = require('../../../lib/platform/bitbucket/bb-got-wrapper');
    bitbucket = require('../../../lib/platform/bitbucket');
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
      platform: 'bitbucket',
      token: 'token',
      username: 'username',
      password: 'password',
    });
  });

  afterEach(() => {
    bitbucket.cleanRepo();
  });

  async function mockedGet(path) {
    let body = responses[URL.parse(path).pathname] || { values: [] };
    if (typeof body === 'function') {
      body = await body();
    }
    return { body };
  }

  async function mocked(fn) {
    const oldGet = api.get;
    try {
      api.get = jest.fn().mockImplementation(mockedGet);
      return await fn();
    } finally {
      api.get = oldGet;
    }
  }

  function wrap(prop) {
    return (...args) => mocked(() => bitbucket[prop](...args));
  }

  function initRepo() {
    return mocked(() =>
      bitbucket.initRepo({
        repository: 'some/repo',
      })
    );
  }

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

  describe('initRepo()', () => {
    it('works', async () => {
      expect(await initRepo()).toMatchSnapshot();
    });
  });

  describe('getRepoForceRebase()', () => {
    it('always return false, since bitbucket does not support force rebase', () => {
      const actual = bitbucket.getRepoForceRebase();
      const expected = false;
      expect(actual).toBe(expected);
    });
  });

  describe('setBaseBranch()', () => {
    it('updates file list', async () => {
      await initRepo();
      await mocked(async () => {
        await bitbucket.setBaseBranch('branch');
        expect(api.get.mock.calls).toMatchSnapshot();
      });
    });
  });

  describe('getFileList()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await mocked(async () => {
        await bitbucket.getFileList();
      });
    });
  });

  describe('branchExists()', () => {
    describe('getFileList()', () => {
      it('sends to gitFs', async () => {
        await initRepo();
        await mocked(async () => {
          await bitbucket.branchExists();
        });
      });
    });
  });

  describe('isBranchStale()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await mocked(async () => {
        await bitbucket.isBranchStale();
      });
    });
  });

  describe('getBranchPr()', () => {
    const getBranchPr = wrap('getBranchPr');
    it('bitbucket finds PR for branch', async () => {
      await initRepo(responses);
      expect(await getBranchPr('branch')).toMatchSnapshot();
    });
    it('returns null if no PR for branch', async () => {
      await initRepo();
      expect(await getBranchPr('branch_without_pr')).toBe(null);
    });
  });

  describe('getBranchStatus()', () => {
    const getBranchStatus = wrap('getBranchStatus');
    it('works', async () => {
      await initRepo();
      expect(await getBranchStatus('master', null)).toBe('success');
      expect(await getBranchStatus('master', ['foo'])).toBe('failed');
      expect(await getBranchStatus('master', true)).toBe('failed');
      expect(await getBranchStatus('branch', true)).toBe('success');
    });
  });

  describe('getBranchStatusCheck()', () => {
    const getBranchStatusCheck = wrap('getBranchStatusCheck');
    it('works', async () => {
      await initRepo();
      expect(await getBranchStatusCheck('master', null)).toBe(null);
      expect(await getBranchStatusCheck('master', 'foo')).toBe('failed');
      expect(await getBranchStatusCheck('master', 'bar')).toBe(null);
    });
  });

  describe('setBranchStatus()', () => {
    it('posts status', async () => {
      await initRepo();
      await mocked(async () => {
        await bitbucket.setBranchStatus(
          'branch',
          'context',
          'description',
          'failed',
          'targetUrl'
        );
        expect(api.post.mock.calls).toMatchSnapshot();
      });
    });
  });

  describe('getRepoStatus()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await mocked(async () => {
        await bitbucket.getRepoStatus();
      });
    });
  });

  describe('deleteBranch()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await mocked(async () => {
        await bitbucket.deleteBranch();
      });
    });
  });

  describe('mergeBranch()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await mocked(async () => {
        await bitbucket.mergeBranch();
      });
    });
  });

  describe('getBranchLastCommitTime()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await mocked(async () => {
        await bitbucket.getBranchLastCommitTime();
      });
    });
  });

  describe('findIssue()', () => {
    it('does not throw', async () => {
      await initRepo();
      await mocked(async () => {
        expect(await bitbucket.findIssue('title')).toMatchSnapshot();
        expect(api.get.mock.calls).toMatchSnapshot();
      });
    });
    it('returns null if no issues', async () => {
      await mocked(async () => {
        await bitbucket.initRepo({
          repository: 'some/empty',
        });
        expect(await bitbucket.findIssue('title')).toBeNull();
      });
    });
  });
  describe('ensureIssue()', () => {
    it('updates existing issues', async () => {
      await initRepo();
      await mocked(async () => {
        await bitbucket.ensureIssue('title', 'body');
        expect(api.get.mock.calls).toMatchSnapshot();
        expect(api.post.mock.calls).toMatchSnapshot();
      });
    });
    it('creates new issue', async () => {
      await mocked(async () => {
        await bitbucket.initRepo({
          repository: 'some/empty',
        });
        await bitbucket.ensureIssue('title', 'body');
        expect(api.get.mock.calls).toMatchSnapshot();
        expect(api.post.mock.calls).toMatchSnapshot();
      });
    });
    it('noop for existing issue', async () => {
      await initRepo();
      await mocked(async () => {
        await bitbucket.ensureIssue('title', 'content\n');
        expect(api.get.mock.calls).toMatchSnapshot();
        expect(api.post.mock.calls).toHaveLength(0);
      });
    });
  });

  describe('ensureIssueClosing()', () => {
    it('does not throw', async () => {
      await initRepo();
      await mocked(async () => {
        await bitbucket.ensureIssueClosing('title');
        expect(api.get.mock.calls).toMatchSnapshot();
        expect(api.delete.mock.calls).toMatchSnapshot();
      });
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
    });
  });

  describe('findPr()', () => {
    it('exists', () => {
      expect(bitbucket.findPr).toBeDefined();
    });
  });

  describe('createPr()', () => {
    it('posts PR', async () => {
      await initRepo();
      api.post.mockReturnValueOnce({
        body: { id: 5 },
      });
      const { id } = await bitbucket.createPr('branch', 'title', 'body');
      expect(id).toBe(5);
      expect(api.post.mock.calls).toMatchSnapshot();
    });
  });

  describe('getPr()', () => {
    const getPr = wrap('getPr');
    it('exists', async () => {
      await initRepo();
      expect(await getPr(5)).toMatchSnapshot();
    });
  });

  describe('getPrFiles()', () => {
    const getPrFiles = wrap('getPrFiles');
    it('returns diff files', async () => {
      await initRepo();
      expect(await getPrFiles(5)).toMatchSnapshot();
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

  describe('updatePr()', () => {
    it('puts PR', async () => {
      await initRepo();
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

  describe('commitFilesToBranch()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await mocked(async () => {
        await bitbucket.commitFilesToBranch();
      });
    });
  });

  describe('getFile()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await mocked(async () => {
        await bitbucket.getFile();
      });
    });
  });

  describe('getCommitMessages()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await mocked(async () => {
        await bitbucket.getCommitMessages();
      });
    });
  });

  describe('getAllRenovateBranches()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await mocked(async () => {
        await bitbucket.getAllRenovateBranches();
      });
    });
  });

  describe('getBranchLastCommitTime()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await mocked(async () => {
        await bitbucket.getBranchLastCommitTime();
      });
    });
  });

  describe('getVulnerabilityAlerts()', () => {
    it('returns empty array', async () => {
      expect(await bitbucket.getVulnerabilityAlerts()).toEqual([]);
    });
  });
});
