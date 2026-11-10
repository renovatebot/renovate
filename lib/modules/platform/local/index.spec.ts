import * as platform from './index.ts';

describe('modules/platform/local/index', () => {
  describe('initPlatform', () => {
    it('returns input', async () => {
      await expect(platform.initPlatform({})).resolves.toMatchInlineSnapshot(`
        {
          "dryRun": "lookup",
          "endpoint": "local",
          "persistRepoData": true,
          "requireConfig": "optional",
        }
      `);
    });

    it('preserves an explicit dryRun=extract override', async () => {
      await expect(
        platform.initPlatform({
          dryRun: 'extract',
        }),
      ).resolves.toEqual({
        dryRun: 'extract',
        endpoint: 'local',
        persistRepoData: true,
        requireConfig: 'optional',
      });
    });

    it('falls back to lookup when dryRun=full is requested', async () => {
      await expect(
        platform.initPlatform({
          dryRun: 'full',
        }),
      ).resolves.toEqual({
        dryRun: 'lookup',
        endpoint: 'local',
        persistRepoData: true,
        requireConfig: 'optional',
      });
    });
  });

  describe('getRepos', () => {
    it('returns empty array', async () => {
      await expect(platform.getRepos()).resolves.toEqual([]);
    });
  });

  describe('initRepo', () => {
    it('returns object', async () => {
      await expect(platform.initRepo()).resolves.toMatchInlineSnapshot(`
        {
          "defaultBranch": "",
          "isFork": false,
          "repoFingerprint": "",
        }
      `);
    });
  });

  describe('dummy functions', () => {
    it('findIssue', async () => {
      await expect(platform.findIssue()).resolves.toBeNull();
    });

    it('getIssueList', async () => {
      await expect(platform.getIssueList()).resolves.toEqual([]);
    });

    it('getRawFile', async () => {
      await expect(platform.getRawFile()).resolves.toBeNull();
    });

    it('getJsonFile', async () => {
      await expect(platform.getJsonFile()).resolves.toBeNull();
    });

    it('getPrList', async () => {
      await expect(platform.getPrList()).resolves.toEqual([]);
    });

    it('ensureIssueClosing', async () => {
      await expect(platform.ensureIssueClosing()).resolves.toBeUndefined();
    });

    it('ensureIssue', async () => {
      await expect(platform.ensureIssue()).resolves.toBeNull();
    });

    it('massageMarkdown', () => {
      expect(platform.massageMarkdown('foo')).toBe('foo');
    });

    it('maxBodyLength', () => {
      expect(platform.maxBodyLength()).toBe(Infinity);
    });

    it('updatePr', async () => {
      await expect(platform.updatePr()).resolves.toBeUndefined();
    });

    it('mergePr', async () => {
      await expect(platform.mergePr()).resolves.toBe(false);
    });

    it('addReviewers', async () => {
      await expect(platform.addReviewers()).resolves.toBeUndefined();
    });

    it('addAssignees', async () => {
      await expect(platform.addAssignees()).resolves.toBeUndefined();
    });

    it('createPr', async () => {
      await expect(platform.createPr()).resolves.toBeNull();
    });

    it('deleteLabel', async () => {
      await expect(platform.deleteLabel()).resolves.toBeUndefined();
    });

    it('setBranchStatus', async () => {
      await expect(platform.setBranchStatus()).resolves.toBeUndefined();
    });

    it('getBranchStatus', async () => {
      await expect(platform.getBranchStatus()).resolves.toBe('red');
    });

    it('getBranchStatusCheck', async () => {
      await expect(platform.getBranchStatusCheck()).resolves.toBeNull();
    });

    it('ensureCommentRemoval', async () => {
      await expect(platform.ensureCommentRemoval()).resolves.toBeUndefined();
    });

    it('ensureComment', async () => {
      await expect(platform.ensureComment()).resolves.toBeFalse();
    });

    it('getPr', async () => {
      await expect(platform.getPr()).resolves.toBeNull();
    });

    it('findPr', async () => {
      await expect(platform.findPr()).resolves.toBeNull();
    });

    it('getBranchPr', async () => {
      await expect(platform.getBranchPr()).resolves.toBeNull();
    });
  });
});
