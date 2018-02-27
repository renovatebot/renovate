const prWorker = require('../../../lib/workers/pr');
const changelogHelper = require('../../../lib/workers/pr/changelog');
const defaultConfig = require('../../../lib/config/defaults').getConfig();

jest.mock('../../../lib/workers/pr/changelog');
changelogHelper.getChangeLogJSON = jest.fn();
changelogHelper.getChangeLogJSON.mockReturnValue({
  project: {
    github: 'renovateapp/dummy',
    repository: 'https://github.com/renovateapp/dummy',
  },
  versions: [
    {
      date: new Date('2017-01-01'),
      version: '1.1.0',
      changes: [
        {
          date: new Date('2017-01-01'),
          sha: 'abcdefghijklmnopqrstuvwxyz',
          message: 'foo #3\nbar',
        },
      ],
    },
  ],
});

describe('workers/pr', () => {
  describe('checkAutoMerge(pr, config)', () => {
    let config;
    let pr;
    beforeEach(() => {
      config = {
        ...defaultConfig,
      };
      pr = {
        head: {
          ref: 'somebranch',
        },
        canMerge: true,
      };
    });
    afterEach(() => {
      jest.clearAllMocks();
    });
    it('should not automerge if not configured', async () => {
      await prWorker.checkAutoMerge(pr, config);
      expect(platform.mergePr.mock.calls.length).toBe(0);
    });
    it('should automerge if enabled and pr is mergeable', async () => {
      config.automerge = true;
      pr.canRebase = true;
      platform.getBranchStatus.mockReturnValueOnce('success');
      await prWorker.checkAutoMerge(pr, config);
      expect(platform.mergePr.mock.calls.length).toBe(1);
    });
    it('should not automerge if enabled and pr is mergeable but cannot rebase', async () => {
      config.automerge = true;
      pr.canRebase = false;
      platform.getBranchStatus.mockReturnValueOnce('success');
      await prWorker.checkAutoMerge(pr, config);
      expect(platform.mergePr.mock.calls.length).toBe(0);
    });
    it('should not automerge if enabled and pr is mergeable but branch status is not success', async () => {
      config.automerge = true;
      platform.getBranchStatus.mockReturnValueOnce('pending');
      await prWorker.checkAutoMerge(pr, config);
      expect(platform.mergePr.mock.calls.length).toBe(0);
    });
    it('should not automerge if enabled and pr is mergeable but unstable', async () => {
      config.automerge = true;
      pr.canMerge = undefined;
      await prWorker.checkAutoMerge(pr, config);
      expect(platform.mergePr.mock.calls.length).toBe(0);
    });
    it('should not automerge if enabled and pr is unmergeable', async () => {
      config.automerge = true;
      pr.isUnmergeable = true;
      await prWorker.checkAutoMerge(pr, config);
      expect(platform.mergePr.mock.calls.length).toBe(0);
    });
  });
  describe('ensurePr', () => {
    let config;
    const existingPr = {
      displayNumber: 'Existing PR',
      title: 'Update dependency dummy to v1.1.0',
    };
    beforeEach(() => {
      config = {
        ...defaultConfig,
      };
      config.branchName = 'renovate/dummy-1.x';
      config.prTitle = 'Update dependency dummy to v1.1.0';
      config.depName = 'dummy';
      config.isGitHub = true;
      config.privateRepo = true;
      config.currentVersion = '1.0.0';
      config.newVersion = '1.1.0';
      config.repositoryUrl = 'https://github.com/renovateapp/dummy';
      platform.createPr.mockReturnValue({ displayNumber: 'New Pull Request' });
      config.upgrades = [config];
    });
    afterEach(() => {
      jest.clearAllMocks();
    });
    it('should return null if check fails', async () => {
      platform.updatePr.mockImplementationOnce(() => {
        throw new Error('oops');
      });
      config.newVersion = '1.2.0';
      platform.getBranchPr.mockReturnValueOnce(existingPr);
      const pr = await prWorker.ensurePr(config);
      expect(pr).toBe(null);
    });
    it('should return null if waiting for success', async () => {
      platform.getBranchStatus.mockReturnValueOnce('failed');
      config.prCreation = 'status-success';
      const pr = await prWorker.ensurePr(config);
      expect(pr).toBe(null);
    });
    it('should create PR if success', async () => {
      platform.getBranchStatus.mockReturnValueOnce('success');
      config.prCreation = 'status-success';
      const pr = await prWorker.ensurePr(config);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(platform.createPr.mock.calls[0]).toMatchSnapshot();
      existingPr.body = platform.createPr.mock.calls[0][2];
    });
    it('should convert to HTML PR for gitlab', async () => {
      platform.getBranchStatus.mockReturnValueOnce('success');
      config.prCreation = 'status-success';
      config.isGitLab = true;
      const pr = await prWorker.ensurePr(config);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(platform.createPr.mock.calls[0]).toMatchSnapshot();
      expect(platform.createPr.mock.calls[0][2].indexOf('<p>This MR')).not.toBe(
        -1
      );
    });
    it('should strip HTML PR for vsts', async () => {
      platform.getBranchStatus.mockReturnValueOnce('success');
      config.prCreation = 'status-success';
      config.isVsts = true;
      const pr = await prWorker.ensurePr(config);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(platform.createPr.mock.calls[0]).toMatchSnapshot();
      expect(platform.createPr.mock.calls[0][2].indexOf('<details>')).toBe(-1);
    });
    it('should return null if creating PR fails', async () => {
      platform.getBranchStatus.mockReturnValueOnce('success');
      platform.createPr = jest.fn();
      platform.createPr.mockImplementationOnce(() => {
        throw new Error('Validation Failed (422)');
      });
      config.prCreation = 'status-success';
      const pr = await prWorker.ensurePr(config);
      expect(pr).toBe(null);
    });
    it('should return null if waiting for not pending', async () => {
      platform.getBranchStatus.mockReturnValueOnce('pending');
      platform.getBranchLastCommitTime.mockImplementationOnce(() => new Date());
      config.prCreation = 'not-pending';
      const pr = await prWorker.ensurePr(config);
      expect(pr).toBe(null);
    });
    it('should create PR if pending timeout hit', async () => {
      platform.getBranchStatus.mockReturnValueOnce('pending');
      platform.getBranchLastCommitTime.mockImplementationOnce(
        () => new Date('2017-01-01')
      );
      config.prCreation = 'not-pending';
      const pr = await prWorker.ensurePr(config);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
    });
    it('should create PR if no longer pending', async () => {
      platform.getBranchStatus.mockReturnValueOnce('failed');
      config.prCreation = 'not-pending';
      const pr = await prWorker.ensurePr(config);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
    });
    it('should create new branch if none exists', async () => {
      const pr = await prWorker.ensurePr(config);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(platform.createPr.mock.calls[0][2].indexOf('Errors</h3>')).toEqual(
        -1
      );
      expect(
        platform.createPr.mock.calls[0][2].indexOf('Warnings</h3>')
      ).toEqual(-1);
    });
    it('should add assignees and reviewers to new PR', async () => {
      config.assignees = ['@foo', 'bar'];
      config.reviewers = ['baz', '@boo'];
      const pr = await prWorker.ensurePr(config);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(platform.addAssignees.mock.calls.length).toBe(1);
      expect(platform.addAssignees.mock.calls).toMatchSnapshot();
      expect(platform.addReviewers.mock.calls.length).toBe(1);
      expect(platform.addReviewers.mock.calls).toMatchSnapshot();
    });
    it('should add reviewers even if assignees fails', async () => {
      platform.addAssignees.mockImplementationOnce(() => {
        throw new Error('some error');
      });
      config.assignees = ['@foo', 'bar'];
      config.reviewers = ['baz', '@boo'];
      const pr = await prWorker.ensurePr(config);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(platform.addAssignees.mock.calls.length).toBe(1);
      expect(platform.addReviewers.mock.calls.length).toBe(1);
    });
    it('should handled failed reviewers add', async () => {
      platform.addReviewers.mockImplementationOnce(() => {
        throw new Error('some error');
      });
      config.assignees = ['@foo', 'bar'];
      config.reviewers = ['baz', '@boo'];
      const pr = await prWorker.ensurePr(config);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(platform.addAssignees.mock.calls.length).toBe(1);
      expect(platform.addReviewers.mock.calls.length).toBe(1);
    });
    it('should display errors and warnings', async () => {
      config.errors = [{}];
      config.warnings = [{}];
      const pr = await prWorker.ensurePr(config);
      expect(
        platform.createPr.mock.calls[0][2].indexOf('# Errors')
      ).not.toEqual(-1);
      expect(
        platform.createPr.mock.calls[0][2].indexOf('# Warnings')
      ).not.toEqual(-1);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
    });
    it('should not add assignees and reviewers to new PR if automerging enabled', async () => {
      config.assignees = ['bar'];
      config.reviewers = ['baz'];
      config.automerge = true;
      const pr = await prWorker.ensurePr(config);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(platform.addAssignees.mock.calls.length).toBe(0);
      expect(platform.addReviewers.mock.calls.length).toBe(0);
    });
    it('should add assignees and reviewers to existing PR', async () => {
      config.assignees = ['bar'];
      config.reviewers = ['baz'];
      config.automerge = true;
      platform.getBranchPr.mockReturnValueOnce(existingPr);
      platform.getBranchStatus.mockReturnValueOnce('failure');
      config.semanticCommitScope = null;
      const pr = await prWorker.ensurePr(config);
      expect(platform.updatePr.mock.calls).toMatchSnapshot();
      expect(platform.updatePr.mock.calls.length).toBe(0);
      expect(platform.addAssignees.mock.calls.length).toBe(1);
      expect(platform.addReviewers.mock.calls.length).toBe(1);
      expect(pr).toMatchObject(existingPr);
    });
    it('should return unmodified existing PR', async () => {
      platform.getBranchPr.mockReturnValueOnce(existingPr);
      config.semanticCommitScope = null;
      const pr = await prWorker.ensurePr(config);
      expect(platform.updatePr.mock.calls).toMatchSnapshot();
      expect(platform.updatePr.mock.calls).toHaveLength(0);
      expect(pr).toMatchObject(existingPr);
    });
    it('should return modified existing PR', async () => {
      config.newVersion = '1.2.0';
      platform.getBranchPr.mockReturnValueOnce(existingPr);
      const pr = await prWorker.ensurePr(config);
      expect(pr).toMatchSnapshot();
    });
    it('should return modified existing PR title', async () => {
      config.newVersion = '1.2.0';
      platform.getBranchPr.mockReturnValueOnce({
        ...existingPr,
        title: 'wrong',
      });
      const pr = await prWorker.ensurePr(config);
      expect(pr).toMatchSnapshot();
    });
    it('should create PR if branch tests failed', async () => {
      config.automerge = true;
      config.automergeType = 'branch-push';
      platform.getBranchStatus.mockReturnValueOnce('failure');
      const pr = await prWorker.ensurePr(config);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
    });
    it('should create PR if branch automerging failed', async () => {
      config.automerge = true;
      config.automergeType = 'branch-push';
      platform.getBranchStatus.mockReturnValueOnce('success');
      config.forcePr = true;
      const pr = await prWorker.ensurePr(config);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
    });
    it('should return null if branch automerging not failed', async () => {
      config.automerge = true;
      config.automergeType = 'branch-push';
      platform.getBranchStatus.mockReturnValueOnce('pending');
      platform.getBranchLastCommitTime.mockReturnValueOnce(new Date());
      const pr = await prWorker.ensurePr(config);
      expect(pr).toBe(null);
    });
    it('should not return null if branch automerging taking too long', async () => {
      config.automerge = true;
      config.automergeType = 'branch-push';
      platform.getBranchStatus.mockReturnValueOnce('pending');
      platform.getBranchLastCommitTime.mockReturnValueOnce(
        new Date('2018-01-01')
      );
      const pr = await prWorker.ensurePr(config);
      expect(pr).not.toBe(null);
    });
    it('handles duplicate upgrades', async () => {
      config.upgrades.push(config.upgrades[0]);
      const pr = await prWorker.ensurePr(config);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
    });
    it('should create privateRepo PR if success', async () => {
      platform.getBranchStatus.mockReturnValueOnce('success');
      config.prCreation = 'status-success';
      config.privateRepo = false;
      const pr = await prWorker.ensurePr(config);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(platform.createPr.mock.calls[0]).toMatchSnapshot();
      existingPr.body = platform.createPr.mock.calls[0][2];
    });
  });
});
