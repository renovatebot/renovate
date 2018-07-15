
const { basename } = require('path');

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

  function initRepo() {
    api.get.mockReturnValueOnce({
      body: {
        is_private: false,
        full_name: "some/repo",
        owner: { username: 'some' },
        mainbranch: { name: 'master' },
      }
    });
    api.get.mockReturnValueOnce({
      body: { values: [] }
    });
    api.get.mockReturnValueOnce({
      body: { values: [] }
    });
    return bitbucket.initRepo({
      repository: 'some/repo'
    });
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
      const branches = {
        branch: { target: { parents: [{ hash: 'hash' }] } },
        master: { target: { hash: 'hash' } },
      };
      api.get.mockImplementation(path => ({ body: branches[basename(path)] }));
      expect(await bitbucket.isBranchStale('branch')).toBe(false);
    });
  });

  describe('getBranchPr()', () => {
    it('exists', () => {
      expect(bitbucket.getBranchPr).toBeDefined();
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
