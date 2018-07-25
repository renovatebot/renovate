
const { basename } = require('path');
const URL = require('url');

describe('platform/bitbucket', () => {
  let bitbucket;
  let api;
  let endpoints;
  beforeEach(() => {
    // reset module
    jest.resetModules();
    jest.mock('../../../lib/platform/bitbucket/bb-got-wrapper');
    endpoints = require('../../../lib/util/endpoints');
    api = require('../../../lib/platform/bitbucket/bb-got-wrapper');
    bitbucket = require('../../../lib/platform/bitbucket');

    // clean up endpoints
    endpoints.clear();
    endpoints.update({
      platform: 'bitbucket',
      token: 'token',
    });
  });

  const pr = {
    id: 5,
    source: { branch: { name: 'branch' } },
    title: 'title',
    summary: { raw: 'summary' },
    state: 'OPEN',
    created_on: '2018-07-02T07:02:25.275030+00:00',
    links: {
      commits: {
        href: "https://api.bitbucket.org/2.0/repositories/some/repo/pullrequests/5/commits"
      },
    },
  };
  const responses = {
    "/2.0/repositories/some/repo": {
      is_private: false,
      full_name: "some/repo",
      owner: { username: 'some' },
      mainbranch: { name: 'master' },
    },
    '/2.0/repositories/some/repo/pullrequests': {
      values: [pr]
    },
    '/2.0/repositories/some/repo/pullrequests/5': pr,
    '/2.0/repositories/some/repo/pullrequests/5/diff': `
      diff --git a/requirements.txt b/requirements.txt
      index 7e08d70..f5283ca 100644
      --- a/requirements.txt
      +++ b/requirements.txt
      @@ -7,7 +7,7 @@ docutils==0.12
      enum34==1.1.6
      futures==3.2.0
      isort==4.3.4
      -jedi==0.11.1
      +jedi==0.12.1
      lazy-object-proxy==1.3.1
      lxml==3.6.0
      mccabe==0.6.1
    `.trim().replace(/^\s+/g, ''),
    '/2.0/repositories/some/repo/pullrequests/5/commits': {
      values: [{}]
    },
    '/2.0/repositories/some/repo/refs/branches/master': {
      target: { hash: 'hash' }
    },
    '/2.0/repositories/some/repo/refs/branches/branch': {
      target: { parents: [{ hash: 'hash' }] }
    },
  }

  function mockedGet(path) {
    const body = responses[URL.parse(path).pathname] || { values: [] };
    return { body };
  }

  async function withMockedGet(fn) {
    const oldGet = api.get;
    try {
      api.get = jest.fn().mockImplementation(mockedGet);
      return await fn();
    } finally {
      api.get = oldGet;
    }
  }

  function initRepo() {
    return withMockedGet(() => bitbucket.initRepo({
      repository: 'some/repo'
    }));
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
    it('exists', () => {
      expect(bitbucket.getRepoForceRebase).toBeDefined();
    });

    it('always return false, since bitbucket does not support force rebase', () => {
      const actual = bitbucket.getRepoForceRebase();
      const expected = false;
      expect(actual).toBe(expected);
    });
  });

  describe('setBaseBranch()', () => {
    it('exists', () => {
      expect(bitbucket.setBaseBranch).toBeDefined();
    });
  });

  describe('getFileList()', () => {
    it('exists', () => {
      expect(bitbucket.getFileList).toBeDefined();
    });
  });

  describe('branchExists()', () => {
    it('exists', () => {
      expect(bitbucket.branchExists).toBeDefined();
    });

    it('returns true if branch exist in repo', async () => {
      api.get.mockImplementationOnce(() => ({ body: { name: 'branch1' } }));
      const actual = await bitbucket.branchExists('branch1');
      const expected = true;
      expect(actual).toBe(expected);
    });

    it('returns false if branch does not exist in repo', async () => {
      api.get.mockImplementationOnce(() => ({ body: { name: 'branch2' } }));
      const actual = await bitbucket.branchExists('branch1');
      const expected = false;
      expect(actual).toBe(expected);
    });

    it('returns false if 404', async () => {
      api.get.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 404,
        })
      );
      const actual = await bitbucket.branchExists('branch1');
      const expected = false;
      expect(actual).toBe(expected);
    });
  });

  describe('isBranchStale()', () => {
    it('returns false for same hash', async () => {
      await initRepo();
      const isStale = await withMockedGet(() => bitbucket.isBranchStale('branch'));
      expect(isStale).toBe(false);
    });
  });

  describe('getBranchPr()', () => {
    it('bitbucket finds PR for branch', async () => {
      await initRepo(responses);
      const branch = await withMockedGet(() => bitbucket.getBranchPr('branch'));
      expect(branch).toMatchSnapshot();
    });
    it('returns null if no PR for branch', async () => {
      await initRepo();
      const branch = await withMockedGet(() => bitbucket.getBranchPr('branch_without_pr'));
      expect(branch).toBe(null);
    });
  });

  describe('getBranchStatus()', () => {
    it('exists', () => {
      expect(bitbucket.getBranchStatus).toBeDefined();
    });
  });

  describe('getBranchStatusCheck()', () => {
    it('exists', () => {
      expect(bitbucket.getBranchStatusCheck).toBeDefined();
    });
  });

  describe('setBranchStatus()', () => {
    it('exists', () => {
      expect(bitbucket.setBranchStatus).toBeDefined();
    });
  });

  describe('deleteBranch()', () => {
    it('exists', () => {
      expect(bitbucket.deleteBranch).toBeDefined();
    });
  });

  describe('mergeBranch()', () => {
    it('exists', () => {
      expect(bitbucket.mergeBranch).toBeDefined();
    });
  });

  describe('getBranchLastCommitTime()', () => {
    it('exists', () => {
      expect(bitbucket.getBranchLastCommitTime).toBeDefined();
    });
  });

  describe('ensureIssue()', () => {
    it('exists', () => {
      expect(bitbucket.ensureIssue).toBeDefined();
    });
  });

  describe('ensureIssueClosing()', () => {
    it('exists', () => {
      expect(bitbucket.ensureIssueClosing).toBeDefined();
    });
  });

  describe('addAssignees()', () => {
    it('exists', () => {
      expect(bitbucket.addAssignees).toBeDefined();
    });
  });

  describe('addReviewers', () => {
    it('exists', () => {
      expect(bitbucket.addReviewers).toBeDefined();
    });
  });

  describe('ensureComment()', () => {
    it('exists', () => {
      expect(bitbucket.ensureComment).toBeDefined();
    });
  });

  describe('ensureCommentRemoval()', () => {
    it('exists', () => {
      expect(bitbucket.ensureCommentRemoval).toBeDefined();
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
        body: { id: 5 }
      });
      const { id } = await bitbucket.createPr('branch', 'title', 'body');
      expect(id).toBe(5);
      expect(api.post.mock.calls).toMatchSnapshot();
    });
  });

  describe('getPr()', () => {
    it('exists', () => {
      expect(bitbucket.getPr).toBeDefined();
    });
  });

  describe('getPrFiles()', () => {
    it('exists', () => {
      expect(bitbucket.getPrFiles).toBeDefined();
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
    it('exists', () => {
      expect(bitbucket.commitFilesToBranch).toBeDefined();
    });
  });

  describe('getFile()', () => {
    it('exists', () => {
      expect(bitbucket.getFile).toBeDefined();
    });
  });

  describe('getCommitMessages()', () => {
    it('exists', () => {
      expect(bitbucket.getCommitMessages).toBeDefined();
    });
  });
});
