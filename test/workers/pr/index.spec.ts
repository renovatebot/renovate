import * as prWorker from '../../../lib/workers/pr';
import * as _changelogHelper from '../../../lib/workers/pr/changelog';
import { getConfig } from '../../../lib/config/defaults';
import { platform as _platform, Pr } from '../../../lib/platform';
import { mocked } from '../../util';

const changelogHelper = mocked(_changelogHelper);
const platform = mocked(_platform);
const defaultConfig = getConfig();

jest.mock('../../../lib/workers/pr/changelog');

changelogHelper.getChangeLogJSON = jest.fn();
changelogHelper.getChangeLogJSON.mockResolvedValue({
  project: {
    githubBaseURL: 'https://github.com/',
    github: 'renovateapp/dummy',
    repository: 'https://github.com/renovateapp/dummy',
  },
  hasReleaseNotes: true,
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
      releaseNotes: {
        url: 'https://github.com/renovateapp/dummy/compare/v1.0.0...v1.1.0',
      },
      compare: {
        url: 'https://github.com/renovateapp/dummy/compare/v1.0.0...v1.1.0',
      },
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
      expect(platform.mergePr).toHaveBeenCalledTimes(0);
    });
    it('should automerge if enabled and pr is mergeable', async () => {
      config.automerge = true;
      pr.isModified = false;
      platform.getBranchStatus.mockResolvedValueOnce('success');
      platform.mergePr.mockResolvedValueOnce(true);
      await prWorker.checkAutoMerge(pr, config);
      expect(platform.mergePr).toHaveBeenCalledTimes(1);
    });
    it('should automerge comment', async () => {
      config.automerge = true;
      config.automergeType = 'pr-comment';
      config.automergeComment = '!merge';
      pr.isModified = false;
      platform.getBranchStatus.mockResolvedValueOnce('success');
      await prWorker.checkAutoMerge(pr, config);
      expect(platform.ensureComment).toHaveBeenCalledTimes(1);
    });
    it('should not automerge if enabled and pr is mergeable but cannot rebase', async () => {
      config.automerge = true;
      pr.isModified = true;
      platform.getBranchStatus.mockResolvedValueOnce('success');
      await prWorker.checkAutoMerge(pr, config);
      expect(platform.mergePr).toHaveBeenCalledTimes(0);
    });
    it('should not automerge if enabled and pr is mergeable but branch status is not success', async () => {
      config.automerge = true;
      platform.getBranchStatus.mockResolvedValueOnce('pending');
      await prWorker.checkAutoMerge(pr, config);
      expect(platform.mergePr).toHaveBeenCalledTimes(0);
    });
    it('should not automerge if enabled and pr is mergeable but unstable', async () => {
      config.automerge = true;
      pr.canMerge = undefined;
      await prWorker.checkAutoMerge(pr, config);
      expect(platform.mergePr).toHaveBeenCalledTimes(0);
    });
    it('should not automerge if enabled and pr is unmergeable', async () => {
      config.automerge = true;
      pr.isConflicted = true;
      await prWorker.checkAutoMerge(pr, config);
      expect(platform.mergePr).toHaveBeenCalledTimes(0);
    });
  });
  describe('ensurePr', () => {
    let config;
    // TODO fix type
    const existingPr: Pr = {
      displayNumber: 'Existing PR',
      title: 'Update dependency dummy to v1.1.0',
      body:
        'Some body<!-- Reviewable:start -->something<!-- Reviewable:end -->\n\n',
      isModified: false,
    } as never;
    beforeEach(() => {
      config = {
        ...defaultConfig,
      };
      config.branchName = 'renovate/dummy-1.x';
      config.prTitle = 'Update dependency dummy to v1.1.0';
      config.depType = 'devDependencies';
      config.depName = 'dummy';
      config.privateRepo = true;
      config.displayFrom = '1.0.0';
      config.displayTo = '1.1.0';
      config.updateType = 'minor';
      config.homepage = 'https://dummy.com';
      config.sourceUrl = 'https://github.com/renovateapp/dummy';
      config.sourceDirectory = 'packages/a';
      config.changelogUrl = 'https://github.com/renovateapp/dummy/changelog.md';
      // TODO fix type
      platform.createPr.mockResolvedValue({
        displayNumber: 'New Pull Request',
      } as never);
      config.upgrades = [config];
      platform.getPrBody = jest.fn(input => input);
      platform.getBranchPr = jest.fn();
      platform.getBranchStatus = jest.fn();
    });
    afterEach(() => {
      jest.clearAllMocks();
    });
    it('should return null if check fails', async () => {
      platform.updatePr.mockImplementationOnce(() => {
        throw new Error('oops');
      });
      config.newValue = '1.2.0';
      platform.getBranchPr.mockResolvedValueOnce(existingPr);
      const pr = await prWorker.ensurePr(config);
      expect(pr).toBeNull();
    });
    it('should return null if waiting for success', async () => {
      platform.getBranchStatus.mockResolvedValueOnce('failed');
      config.prCreation = 'status-success';
      const pr = await prWorker.ensurePr(config);
      expect(pr).toEqual('pending');
    });
    it('should return needs-approval if prCreation set to approval', async () => {
      platform.getBranchStatus.mockResolvedValueOnce('success');
      config.prCreation = 'approval';
      const pr = await prWorker.ensurePr(config);
      expect(pr).toBe('needs-pr-approval');
    });
    it('should create PR if success', async () => {
      platform.getBranchStatus.mockResolvedValueOnce('success');
      config.prCreation = 'status-success';
      config.automerge = true;
      config.schedule = 'before 5am';
      const pr = await prWorker.ensurePr(config);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(platform.createPr.mock.calls[0]).toMatchSnapshot();
      existingPr.body = platform.createPr.mock.calls[0][0].prBody;
    });
    it('should create group PR', async () => {
      config.upgrades = config.upgrades.concat([
        {
          depName: 'a',
          displayFrom: 'zzzzzz',
          displayTo: 'aaaaaaa',
          prBodyNotes: ['note 1', 'note 2'],
        },
        {
          depName: 'b',
          newDigestShort: 'bbbbbbb',
          displayFrom: 'some_old_value',
          displayTo: 'some_new_value',
          updateType: 'pin',
        },
        {
          depName: 'c',
          gitRef: 'ccccccc',
        },
        {
          depName: 'd',
          updateType: 'lockFileMaintenance',
          prBodyNotes: ['{{#if foo}}'],
        },
      ]);
      config.updateType = 'lockFileMaintenance';
      config.recreateClosed = true;
      const pr = await prWorker.ensurePr(config);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(platform.createPr.mock.calls[0]).toMatchSnapshot();
    });
    it('should add note about Pin', async () => {
      platform.getBranchStatus.mockResolvedValueOnce('success');
      config.prCreation = 'status-success';
      config.isPin = true;
      config.updateType = 'pin';
      config.schedule = 'before 5am';
      config.timezone = 'some timezone';
      config.rebaseStalePrs = true;
      const pr = await prWorker.ensurePr(config);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(platform.createPr.mock.calls[0]).toMatchSnapshot();
      expect(
        platform.createPr.mock.calls[0][0].prBody.includes('this Pin PR')
      ).toBe(true);
    });
    it('should return null if creating PR fails', async () => {
      platform.getBranchStatus.mockResolvedValueOnce('success');
      platform.createPr = jest.fn();
      platform.createPr.mockImplementationOnce(() => {
        throw new Error('Validation Failed (422)');
      });
      config.prCreation = 'status-success';
      const pr = await prWorker.ensurePr(config);
      expect(pr).toBeNull();
    });
    it('should return null if waiting for not pending', async () => {
      platform.getBranchStatus.mockResolvedValueOnce('pending');
      platform.getBranchLastCommitTime.mockImplementationOnce(() =>
        Promise.resolve(new Date())
      );
      config.prCreation = 'not-pending';
      const pr = await prWorker.ensurePr(config);
      expect(pr).toEqual('pending');
    });
    it('should create PR if pending timeout hit', async () => {
      platform.getBranchStatus.mockResolvedValueOnce('pending');
      platform.getBranchLastCommitTime.mockImplementationOnce(() =>
        Promise.resolve(new Date('2017-01-01'))
      );
      config.prCreation = 'not-pending';
      const pr = await prWorker.ensurePr(config);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
    });
    it('should create PR if no longer pending', async () => {
      platform.getBranchStatus.mockResolvedValueOnce('failed');
      config.prCreation = 'not-pending';
      const pr = await prWorker.ensurePr(config);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
    });
    it('should create new branch if none exists', async () => {
      const pr = await prWorker.ensurePr(config);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
    });
    it('should add assignees and reviewers to new PR', async () => {
      config.assignees = ['@foo', 'bar'];
      config.reviewers = ['baz', '@boo'];
      const pr = await prWorker.ensurePr(config);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(platform.addAssignees).toHaveBeenCalledTimes(1);
      expect(platform.addAssignees.mock.calls).toMatchSnapshot();
      expect(platform.addReviewers).toHaveBeenCalledTimes(1);
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
      expect(platform.addAssignees).toHaveBeenCalledTimes(1);
      expect(platform.addReviewers).toHaveBeenCalledTimes(1);
    });
    it('should handled failed reviewers add', async () => {
      platform.addReviewers.mockImplementationOnce(() => {
        throw new Error('some error');
      });
      config.assignees = ['@foo', 'bar'];
      config.reviewers = ['baz', '@boo'];
      const pr = await prWorker.ensurePr(config);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(platform.addAssignees).toHaveBeenCalledTimes(1);
      expect(platform.addReviewers).toHaveBeenCalledTimes(1);
    });
    it('should not add assignees and reviewers to new PR if automerging enabled', async () => {
      config.assignees = ['bar'];
      config.reviewers = ['baz'];
      config.automerge = true;
      const pr = await prWorker.ensurePr(config);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(platform.addAssignees).toHaveBeenCalledTimes(0);
      expect(platform.addReviewers).toHaveBeenCalledTimes(0);
    });
    it('should add assignees and reviewers to new PR if automerging enabled but configured to always assign', async () => {
      config.assignees = ['bar'];
      config.reviewers = ['baz'];
      config.automerge = true;
      config.assignAutomerge = true;
      const pr = await prWorker.ensurePr(config);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(platform.addAssignees).toHaveBeenCalledTimes(1);
      expect(platform.addReviewers).toHaveBeenCalledTimes(1);
    });
    it('should add random sample of assignees and reviewers to new PR', async () => {
      config.assignees = ['foo', 'bar', 'baz'];
      config.assigneesSampleSize = 2;
      config.reviewers = ['baz', 'boo', 'bor'];
      config.reviewersSampleSize = 2;
      await prWorker.ensurePr(config);

      expect(platform.addAssignees).toHaveBeenCalledTimes(1);
      const assignees = platform.addAssignees.mock.calls[0][1];
      expect(assignees.length).toEqual(2);
      expect(config.assignees).toEqual(expect.arrayContaining(assignees));

      expect(platform.addReviewers).toHaveBeenCalledTimes(1);
      const reviewers = platform.addReviewers.mock.calls[0][1];
      expect(reviewers.length).toEqual(2);
      expect(config.reviewers).toEqual(expect.arrayContaining(reviewers));
    });
    it('should return unmodified existing PR', async () => {
      platform.getBranchPr.mockResolvedValueOnce(existingPr);
      config.semanticCommitScope = null;
      config.automerge = true;
      config.schedule = 'before 5am';
      const pr = await prWorker.ensurePr(config);
      expect(platform.updatePr.mock.calls).toMatchSnapshot();
      expect(platform.updatePr).toHaveBeenCalledTimes(0);
      expect(pr).toMatchObject(existingPr);
    });
    it('should return unmodified existing PR if only whitespace changes', async () => {
      const modifiedPr = JSON.parse(
        JSON.stringify(existingPr)
          .replace(' ', '  ')
          .replace('\n', '\r\n')
      );
      platform.getBranchPr.mockResolvedValueOnce(modifiedPr);
      config.semanticCommitScope = null;
      config.automerge = true;
      config.schedule = 'before 5am';
      const pr = await prWorker.ensurePr(config);
      expect(platform.updatePr).toHaveBeenCalledTimes(0);
      expect(pr).toMatchObject(modifiedPr);
    });
    it('should return modified existing PR', async () => {
      config.newValue = '1.2.0';
      config.automerge = true;
      config.schedule = 'before 5am';
      platform.getBranchPr.mockResolvedValueOnce(existingPr);
      const pr = await prWorker.ensurePr(config);
      expect(pr).toMatchSnapshot();
    });
    it('should return modified existing PR title', async () => {
      config.newValue = '1.2.0';
      platform.getBranchPr.mockResolvedValueOnce({
        ...existingPr,
        title: 'wrong',
      });
      const pr = await prWorker.ensurePr(config);
      expect(pr).toMatchSnapshot();
    });
    it('should create PR if branch tests failed', async () => {
      config.automerge = true;
      config.automergeType = 'branch';
      config.branchAutomergeFailureMessage = 'branch status error';
      platform.getBranchStatus.mockResolvedValueOnce('failed');
      const pr = await prWorker.ensurePr(config);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
    });
    it('should create PR if branch automerging failed', async () => {
      config.automerge = true;
      config.automergeType = 'branch';
      platform.getBranchStatus.mockResolvedValueOnce('success');
      config.forcePr = true;
      const pr = await prWorker.ensurePr(config);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
    });
    it('should return null if branch automerging not failed', async () => {
      config.automerge = true;
      config.automergeType = 'branch';
      platform.getBranchStatus.mockResolvedValueOnce('pending');
      platform.getBranchLastCommitTime.mockResolvedValueOnce(new Date());
      const pr = await prWorker.ensurePr(config);
      expect(pr).toBeNull();
    });
    it('should not return null if branch automerging taking too long', async () => {
      config.automerge = true;
      config.automergeType = 'branch';
      platform.getBranchStatus.mockResolvedValueOnce('pending');
      platform.getBranchLastCommitTime.mockResolvedValueOnce(
        new Date('2018-01-01')
      );
      const pr = await prWorker.ensurePr(config);
      expect(pr).not.toBeNull();
    });
    it('handles duplicate upgrades', async () => {
      config.upgrades.push(config.upgrades[0]);
      const pr = await prWorker.ensurePr(config);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
    });
    it('should create privateRepo PR if success', async () => {
      platform.getBranchStatus.mockResolvedValueOnce('success');
      config.prCreation = 'status-success';
      config.privateRepo = false;
      const pr = await prWorker.ensurePr(config);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(platform.createPr.mock.calls[0]).toMatchSnapshot();
      existingPr.body = platform.createPr.mock.calls[0][0].prBody;
    });
    it('should create PR if waiting for not pending but artifactErrors', async () => {
      platform.getBranchStatus.mockResolvedValueOnce('pending');
      platform.getBranchLastCommitTime.mockResolvedValueOnce(new Date());
      config.prCreation = 'not-pending';
      config.artifactErrors = [{}];
      config.platform = 'gitlab';
      const pr = await prWorker.ensurePr(config);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
    });

    it('should trigger GitLab automerge when configured', async () => {
      config.gitLabAutomerge = true;
      config.automerge = true;
      await prWorker.ensurePr(config);
      const args = platform.createPr.mock.calls[0];
      expect(args[0].platformOptions).toMatchObject({
        gitLabAutomerge: true,
      });
    });
  });
});
