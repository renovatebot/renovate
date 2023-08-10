import * as platform from './index';

describe('modules/platform/local/index', () => {
  describe('initPlatform', () => {
    it('returns input', async () => {
      expect(await platform.initPlatform({})).toMatchInlineSnapshot(`
        {
          "dryRun": "lookup",
          "endpoint": "local",
          "persistRepoData": true,
          "requireConfig": "optional",
        }
      `);
    });
  });

  describe('getRepos', () => {
    it('returns empty array', async () => {
      expect(await platform.getRepos()).toEqual([]);
    });
  });

  describe('initRepo', () => {
    it('returns object', async () => {
      expect(await platform.initRepo()).toMatchInlineSnapshot(`
        {
          "defaultBranch": "",
          "isFork": false,
          "repoFingerprint": "",
        }
      `);
    });
  });

  describe('dummy functions', () => {
    it('getRepoForceRebase', async () => {
      expect(await platform.getRepoForceRebase()).toBe(false);
    });

    it('findIssue', async () => {
      expect(await platform.findIssue()).toBeNull();
    });

    it('getIssueList', async () => {
      expect(await platform.getIssueList()).toEqual([]);
    });

    it('getRawFile', async () => {
      expect(await platform.getRawFile()).toBeNull();
    });

    it('getJsonFile', async () => {
      expect(await platform.getJsonFile()).toBeNull();
    });

    it('getPrList', async () => {
      expect(await platform.getPrList()).toEqual([]);
    });

    it('ensureIssueClosing', async () => {
      expect(await platform.ensureIssueClosing()).toBeUndefined();
    });

    it('ensureIssue', async () => {
      expect(await platform.ensureIssue()).toBeNull();
    });

    it('massageMarkdown', () => {
      expect(platform.massageMarkdown('foo')).toBe('foo');
    });

    it('updatePr', async () => {
      expect(await platform.updatePr()).toBeUndefined();
    });

    it('mergePr', async () => {
      expect(await platform.mergePr()).toBe(false);
    });

    it('addReviewers', async () => {
      expect(await platform.addReviewers()).toBeUndefined();
    });

    it('addAssignees', async () => {
      expect(await platform.addAssignees()).toBeUndefined();
    });

    it('createPr', async () => {
      expect(await platform.createPr()).toBeNull();
    });

    it('deleteLabel', async () => {
      expect(await platform.deleteLabel()).toBeUndefined();
    });

    it('setBranchStatus', async () => {
      expect(await platform.setBranchStatus()).toBeUndefined();
    });

    it('getBranchStatus', async () => {
      expect(await platform.getBranchStatus()).toBe('red');
    });

    it('getBranchStatusCheck', async () => {
      expect(await platform.getBranchStatusCheck()).toBeNull();
    });

    it('ensureCommentRemoval', async () => {
      expect(await platform.ensureCommentRemoval()).toBeUndefined();
    });

    it('ensureComment', async () => {
      expect(await platform.ensureComment()).toBeFalse();
    });

    it('getPr', async () => {
      expect(await platform.getPr()).toBeNull();
    });

    it('findPr', async () => {
      expect(await platform.findPr()).toBeNull();
    });

    it('getBranchPr', async () => {
      expect(await platform.getBranchPr()).toBeNull();
    });
  });
});
