import { getName, git, mocked, partial } from '../../../test/util';
import { getConfig } from '../../config/defaults';
import { PLATFORM_TYPE_GITLAB } from '../../constants/platforms';
import { Pr, platform as _platform } from '../../platform';
import { BranchStatus } from '../../types';
import * as _limits from '../global/limits';
import { BranchConfig, PrResult } from '../types';
import * as prAutomerge from './automerge';
import * as _changelogHelper from './changelog';
import { getChangeLogJSON } from './changelog';
import * as codeOwners from './code-owners';
import * as prWorker from '.';

const codeOwnersMock = mocked(codeOwners);
const changelogHelper = mocked(_changelogHelper);
const gitlabChangelogHelper = mocked(_changelogHelper);
const platform = mocked(_platform);
const defaultConfig = getConfig();
const limits = mocked(_limits);

jest.mock('../../util/git');
jest.mock('./changelog');
jest.mock('./code-owners');
jest.mock('../global/limits');

function setupChangelogMock() {
  changelogHelper.getChangeLogJSON = jest.fn();
  const resultValue = {
    project: {
      baseUrl: 'https://github.com/',
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
  };
  const errorValue = {
    error: _changelogHelper.ChangeLogError.MissingGithubToken,
  };
  changelogHelper.getChangeLogJSON.mockResolvedValueOnce(resultValue);
  changelogHelper.getChangeLogJSON.mockResolvedValueOnce(errorValue);
  changelogHelper.getChangeLogJSON.mockResolvedValue(resultValue);
}

function setupGitlabChangelogMock() {
  gitlabChangelogHelper.getChangeLogJSON = jest.fn();
  const resultValue = {
    project: {
      baseUrl: 'https://gitlab.com/',
      gitlab: 'renovateapp/gitlabdummy',
      repository: 'https://gitlab.com/renovateapp/gitlabdummy',
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
          url:
            'https://gitlab.com/renovateapp/gitlabdummy/compare/v1.0.0...v1.1.0',
        },
        compare: {
          url:
            'https://gitlab.com/renovateapp/gitlabdummy/compare/v1.0.0...v1.1.0',
        },
      },
    ],
  };
  const errorValue = {
    error: _changelogHelper.ChangeLogError.MissingGithubToken,
  };
  gitlabChangelogHelper.getChangeLogJSON.mockResolvedValueOnce(resultValue);
  gitlabChangelogHelper.getChangeLogJSON.mockResolvedValueOnce(errorValue);
  gitlabChangelogHelper.getChangeLogJSON.mockResolvedValue(resultValue);
}

