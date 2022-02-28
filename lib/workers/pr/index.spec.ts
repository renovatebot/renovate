import { getConfig, git, mocked, partial, platform } from '../../../test/util';
import { PlatformId } from '../../constants';
import type { Pr } from '../../platform/types';
import { BranchStatus } from '../../types';
import * as _limits from '../global/limits';
import type { BranchConfig } from '../types';
import * as prAutomerge from './automerge';
import * as _changelogHelper from './changelog';
import type { ChangeLogResult } from './changelog';
import * as codeOwners from './code-owners';
import * as prWorker from '.';
import type { EnsurePrResult, ResultWithPr, ResultWithoutPr } from '.';

const codeOwnersMock = mocked(codeOwners);
const changelogHelper = mocked(_changelogHelper);
const gitlabChangelogHelper = mocked(_changelogHelper);
const limits = mocked(_limits);

jest.mock('../../util/git');
jest.mock('./changelog');
jest.mock('./code-owners');
jest.mock('../global/limits');

function setupChangelogMock() {
  const resultValue = {
    project: {
      type: 'github',
      baseUrl: 'https://github.com/',
      repository: 'renovateapp/dummy',
      sourceUrl: 'https://github.com/renovateapp/dummy',
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
  } as ChangeLogResult;
  const errorValue = {
    error: _changelogHelper.ChangeLogError.MissingGithubToken,
  };
  changelogHelper.getChangeLogJSON.mockResolvedValueOnce(resultValue);
  changelogHelper.getChangeLogJSON.mockResolvedValueOnce(errorValue);
  changelogHelper.getChangeLogJSON.mockResolvedValue(resultValue);
}

function setupGitlabChangelogMock() {
  const resultValue = {
    project: {
      type: 'gitlab',
      baseUrl: 'https://gitlab.com/',
      repository: 'renovateapp/gitlabdummy',
      sourceUrl: 'https://gitlab.com/renovateapp/gitlabdummy',
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
          url: 'https://gitlab.com/renovateapp/gitlabdummy/compare/v1.0.0...v1.1.0',
        },
        compare: {
          url: 'https://gitlab.com/renovateapp/gitlabdummy/compare/v1.0.0...v1.1.0',
        },
      },
    ],
  } as ChangeLogResult;
  const errorValue = {
    error: _changelogHelper.ChangeLogError.MissingGithubToken,
  };
  gitlabChangelogHelper.getChangeLogJSON.mockResolvedValueOnce(resultValue);
  gitlabChangelogHelper.getChangeLogJSON.mockResolvedValueOnce(errorValue);
  gitlabChangelogHelper.getChangeLogJSON.mockResolvedValue(resultValue);
}

function isResultWithPr(value: EnsurePrResult): asserts value is ResultWithPr {
  if (value.type !== 'with-pr') {
    throw new TypeError();
  }
}

function isResultWithoutPr(
  value: EnsurePrResult
): asserts value is ResultWithoutPr {
  if (value.type !== 'without-pr') {
    throw new TypeError();
  }
}

