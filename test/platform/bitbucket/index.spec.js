describe('platform/bitbucket', () => {
  let bitbucket;
  let api;
  beforeEach(() => {

    // reset module
    jest.resetModules();
    jest.mock('../../../lib/platform/bitbucket/bb-got');
    api = require('../../../lib/platform/bitbucket/bb-got');
    bitbucket = require('../../../lib/platform/bitbucket');
  });

  describe('getRepos()', () => {
    it('exists', () => {
      expect(bitbucket.getRepos).toBeDefined();
    });
  });

  describe('initRepo()', () => {
    it('exists', () => {
      expect(bitbucket.initRepo).toBeDefined();
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
    it('exists', () => {
      expect(bitbucket.isBranchStale).toBeDefined();
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
    it('exists', () => {
      expect(bitbucket.createPr).toBeDefined();
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
    it('exists', () => {
      expect(bitbucket.updatePr).toBeDefined();
    });
  });

  describe('mergePr()', () => {
    it('exists', () => {
      expect(bitbucket.mergePr).toBeDefined();
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