describe(getName(__filename), () => {
  describe('checkAutoMerge(pr, config)', () => {
    let config: BranchConfig;
    let pr: Pr;
    beforeEach(() => {
      config = partial<BranchConfig>({
        ...defaultConfig,
      });
      pr = partial<Pr>({
        canMerge: true,
      });
    });
    afterEach(() => {
      jest.clearAllMocks();
    });
    it('should not automerge if not configured', async () => {
      await prAutomerge.checkAutoMerge(pr, config);
      expect(platform.mergePr).toHaveBeenCalledTimes(0);
    });
    it('should automerge if enabled and pr is mergeable', async () => {
      config.automerge = true;
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.green);
      platform.mergePr.mockResolvedValueOnce(true);
      await prAutomerge.checkAutoMerge(pr, config);
      expect(platform.mergePr).toHaveBeenCalledTimes(1);
    });
    it('should automerge comment', async () => {
      config.automerge = true;
      config.automergeType = 'pr-comment';
      config.automergeComment = '!merge';
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.green);
      await prAutomerge.checkAutoMerge(pr, config);
      expect(platform.ensureCommentRemoval).toHaveBeenCalledTimes(0);
      expect(platform.ensureComment).toHaveBeenCalledTimes(1);
    });
    it('should remove previous automerge comment when rebasing', async () => {
      config.automerge = true;
      config.automergeType = 'pr-comment';
      config.automergeComment = '!merge';
      config.rebaseRequested = true;
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.green);
      await prAutomerge.checkAutoMerge(pr, config);
      expect(platform.ensureCommentRemoval).toHaveBeenCalledTimes(1);
      expect(platform.ensureComment).toHaveBeenCalledTimes(1);
    });
    it('should not automerge if enabled and pr is mergeable but cannot rebase', async () => {
      config.automerge = true;
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.green);
      git.isBranchModified.mockResolvedValueOnce(true);
      await prAutomerge.checkAutoMerge(pr, config);
      expect(platform.mergePr).toHaveBeenCalledTimes(0);
    });
    it('should not automerge if enabled and pr is mergeable but branch status is not success', async () => {
      config.automerge = true;
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.yellow);
      await prAutomerge.checkAutoMerge(pr, config);
      expect(platform.mergePr).toHaveBeenCalledTimes(0);
    });
    it('should not automerge if enabled and pr is mergeable but unstable', async () => {
      config.automerge = true;
      pr.canMerge = undefined;
      await prAutomerge.checkAutoMerge(pr, config);
      expect(platform.mergePr).toHaveBeenCalledTimes(0);
    });
    it('should not automerge if enabled and pr is unmergeable', async () => {
      config.automerge = true;
      pr.isConflicted = true;
      await prAutomerge.checkAutoMerge(pr, config);
      expect(platform.mergePr).toHaveBeenCalledTimes(0);
    });
  });
  describe('ensurePr', () => {
    let config: BranchConfig;
    // TODO fix type
    const existingPr: Pr = {
      displayNumber: 'Existing PR',
      title: 'Update dependency dummy to v1.1.0',
      body:
        'Some body<!-- Reviewable:start -->something<!-- Reviewable:end -->\n\n',
    } as never;
    beforeEach(() => {
      jest.resetAllMocks();
      setupChangelogMock();
      config = partial<BranchConfig>({
        ...defaultConfig,
      });
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
      platform.massageMarkdown = jest.fn((input) => input);
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
      const { prResult, pr } = await prWorker.ensurePr(config);
      expect(prResult).toEqual(PrResult.Error);
      expect(pr).toBeUndefined();
    });
    it('should return null if waiting for success', async () => {
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.red);
      config.prCreation = 'status-success';
      const { prResult, pr } = await prWorker.ensurePr(config);
      expect(prResult).toEqual(PrResult.AwaitingGreenBranch);
      expect(pr).toBeUndefined();
    });
    it('should return needs-approval if prCreation set to approval', async () => {
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.green);
      config.prCreation = 'approval';
      const { prResult, pr } = await prWorker.ensurePr(config);
      expect(prResult).toEqual(PrResult.AwaitingApproval);
      expect(pr).toBeUndefined();
    });
    it('should create PR if success for gitlab deps', async () => {
      setupGitlabChangelogMock();
      config.branchName = 'renovate/gitlabdummy-1.x';
      config.depName = 'gitlabdummy';
      config.sourceUrl = 'https://gitlab.com/renovateapp/gitlabdummy';
      config.changelogUrl =
        'https://gitlab.com/renovateapp/gitlabdummy/changelog.md';
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.green);
      config.prCreation = 'status-success';
      config.automerge = true;
      config.schedule = ['before 5am'];
      const { prResult, pr } = await prWorker.ensurePr(config);
      expect(prResult).toEqual(PrResult.Created);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(platform.createPr.mock.calls[0]).toMatchSnapshot();
      existingPr.body = platform.createPr.mock.calls[0][0].prBody;
      config.branchName = 'renovate/dummy-1.x';
      config.depName = 'dummy';
      config.sourceUrl = 'https://github.com/renovateapp/dummy';
      config.changelogUrl = 'https://github.com/renovateapp/dummy/changelog.md';
    });
    it('should create PR if success', async () => {
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.green);
      config.logJSON = await getChangeLogJSON(config);
      config.prCreation = 'status-success';
      config.automerge = true;
      config.schedule = ['before 5am'];
      const { prResult, pr } = await prWorker.ensurePr(config);
      expect(prResult).toEqual(PrResult.Created);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(platform.createPr.mock.calls[0]).toMatchSnapshot();
      existingPr.body = platform.createPr.mock.calls[0][0].prBody;
    });
    it('should not create PR if limit is reached', async () => {
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.green);
      config.logJSON = await getChangeLogJSON(config);
      config.prCreation = 'status-success';
      config.automerge = true;
      config.schedule = ['before 5am'];
      limits.isLimitReached.mockReturnValueOnce(true);
      const { prResult } = await prWorker.ensurePr(config);
      expect(prResult).toEqual(PrResult.LimitReached);
      expect(platform.createPr.mock.calls).toBeEmpty();
    });
    it('should create PR if limit is reached but dashboard checked', async () => {
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.green);
      config.logJSON = await getChangeLogJSON(config);
      config.prCreation = 'status-success';
      config.automerge = true;
      config.schedule = ['before 5am'];
      limits.isLimitReached.mockReturnValueOnce(true);
      const { prResult } = await prWorker.ensurePr({
        ...config,
        dependencyDashboardChecks: { 'renovate/dummy-1.x': 'true' },
      });
      expect(prResult).toEqual(PrResult.Created);
      expect(platform.createPr).toHaveBeenCalled();
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
      ] as never);
      config.updateType = 'lockFileMaintenance';
      config.recreateClosed = true;
      config.rebaseWhen = 'never';
      for (const upgrade of config.upgrades) {
        upgrade.logJSON = await getChangeLogJSON(upgrade);
      }
      const { prResult, pr } = await prWorker.ensurePr(config);
      expect(prResult).toEqual(PrResult.Created);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(platform.createPr.mock.calls[0]).toMatchSnapshot();
    });
    it('should add note about Pin', async () => {
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.green);
      config.prCreation = 'status-success';
      config.isPin = true;
      config.updateType = 'pin';
      config.schedule = ['before 5am'];
      config.timezone = 'some timezone';
      config.rebaseWhen = 'behind-base-branch';
      config.logJSON = await getChangeLogJSON(config);
      const { prResult, pr } = await prWorker.ensurePr(config);
      expect(prResult).toEqual(PrResult.Created);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(platform.createPr.mock.calls[0]).toMatchSnapshot();
      expect(platform.createPr.mock.calls[0][0].prBody).toContain(
        'this Pin PR'
      );
    });
    it('should return null if creating PR fails', async () => {
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.green);
      platform.createPr = jest.fn();
      platform.createPr.mockImplementationOnce(() => {
        throw new Error('Validation Failed (422)');
      });
      config.prCreation = 'status-success';
      const { prResult, pr } = await prWorker.ensurePr(config);
      expect(prResult).toEqual(PrResult.Error);
      expect(pr).toBeUndefined();
    });
    it('should return null if waiting for not pending', async () => {
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.yellow);
      git.getBranchLastCommitTime.mockImplementationOnce(() =>
        Promise.resolve(new Date())
      );
      config.prCreation = 'not-pending';
      const { prResult, pr } = await prWorker.ensurePr(config);
      expect(prResult).toEqual(PrResult.AwaitingNotPending);
      expect(pr).toBeUndefined();
    });
    it('should not create PR if waiting for not pending with stabilityStatus yellow', async () => {
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.yellow);
      git.getBranchLastCommitTime.mockImplementationOnce(() =>
        Promise.resolve(new Date())
      );
      config.prCreation = 'not-pending';
      config.stabilityStatus = BranchStatus.yellow;
      const { prResult, pr } = await prWorker.ensurePr(config);
      expect(prResult).toEqual(PrResult.AwaitingNotPending);
      expect(pr).toBeUndefined();
    });
    it('should create PR if pending timeout hit', async () => {
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.yellow);
      git.getBranchLastCommitTime.mockImplementationOnce(() =>
        Promise.resolve(new Date('2017-01-01'))
      );
      config.prCreation = 'not-pending';
      config.stabilityStatus = BranchStatus.yellow;
      const { prResult, pr } = await prWorker.ensurePr(config);
      expect(prResult).toEqual(PrResult.Created);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
    });
    it('should create PR if no longer pending', async () => {
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.red);
      config.prCreation = 'not-pending';
      const { prResult, pr } = await prWorker.ensurePr(config);
      expect(prResult).toEqual(PrResult.Created);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
    });
    it('should create new branch if none exists', async () => {
      const { prResult, pr } = await prWorker.ensurePr(config);
      expect(prResult).toEqual(PrResult.Created);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
    });
    it('should add assignees and reviewers to new PR', async () => {
      config.assignees = ['@foo', 'bar'];
      config.reviewers = ['baz', '@boo'];
      const { prResult, pr } = await prWorker.ensurePr(config);
      expect(prResult).toEqual(PrResult.Created);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(platform.addAssignees).toHaveBeenCalledTimes(1);
      expect(platform.addAssignees.mock.calls).toMatchSnapshot();
      expect(platform.addReviewers).toHaveBeenCalledTimes(1);
      expect(platform.addReviewers.mock.calls).toMatchSnapshot();
    });
    it('should determine assignees from code owners', async () => {
      config.assigneesFromCodeOwners = true;
      codeOwnersMock.codeOwnersForPr.mockResolvedValueOnce(['@john', '@maria']);
      await prWorker.ensurePr(config);
      expect(platform.addAssignees).toHaveBeenCalledTimes(1);
      expect(platform.addAssignees.mock.calls).toMatchSnapshot();
    });
    it('should determine reviewers from code owners', async () => {
      config.reviewersFromCodeOwners = true;
      codeOwnersMock.codeOwnersForPr.mockResolvedValueOnce(['@john', '@maria']);
      await prWorker.ensurePr(config);
      expect(platform.addReviewers).toHaveBeenCalledTimes(1);
      expect(platform.addReviewers.mock.calls).toMatchSnapshot();
    });
    it('should combine assignees from code owners and config', async () => {
      codeOwnersMock.codeOwnersForPr.mockResolvedValueOnce(['@jimmy']);
      config.assignees = ['@mike', '@julie'];
      config.assigneesFromCodeOwners = true;
      await prWorker.ensurePr(config);
      expect(platform.addAssignees).toHaveBeenCalledTimes(1);
      expect(platform.addAssignees.mock.calls).toMatchSnapshot();
    });
    it('should add reviewers even if assignees fails', async () => {
      platform.addAssignees.mockImplementationOnce(() => {
        throw new Error('some error');
      });
      config.assignees = ['@foo', 'bar'];
      config.reviewers = ['baz', '@boo'];
      const { prResult, pr } = await prWorker.ensurePr(config);
      expect(prResult).toEqual(PrResult.Created);
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
      const { prResult, pr } = await prWorker.ensurePr(config);
      expect(prResult).toEqual(PrResult.Created);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(platform.addAssignees).toHaveBeenCalledTimes(1);
      expect(platform.addReviewers).toHaveBeenCalledTimes(1);
    });
    it('should not add assignees and reviewers to new PR if automerging enabled regularly', async () => {
      config.assignees = ['bar'];
      config.reviewers = ['baz'];
      config.automerge = true;
      const { prResult, pr } = await prWorker.ensurePr(config);
      expect(prResult).toEqual(PrResult.Created);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(platform.addAssignees).toHaveBeenCalledTimes(0);
      expect(platform.addReviewers).toHaveBeenCalledTimes(0);
    });
    it('should add assignees and reviewers to new PR if automerging enabled but configured to always assign', async () => {
      config.assignees = ['bar'];
      config.reviewers = ['baz'];
      config.automerge = true;
      config.assignAutomerge = true;
      const { prResult, pr } = await prWorker.ensurePr(config);
      expect(prResult).toEqual(PrResult.Created);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(platform.addAssignees).toHaveBeenCalledTimes(1);
      expect(platform.addReviewers).toHaveBeenCalledTimes(1);
    });
    it('should add random sample of assignees and reviewers to new PR', async () => {
      config.assignees = ['foo', 'bar', 'baz'];
      config.assigneesSampleSize = 2;
      config.reviewers = ['baz', 'boo', 'bor'];
      config.reviewersSampleSize = 2;
      const { prResult, pr } = await prWorker.ensurePr(config);
      expect(prResult).toEqual(PrResult.Created);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(platform.addAssignees).toHaveBeenCalledTimes(1);
      const assignees = platform.addAssignees.mock.calls[0][1];
      expect(assignees).toHaveLength(2);
      expect(config.assignees).toEqual(expect.arrayContaining(assignees));

      expect(platform.addReviewers).toHaveBeenCalledTimes(1);
      const reviewers = platform.addReviewers.mock.calls[0][1];
      expect(reviewers).toHaveLength(2);
      expect(config.reviewers).toEqual(expect.arrayContaining(reviewers));
    });
    it('should not add any assignees or reviewers to new PR', async () => {
      config.assignees = ['foo', 'bar', 'baz'];
      config.assigneesSampleSize = 0;
      config.reviewers = ['baz', 'boo', 'bor'];
      config.reviewersSampleSize = 0;
      const { prResult, pr } = await prWorker.ensurePr(config);
      expect(prResult).toEqual(PrResult.Created);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(platform.addAssignees).toHaveBeenCalledTimes(0);
      expect(platform.addReviewers).toHaveBeenCalledTimes(0);
    });
    it('should add and deduplicate additionalReviewers on new PR', async () => {
      config.reviewers = ['@foo', 'bar'];
      config.additionalReviewers = ['bar', 'baz', '@boo'];
      const { prResult, pr } = await prWorker.ensurePr(config);
      expect(prResult).toEqual(PrResult.Created);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(platform.addReviewers).toHaveBeenCalledTimes(1);
      expect(platform.addReviewers.mock.calls).toMatchSnapshot();
    });
    it('should add and deduplicate additionalReviewers to empty reviewers on new PR', async () => {
      config.reviewers = [];
      config.additionalReviewers = ['bar', 'baz', '@boo', '@foo', 'bar'];
      const { prResult, pr } = await prWorker.ensurePr(config);
      expect(prResult).toEqual(PrResult.Created);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(platform.addReviewers).toHaveBeenCalledTimes(1);
      expect(platform.addReviewers.mock.calls).toMatchSnapshot();
    });
    it('should return unmodified existing PR', async () => {
      platform.getBranchPr.mockResolvedValueOnce(existingPr);
      config.semanticCommitScope = null;
      config.automerge = true;
      config.schedule = ['before 5am'];
      config.logJSON = await getChangeLogJSON(config);
      const { prResult, pr } = await prWorker.ensurePr(config);
      expect(prResult).toEqual(PrResult.NotUpdated);
      expect(platform.updatePr.mock.calls).toMatchSnapshot();
      expect(platform.updatePr).toHaveBeenCalledTimes(0);
      expect(pr).toMatchObject(existingPr);
    });
    it('should return unmodified existing PR if only whitespace changes', async () => {
      const modifiedPr = JSON.parse(
        JSON.stringify(existingPr).replace(' ', '  ').replace('\n', '\r\n')
      );
      platform.getBranchPr.mockResolvedValueOnce(modifiedPr);
      config.semanticCommitScope = null;
      config.automerge = true;
      config.schedule = ['before 5am'];
      config.logJSON = await getChangeLogJSON(config);
      const { prResult, pr } = await prWorker.ensurePr(config);
      expect(prResult).toEqual(PrResult.NotUpdated);
      expect(platform.updatePr).toHaveBeenCalledTimes(0);
      expect(pr).toMatchObject(modifiedPr);
    });
    it('should return modified existing PR', async () => {
      config.newValue = '1.2.0';
      config.automerge = true;
      config.schedule = ['before 5am'];
      config.logJSON = await getChangeLogJSON(config);
      platform.getBranchPr.mockResolvedValueOnce(existingPr);
      const { prResult, pr } = await prWorker.ensurePr(config);
      expect(prResult).toEqual(PrResult.NotUpdated);
      expect(pr).toMatchSnapshot();
    });
    it('should return modified existing PR title', async () => {
      config.newValue = '1.2.0';
      platform.getBranchPr.mockResolvedValueOnce({
        ...existingPr,
        title: 'wrong',
      });
      const { prResult, pr } = await prWorker.ensurePr(config);
      expect(prResult).toEqual(PrResult.Updated);
      expect(pr).toMatchSnapshot();
    });
    it('should create PR if branch tests failed', async () => {
      config.automerge = true;
      config.automergeType = 'branch';
      config.branchAutomergeFailureMessage = 'branch status error';
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.red);
      const { prResult, pr } = await prWorker.ensurePr(config);
      expect(prResult).toEqual(PrResult.Created);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
    });
    it('should create PR if branch automerging failed', async () => {
      config.automerge = true;
      config.automergeType = 'branch';
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.green);
      config.forcePr = true;
      const { prResult, pr } = await prWorker.ensurePr(config);
      expect(prResult).toEqual(PrResult.Created);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
    });
    it('should return no PR if branch automerging not failed', async () => {
      config.automerge = true;
      config.automergeType = 'branch';
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.yellow);
      git.getBranchLastCommitTime.mockResolvedValueOnce(new Date());
      const { prResult, pr } = await prWorker.ensurePr(config);
      expect(prResult).toEqual(PrResult.BlockedByBranchAutomerge);
      expect(pr).toBeUndefined();
    });
    it('should return PR if branch automerging taking too long', async () => {
      config.automerge = true;
      config.automergeType = 'branch';
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.yellow);
      git.getBranchLastCommitTime.mockResolvedValueOnce(new Date('2018-01-01'));
      const { prResult, pr } = await prWorker.ensurePr(config);
      expect(prResult).toEqual(PrResult.Created);
      expect(pr).toBeDefined();
    });
    it('should return no PR if stabilityStatus yellow', async () => {
      config.automerge = true;
      config.automergeType = 'branch';
      config.stabilityStatus = BranchStatus.yellow;
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.yellow);
      git.getBranchLastCommitTime.mockResolvedValueOnce(new Date('2018-01-01'));
      const { prResult, pr } = await prWorker.ensurePr(config);
      expect(prResult).toEqual(PrResult.BlockedByBranchAutomerge);
      expect(pr).toBeUndefined();
    });
    it('handles duplicate upgrades', async () => {
      config.upgrades.push(config.upgrades[0]);
      const { prResult, pr } = await prWorker.ensurePr(config);
      expect(prResult).toEqual(PrResult.Created);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
    });
    it('should create privateRepo PR if success', async () => {
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.green);
      config.prCreation = 'status-success';
      config.privateRepo = false;
      config.logJSON = await getChangeLogJSON(config);
      config.logJSON.project.gitlab = 'someproject';
      delete config.logJSON.project.github;
      const { prResult, pr } = await prWorker.ensurePr(config);
      expect(prResult).toEqual(PrResult.Created);
      expect(pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(platform.createPr.mock.calls[0]).toMatchSnapshot();
      existingPr.body = platform.createPr.mock.calls[0][0].prBody;
    });
    it('should create PR if waiting for not pending but artifactErrors', async () => {
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.yellow);
      git.getBranchLastCommitTime.mockResolvedValueOnce(new Date());
      config.prCreation = 'not-pending';
      config.artifactErrors = [{}];
      config.platform = PLATFORM_TYPE_GITLAB;
      const { prResult, pr } = await prWorker.ensurePr(config);
      expect(prResult).toEqual(PrResult.Created);
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

    it('should create a PR with set of labels and mergeable addLabels', async () => {
      config.labels = ['deps', 'renovate'];
      config.addLabels = ['deps', 'js'];
      const { prResult } = await prWorker.ensurePr(config);
      expect(prResult).toEqual(PrResult.Created);
      expect(platform.createPr.mock.calls[0][0]).toMatchObject({
        labels: ['deps', 'renovate', 'js'],
      });
    });
  });
});