describe('workers/pr/index', () => {
  describe('checkAutoMerge(pr, config)', () => {
    let config: BranchConfig;
    let pr: Pr;
    beforeEach(() => {
      config = partial<BranchConfig>({
        ...getConfig(),
      });
      pr = partial<Pr>({});
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
      pr.cannotMergeReason = 'some reason';
      await prAutomerge.checkAutoMerge(pr, config);
      expect(platform.mergePr).toHaveBeenCalledTimes(0);
    });
    it('should not automerge if enabled and pr is unmergeable', async () => {
      config.automerge = true;
      git.isBranchConflicted.mockResolvedValueOnce(true);
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
      body: 'Some body<!-- Reviewable:start -->something<!-- Reviewable:end -->\n\n',
    } as never;
    beforeEach(() => {
      jest.resetAllMocks();
      setupChangelogMock();
      config = partial<BranchConfig>({
        ...getConfig(),
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
      platform.massageMarkdown.mockImplementation((input) => input);
    });
    afterEach(() => {
      jest.clearAllMocks();
    });
    it('should return PR if update fails', async () => {
      platform.updatePr.mockImplementationOnce(() => {
        throw new Error('oops');
      });
      config.newValue = '1.2.0';
      platform.getBranchPr.mockResolvedValueOnce(existingPr);
      const result = await prWorker.ensurePr(config);
      isResultWithPr(result);
      expect(result.pr).toBeDefined();
    });
    it('should return null if waiting for success', async () => {
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.red);
      config.prCreation = 'status-success';
      const result = await prWorker.ensurePr(config);
      isResultWithoutPr(result);
      expect(result.prBlockedBy).toBe('AwaitingTests');
    });
    it('should return needs-approval if prCreation set to approval', async () => {
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.green);
      config.prCreation = 'approval';
      const result = await prWorker.ensurePr(config);
      isResultWithoutPr(result);
      expect(result.prBlockedBy).toBe('NeedsApproval');
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
      const result = await prWorker.ensurePr(config);
      isResultWithPr(result);
      expect(result.pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(platform.createPr.mock.calls[0]).toMatchSnapshot([
        {
          prTitle: 'Update dependency dummy to v1.1.0',
          sourceBranch: 'renovate/gitlabdummy-1.x',
        },
      ]);
      existingPr.body = platform.createPr.mock.calls[0][0].prBody;
      config.branchName = 'renovate/dummy-1.x';
      config.depName = 'dummy';
      config.sourceUrl = 'https://github.com/renovateapp/dummy';
      config.changelogUrl = 'https://github.com/renovateapp/dummy/changelog.md';
    });
    it('should create PR if success', async () => {
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.green);
      config.logJSON = await changelogHelper.getChangeLogJSON(config);
      config.prCreation = 'status-success';
      config.automerge = true;
      config.schedule = ['before 5am'];
      const result = await prWorker.ensurePr(config);
      isResultWithPr(result);
      expect(result.pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(platform.createPr.mock.calls[0]).toMatchSnapshot([
        {
          prTitle: 'Update dependency dummy to v1.1.0',
          sourceBranch: 'renovate/dummy-1.x',
        },
      ]);
      existingPr.body = platform.createPr.mock.calls[0][0].prBody;
    });
    it('should not create PR if limit is reached', async () => {
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.green);
      config.logJSON = await changelogHelper.getChangeLogJSON(config);
      config.prCreation = 'status-success';
      config.automerge = true;
      config.schedule = ['before 5am'];
      limits.isLimitReached.mockReturnValueOnce(true);
      const result = await prWorker.ensurePr(config);
      isResultWithoutPr(result);
      expect(result.prBlockedBy).toBe('RateLimited');
      expect(platform.createPr.mock.calls).toBeEmpty();
    });
    it('should create PR if limit is reached but dashboard checked', async () => {
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.green);
      config.logJSON = await changelogHelper.getChangeLogJSON(config);
      config.prCreation = 'status-success';
      config.automerge = true;
      config.schedule = ['before 5am'];
      limits.isLimitReached.mockReturnValueOnce(true);
      await prWorker.ensurePr({
        ...config,
        dependencyDashboardChecks: { 'renovate/dummy-1.x': 'true' },
      });
      expect(platform.createPr).toHaveBeenCalled();
    });
    it('should create group PR', async () => {
      const depsWithSameNotesSourceUrl = ['e', 'f'];
      const depsWithSameSourceUrl = ['g', 'h'];
      config.upgrades = config.upgrades.concat([
        {
          depName: 'a',
          displayFrom: 'zzzzzz',
          displayTo: 'aaaaaaa',
          prBodyNotes: ['note 1', 'note 2'],
          prBodyDefinitions: {
            Package: '{{{depNameLinked}}}',
            Change: '`{{{displayFrom}}}` -> `{{{displayTo}}}`',
          },
        },
        {
          depName: 'b',
          newDigestShort: 'bbbbbbb',
          displayFrom: 'some_old_value',
          displayTo: 'some_new_value',
          updateType: 'pin',
          prBodyDefinitions: {
            Package: '{{{depNameLinked}}}',
            Change: '`{{{displayFrom}}}` -> `{{{displayTo}}}`',
            Update: '{{{updateType}}}',
          },
        },
        {
          depName: 'c',
          gitRef: 'ccccccc',
          prBodyDefinitions: {
            Package: '{{{depNameLinked}}}',
          },
        },
        {
          depName: 'd',
          updateType: 'lockFileMaintenance',
          prBodyNotes: ['{{#if foo}}'],
          prBodyDefinitions: {
            Package: '{{{depNameLinked}}}',
            Update: '{{{updateType}}}',
            Change: 'All locks refreshed',
          },
        },
        {
          depName: depsWithSameNotesSourceUrl[0],
          updateType: 'lockFileMaintenance',
          prBodyNotes: ['{{#if foo}}'],
          prBodyDefinitions: {
            Package: '{{{depNameLinked}}}',
            Update: '{{{updateType}}}',
            Change: 'All locks refreshed',
          },
        },
        {
          depName: depsWithSameNotesSourceUrl[1],
          updateType: 'lockFileMaintenance',
          prBodyNotes: ['{{#if foo}}'],
          prBodyDefinitions: {
            Package: '{{{depNameLinked}}}',
            Update: '{{{updateType}}}',
            Change: 'All locks refreshed',
          },
        },
        {
          depName: depsWithSameSourceUrl[0],
          updateType: 'lockFileMaintenance',
          prBodyNotes: ['{{#if foo}}'],
          prBodyDefinitions: {
            Package: '{{{depNameLinked}}}',
            Update: '{{{updateType}}}',
            Change: 'All locks refreshed',
          },
        },
        {
          depName: depsWithSameSourceUrl[1],
          updateType: 'lockFileMaintenance',
          prBodyNotes: ['{{#if foo}}'],
          prBodyDefinitions: {
            Package: '{{{depNameLinked}}}',
            Update: '{{{updateType}}}',
            Change: 'All locks refreshed',
          },
        },
      ] as never);
      config.updateType = 'lockFileMaintenance';
      config.recreateClosed = true;
      config.rebaseWhen = 'never';
      for (const upgrade of config.upgrades) {
        upgrade.logJSON = await changelogHelper.getChangeLogJSON(upgrade);

        if (depsWithSameNotesSourceUrl.includes(upgrade.depName)) {
          upgrade.sourceDirectory = `packages/${upgrade.depName}`;

          upgrade.logJSON = {
            ...upgrade.logJSON,
            project: {
              ...upgrade.logJSON.project,
              repository: 'renovateapp/dummymonorepo',
            },
            versions: upgrade.logJSON.versions.map((V) => {
              return {
                ...V,
                releaseNotes: {
                  ...V.releaseNotes,
                  notesSourceUrl:
                    'https://github.com/renovateapp/dummymonorepo/blob/changelogfile.md',
                },
              };
            }),
          };
        }

        if (depsWithSameSourceUrl.includes(upgrade.depName)) {
          upgrade.sourceDirectory = `packages/${upgrade.depName}`;

          upgrade.logJSON = {
            ...upgrade.logJSON,
            project: {
              ...upgrade.logJSON.project,
              repository: 'renovateapp/anotherdummymonorepo',
            },
            versions: upgrade.logJSON.versions.map((V) => {
              return {
                ...V,
                releaseNotes: {
                  ...V.releaseNotes,
                  notesSourceUrl: null,
                },
              };
            }),
          };
        }
      }
      const result = await prWorker.ensurePr(config);
      isResultWithPr(result);
      expect(result.pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(platform.createPr.mock.calls[0]).toMatchSnapshot([
        {
          prTitle: 'Update dependency dummy to v1.1.0',
          sourceBranch: 'renovate/dummy-1.x',
        },
      ]);
    });
    it('should add note about Pin', async () => {
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.green);
      config.prCreation = 'status-success';
      config.isPin = true;
      config.updateType = 'pin';
      config.schedule = ['before 5am'];
      config.timezone = 'some timezone';
      config.rebaseWhen = 'behind-base-branch';
      config.logJSON = await changelogHelper.getChangeLogJSON(config);
      const result = await prWorker.ensurePr(config);
      isResultWithPr(result);
      expect(result.pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(platform.createPr.mock.calls[0]).toMatchSnapshot([
        {
          prTitle: 'Update dependency dummy to v1.1.0',
          sourceBranch: 'renovate/dummy-1.x',
        },
      ]);
      expect(platform.createPr.mock.calls[0][0].prBody).toContain(
        'this Pin PR'
      );
    });
    it('should return null if creating PR fails', async () => {
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.green);
      platform.createPr.mockImplementationOnce(() => {
        throw new Error('Validation Failed (422)');
      });
      config.prCreation = 'status-success';
      const result = await prWorker.ensurePr(config);
      isResultWithoutPr(result);
      expect(result.prBlockedBy).toBe('Error');
    });
    it('should return null if waiting for not pending', async () => {
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.yellow);
      git.getBranchLastCommitTime.mockImplementationOnce(() =>
        Promise.resolve(new Date())
      );
      config.prCreation = 'not-pending';
      const result = await prWorker.ensurePr(config);
      isResultWithoutPr(result);
      expect(result.prBlockedBy).toBe('AwaitingTests');
    });
    it('should not create PR if waiting for not pending with stabilityStatus yellow', async () => {
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.yellow);
      git.getBranchLastCommitTime.mockImplementationOnce(() =>
        Promise.resolve(new Date())
      );
      config.prCreation = 'not-pending';
      config.stabilityStatus = BranchStatus.yellow;
      const result = await prWorker.ensurePr(config);
      isResultWithoutPr(result);
      expect(result.prBlockedBy).toBe('AwaitingTests');
    });
    it('should create PR if pending timeout hit', async () => {
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.yellow);
      git.getBranchLastCommitTime.mockImplementationOnce(() =>
        Promise.resolve(new Date('2017-01-01'))
      );
      config.prCreation = 'not-pending';
      config.stabilityStatus = BranchStatus.yellow;
      const result = await prWorker.ensurePr(config);
      isResultWithPr(result);
      expect(result.pr).toMatchObject({ displayNumber: 'New Pull Request' });
    });
    it('should create PR if no longer pending', async () => {
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.red);
      config.prCreation = 'not-pending';
      const result = await prWorker.ensurePr(config);
      isResultWithPr(result);
      expect(result.pr).toMatchObject({ displayNumber: 'New Pull Request' });
    });
    it('should create new branch if none exists', async () => {
      const result = await prWorker.ensurePr(config);
      isResultWithPr(result);
      expect(result.pr).toMatchObject({ displayNumber: 'New Pull Request' });
    });
    it('should add assignees and reviewers to new PR', async () => {
      config.assignees = ['@foo', 'bar'];
      config.reviewers = ['baz', '@boo'];
      const result = await prWorker.ensurePr(config);
      isResultWithPr(result);
      expect(result.pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(platform.addAssignees).toHaveBeenCalledTimes(1);
      expect(platform.addAssignees.mock.calls).toMatchSnapshot();
      expect(platform.addReviewers).toHaveBeenCalledTimes(1);
      expect(platform.addReviewers.mock.calls).toMatchSnapshot();
    });
    it('should filter assignees and reviewers based on their availability', async () => {
      config.assignees = ['@foo', 'bar'];
      config.reviewers = ['foo', '@bar', 'foo@bar.com'];
      config.filterUnavailableUsers = true;
      // optional function is undefined by jest
      platform.filterUnavailableUsers = jest.fn();
      platform.filterUnavailableUsers.mockResolvedValue(['foo']);
      await prWorker.ensurePr(config);
      expect(platform.addAssignees.mock.calls).toMatchSnapshot();
      expect(platform.addReviewers.mock.calls).toMatchSnapshot();
      expect(platform.filterUnavailableUsers.mock.calls).toMatchSnapshot();
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
      const result = await prWorker.ensurePr(config);
      isResultWithPr(result);
      expect(result.pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(platform.addAssignees).toHaveBeenCalledTimes(1);
      expect(platform.addReviewers).toHaveBeenCalledTimes(1);
    });
    it('should handled failed reviewers add', async () => {
      platform.addReviewers.mockImplementationOnce(() => {
        throw new Error('some error');
      });
      config.assignees = ['@foo', 'bar'];
      config.reviewers = ['baz', '@boo'];
      const result = await prWorker.ensurePr(config);
      isResultWithPr(result);
      expect(result.pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(platform.addAssignees).toHaveBeenCalledTimes(1);
      expect(platform.addReviewers).toHaveBeenCalledTimes(1);
    });
    it('should not add assignees and reviewers to new PR if automerging enabled regularly', async () => {
      config.assignees = ['bar'];
      config.reviewers = ['baz'];
      config.automerge = true;
      const result = await prWorker.ensurePr(config);
      isResultWithPr(result);
      expect(result.pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(platform.addAssignees).toHaveBeenCalledTimes(0);
      expect(platform.addReviewers).toHaveBeenCalledTimes(0);
    });
    it('should add assignees and reviewers to new PR if automerging enabled but configured to always assign', async () => {
      config.assignees = ['bar'];
      config.reviewers = ['baz'];
      config.automerge = true;
      config.assignAutomerge = true;
      const result = await prWorker.ensurePr(config);
      isResultWithPr(result);
      expect(result.pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(platform.addAssignees).toHaveBeenCalledTimes(1);
      expect(platform.addReviewers).toHaveBeenCalledTimes(1);
    });
    it('should add random sample of assignees and reviewers to new PR', async () => {
      config.assignees = ['foo', 'bar', 'baz'];
      config.assigneesSampleSize = 2;
      config.reviewers = ['baz', 'boo', 'bor'];
      config.reviewersSampleSize = 2;
      const result = await prWorker.ensurePr(config);
      isResultWithPr(result);
      expect(result.pr).toMatchObject({ displayNumber: 'New Pull Request' });
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
      const result = await prWorker.ensurePr(config);
      isResultWithPr(result);
      expect(result.pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(platform.addAssignees).toHaveBeenCalledTimes(0);
      expect(platform.addReviewers).toHaveBeenCalledTimes(0);
    });
    it('should add and deduplicate additionalReviewers on new PR', async () => {
      config.reviewers = ['@foo', 'bar'];
      config.additionalReviewers = ['bar', 'baz', '@boo'];
      const result = await prWorker.ensurePr(config);
      isResultWithPr(result);
      expect(result.pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(platform.addReviewers).toHaveBeenCalledTimes(1);
      expect(platform.addReviewers.mock.calls).toMatchSnapshot();
    });
    it('should add and deduplicate additionalReviewers to empty reviewers on new PR', async () => {
      config.reviewers = [];
      config.additionalReviewers = ['bar', 'baz', '@boo', '@foo', 'bar'];
      const result = await prWorker.ensurePr(config);
      isResultWithPr(result);
      expect(result.pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(platform.addReviewers).toHaveBeenCalledTimes(1);
      expect(platform.addReviewers.mock.calls).toMatchSnapshot();
    });
    it('should return unmodified existing PR', async () => {
      platform.getBranchPr.mockResolvedValueOnce(existingPr);
      config.semanticCommitScope = null;
      config.automerge = true;
      config.schedule = ['before 5am'];
      config.logJSON = await changelogHelper.getChangeLogJSON(config);
      const result = await prWorker.ensurePr(config);
      isResultWithPr(result);
      expect(platform.updatePr.mock.calls).toMatchSnapshot();
      expect(platform.updatePr).toHaveBeenCalledTimes(0);
      expect(result.pr).toMatchObject(existingPr);
    });
    it('should return unmodified existing PR if only whitespace changes', async () => {
      const modifiedPr = JSON.parse(
        JSON.stringify(existingPr).replace(' ', '  ').replace('\n', '\r\n')
      );
      platform.getBranchPr.mockResolvedValueOnce(modifiedPr);
      config.semanticCommitScope = null;
      config.automerge = true;
      config.schedule = ['before 5am'];
      config.logJSON = await changelogHelper.getChangeLogJSON(config);
      const result = await prWorker.ensurePr(config);
      isResultWithPr(result);
      expect(platform.updatePr).toHaveBeenCalledTimes(0);
      expect(result.pr).toMatchObject(modifiedPr);
    });
    it('should return modified existing PR', async () => {
      config.newValue = '1.2.0';
      config.automerge = true;
      config.schedule = ['before 5am'];
      config.logJSON = await changelogHelper.getChangeLogJSON(config);
      platform.getBranchPr.mockResolvedValueOnce(existingPr);
      const result = await prWorker.ensurePr(config);
      isResultWithPr(result);
      expect(result.pr).toMatchSnapshot({
        displayNumber: 'Existing PR',
        title: 'Update dependency dummy to v1.1.0',
      });
    });
    it('should return modified existing PR title', async () => {
      config.newValue = '1.2.0';
      platform.getBranchPr.mockResolvedValueOnce({
        ...existingPr,
        title: 'wrong',
      });
      const result = await prWorker.ensurePr(config);
      isResultWithPr(result);
      expect(result.pr).toMatchSnapshot({
        displayNumber: 'Existing PR',
        title: 'wrong',
      });
    });
    it('should create PR if branch tests failed', async () => {
      config.automerge = true;
      config.automergeType = 'branch';
      config.branchAutomergeFailureMessage = 'branch status error';
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.red);
      const result = await prWorker.ensurePr(config);
      isResultWithPr(result);
      expect(result.pr).toMatchObject({ displayNumber: 'New Pull Request' });
    });
    it('should create PR if branch automerging failed', async () => {
      config.automerge = true;
      config.automergeType = 'branch';
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.green);
      config.forcePr = true;
      const result = await prWorker.ensurePr(config);
      isResultWithPr(result);
      expect(result.pr).toMatchObject({ displayNumber: 'New Pull Request' });
    });
    it('should return no PR if branch automerging not failed', async () => {
      config.automerge = true;
      config.automergeType = 'branch';
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.yellow);
      git.getBranchLastCommitTime.mockResolvedValueOnce(new Date());
      const result = await prWorker.ensurePr(config);
      isResultWithoutPr(result);
      expect(result.prBlockedBy).toBe('BranchAutomerge');
    });
    it('should return PR if branch automerging taking too long', async () => {
      config.automerge = true;
      config.automergeType = 'branch';
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.yellow);
      git.getBranchLastCommitTime.mockResolvedValueOnce(new Date('2018-01-01'));
      const result = await prWorker.ensurePr(config);
      isResultWithPr(result);
      expect(result.pr).toBeDefined();
    });
    it('should return no PR if stabilityStatus yellow', async () => {
      config.automerge = true;
      config.automergeType = 'branch';
      config.stabilityStatus = BranchStatus.yellow;
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.yellow);
      git.getBranchLastCommitTime.mockResolvedValueOnce(new Date('2018-01-01'));
      const result = await prWorker.ensurePr(config);
      isResultWithoutPr(result);
      expect(result.prBlockedBy).toBe('BranchAutomerge');
    });
    it('handles duplicate upgrades', async () => {
      config.upgrades.push(config.upgrades[0]);
      const result = await prWorker.ensurePr(config);
      isResultWithPr(result);
      expect(result).toMatchObject({ displayNumber: 'New Pull Request' });
    });
    it('should create privateRepo PR if success', async () => {
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.green);
      config.prCreation = 'status-success';
      config.privateRepo = false;
      config.logJSON = await changelogHelper.getChangeLogJSON(config);
      config.logJSON.project.repository = 'someproject';
      const result = await prWorker.ensurePr(config);
      isResultWithPr(result);
      expect(result.pr).toMatchObject({ displayNumber: 'New Pull Request' });
      expect(platform.createPr.mock.calls[0]).toMatchSnapshot();
      existingPr.body = platform.createPr.mock.calls[0][0].prBody;
    });
    it('should create PR if waiting for not pending but artifactErrors', async () => {
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.yellow);
      git.getBranchLastCommitTime.mockResolvedValueOnce(new Date());
      config.prCreation = 'not-pending';
      config.artifactErrors = [{}];
      config.platform = PlatformId.Gitlab;
      const result = await prWorker.ensurePr(config);
      isResultWithPr(result);
      expect(result.pr).toMatchObject({ displayNumber: 'New Pull Request' });
    });

    it('should trigger GitLab automerge when configured', async () => {
      config.platformAutomerge = true;
      config.gitLabIgnoreApprovals = true;
      config.automerge = true;
      await prWorker.ensurePr(config);
      const args = platform.createPr.mock.calls[0];
      expect(args[0].platformOptions).toMatchObject({
        usePlatformAutomerge: true,
        gitLabIgnoreApprovals: true,
      });
    });

    it('should create a PR with set of labels and mergeable addLabels', async () => {
      config.labels = ['deps', 'renovate'];
      config.addLabels = ['deps', 'js'];
      const result = await prWorker.ensurePr(config);
      isResultWithPr(result);
      expect(result.pr).toBeDefined();
      expect(platform.createPr.mock.calls[0][0]).toMatchObject({
        labels: ['deps', 'renovate', 'js'],
      });
    });
  });

  describe('prepareLabels(config)', () => {
    it('returns empty array if no labels are configured', () => {
      const result = prWorker.prepareLabels({});
      expect(result).toBeArrayOfSize(0);
    });

    it('only labels', () => {
      const result = prWorker.prepareLabels({ labels: ['labelA', 'labelB'] });
      expect(result).toBeArrayOfSize(2);
      expect(result).toEqual(['labelA', 'labelB']);
    });

    it('only addLabels', () => {
      const result = prWorker.prepareLabels({
        addLabels: ['labelA', 'labelB'],
      });
      expect(result).toBeArrayOfSize(2);
      expect(result).toEqual(['labelA', 'labelB']);
    });

    it('merge labels and addLabels', () => {
      const result = prWorker.prepareLabels({
        labels: ['labelA', 'labelB'],
        addLabels: ['labelC'],
      });
      expect(result).toBeArrayOfSize(3);
      expect(result).toEqual(['labelA', 'labelB', 'labelC']);
    });

    it('deduplicate merged labels and addLabels', () => {
      const result = prWorker.prepareLabels({
        labels: ['labelA', 'labelB'],
        addLabels: ['labelB', 'labelC'],
      });
      expect(result).toBeArrayOfSize(3);
      expect(result).toEqual(['labelA', 'labelB', 'labelC']);
    });

    it('empty labels ignored', () => {
      const result = prWorker.prepareLabels({
        labels: ['labelA', ''],
        addLabels: [' ', 'labelB'],
      });
      expect(result).toBeArrayOfSize(2);
      expect(result).toEqual(['labelA', 'labelB']);
    });

    it('null labels ignored', () => {
      const result = prWorker.prepareLabels({
        labels: ['labelA', null],
        // an empty space between two commas in an array is categorized as a null value
        // eslint-disable-next-line no-sparse-arrays
        addLabels: ['labelB', '', undefined, , ,],
      });
      expect(result).toBeArrayOfSize(2);
      expect(result).toEqual(['labelA', 'labelB']);
    });

    it('template labels', () => {
      const result = prWorker.prepareLabels({
        labels: ['datasource-{{{datasource}}}'],
        datasource: 'npm',
      });
      expect(result).toBeArrayOfSize(1);
      expect(result).toEqual(['datasource-npm']);
    });

    it('template labels with empty datasource', () => {
      const result = prWorker.prepareLabels({
        labels: ['{{{datasource}}}', ' {{{datasource}}} '],
        datasource: null,
      });
      expect(result).toBeArrayOfSize(0);
      expect(result).toEqual([]);
    });
  });
});
