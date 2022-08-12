import { DateTime } from 'luxon';
import { git, logger, mocked, platform } from '../../../../../test/util';
import { GlobalConfig } from '../../../../config/global';
import {
  PLATFORM_INTEGRATION_UNAUTHORIZED,
  PLATFORM_RATE_LIMIT_EXCEEDED,
  REPOSITORY_CHANGED,
} from '../../../../constants/error-messages';
import * as _comment from '../../../../modules/platform/comment';
import { getPrBodyStruct } from '../../../../modules/platform/pr-body';
import type { Pr } from '../../../../modules/platform/types';
import { BranchStatus, PrState } from '../../../../types';
import { ExternalHostError } from '../../../../types/errors/external-host-error';
import * as _limits from '../../../global/limits';
import type { BranchConfig, BranchUpgradeConfig } from '../../../types';
import * as _statusChecks from '../branch/status-checks';
import * as _prBody from './body';
import {
  ChangeLogChange,
  ChangeLogError,
  ChangeLogRelease,
} from './changelog/types';
import * as _participants from './participants';
import { ensurePr } from '.';

jest.mock('../../../../util/git');
jest.mock('../../changelog');

jest.mock('../../../global/limits');
const limits = mocked(_limits);

jest.mock('../branch/status-checks');
const checks = mocked(_statusChecks);

jest.mock('./body');
const prBody = mocked(_prBody);

jest.mock('./participants');
const participants = mocked(_participants);

jest.mock('../../../../modules/platform/comment');
const comment = mocked(_comment);

describe('workers/repository/update/pr/index', () => {
  describe('ensurePr', () => {
    const number = 123;
    const sourceBranch = 'renovate-branch';
    const prTitle = 'Some title';
    const body = 'Some body';
    const bodyStruct = getPrBodyStruct(body);

    const pr: Pr = {
      number,
      sourceBranch,
      title: prTitle,
      bodyStruct,
      state: PrState.Open,
    };

    const config: BranchConfig = {
      manager: 'some-manager',
      branchName: sourceBranch,
      upgrades: [],
      prTitle,
    };

    beforeEach(() => {
      jest.resetAllMocks();
      GlobalConfig.reset();
      prBody.getPrBody.mockResolvedValue(body);
    });

    describe('Create', () => {
      it('creates PR', async () => {
        platform.createPr.mockResolvedValueOnce(pr);

        const res = await ensurePr(config);

        expect(res).toEqual({ type: 'with-pr', pr });
        expect(limits.incLimitedValue).toHaveBeenCalledOnce();
        expect(limits.incLimitedValue).toHaveBeenCalledWith(
          limits.Limit.PullRequests
        );
        expect(logger.logger.info).toHaveBeenCalledWith(
          { pr: pr.number, prTitle },
          'PR created'
        );
      });

      it('aborts PR creation once limit is exceeded', async () => {
        platform.createPr.mockResolvedValueOnce(pr);
        limits.isLimitReached.mockReturnValueOnce(true);

        config.fetchReleaseNotes = true;

        const res = await ensurePr(config);

        expect(res).toEqual({ type: 'without-pr', prBlockedBy: 'RateLimited' });
        expect(platform.createPr).not.toHaveBeenCalled();
      });

      it('ignores PR limits on vulnerability alert', async () => {
        platform.createPr.mockResolvedValueOnce(pr);
        limits.isLimitReached.mockReturnValueOnce(true);

        const res = await ensurePr({ ...config, isVulnerabilityAlert: true });

        expect(res).toEqual({ type: 'with-pr', pr });
        expect(platform.createPr).toHaveBeenCalled();
      });

      it('creates rollback PR', async () => {
        platform.createPr.mockResolvedValueOnce(pr);

        const res = await ensurePr({ ...config, updateType: 'rollback' });

        expect(res).toEqual({ type: 'with-pr', pr });
        expect(logger.logger.info).toHaveBeenCalledWith('Creating Rollback PR');
      });

      it('skips PR creation due to non-green branch check', async () => {
        checks.resolveBranchStatus.mockResolvedValueOnce(BranchStatus.yellow);

        const res = await ensurePr({ ...config, prCreation: 'status-success' });

        expect(res).toEqual({
          type: 'without-pr',
          prBlockedBy: 'AwaitingTests',
        });
      });

      it('creates PR for green branch checks', async () => {
        checks.resolveBranchStatus.mockResolvedValueOnce(BranchStatus.green);
        platform.createPr.mockResolvedValueOnce(pr);

        const res = await ensurePr({ ...config, prCreation: 'status-success' });

        expect(res).toEqual({ type: 'with-pr', pr });
        expect(platform.createPr).toHaveBeenCalled();
      });

      it('skips PR creation for unapproved dependencies', async () => {
        checks.resolveBranchStatus.mockResolvedValueOnce(BranchStatus.yellow);

        const res = await ensurePr({ ...config, prCreation: 'approval' });

        expect(res).toEqual({
          type: 'without-pr',
          prBlockedBy: 'NeedsApproval',
        });
      });

      it('skips PR creation before prNotPendingHours is hit', async () => {
        const now = DateTime.now();
        const then = now.minus({ hours: 1 });

        checks.resolveBranchStatus.mockResolvedValueOnce(BranchStatus.yellow);
        git.getBranchLastCommitTime.mockResolvedValueOnce(then.toJSDate());

        const res = await ensurePr({
          ...config,
          prCreation: 'not-pending',
          prNotPendingHours: 2,
        });

        expect(res).toEqual({
          type: 'without-pr',
          prBlockedBy: 'AwaitingTests',
        });
      });

      it('skips PR creation due to stabilityStatus', async () => {
        const now = DateTime.now();
        const then = now.minus({ hours: 1 });

        checks.resolveBranchStatus.mockResolvedValueOnce(BranchStatus.yellow);
        git.getBranchLastCommitTime.mockResolvedValueOnce(then.toJSDate());

        const res = await ensurePr({
          ...config,
          prCreation: 'not-pending',
          stabilityStatus: BranchStatus.green,
        });

        expect(res).toEqual({
          type: 'without-pr',
          prBlockedBy: 'AwaitingTests',
        });
      });

      it('creates PR after prNotPendingHours is hit', async () => {
        const now = DateTime.now();
        const then = now.minus({ hours: 2 });

        checks.resolveBranchStatus.mockResolvedValueOnce(BranchStatus.yellow);
        git.getBranchLastCommitTime.mockResolvedValueOnce(then.toJSDate());
        platform.createPr.mockResolvedValueOnce(pr);

        const res = await ensurePr({
          ...config,
          prCreation: 'not-pending',
          prNotPendingHours: 1,
        });

        expect(res).toEqual({ type: 'with-pr', pr });
      });

      describe('Error handling', () => {
        it('handles unknown error', async () => {
          const err = new Error('unknown');
          platform.createPr.mockRejectedValueOnce(err);

          const res = await ensurePr(config);

          expect(res).toEqual({ type: 'without-pr', prBlockedBy: 'Error' });
        });

        it('handles error for PR that already exists', async () => {
          const err: Error & { body?: unknown } = new Error('unknown');
          err.body = {
            message: 'Validation failed',
            errors: [{ message: 'A pull request already exists' }],
          };
          platform.createPr.mockRejectedValueOnce(err);

          const res = await ensurePr(config);

          expect(res).toEqual({ type: 'without-pr', prBlockedBy: 'Error' });
          expect(logger.logger.warn).toHaveBeenCalledWith(
            'A pull requests already exists'
          );
        });

        it('deletes branch on 502 error', async () => {
          const err: Error & { statusCode?: number } = new Error('unknown');
          err.statusCode = 502;
          platform.createPr.mockRejectedValueOnce(err);

          const res = await ensurePr(config);

          expect(res).toEqual({ type: 'without-pr', prBlockedBy: 'Error' });
          expect(git.deleteBranch).toHaveBeenCalledWith('renovate-branch');
        });
      });
    });

    describe('Update', () => {
      it('updates PR due to title change', async () => {
        const changedPr: Pr = { ...pr, title: 'Another title' };
        platform.getBranchPr.mockResolvedValueOnce(changedPr);

        const res = await ensurePr(config);

        expect(res).toEqual({ type: 'with-pr', pr: changedPr });
        expect(platform.updatePr).toHaveBeenCalled();
        expect(platform.createPr).not.toHaveBeenCalled();
        expect(logger.logger.info).toHaveBeenCalledWith(
          { pr: changedPr.number, prTitle },
          `PR updated`
        );
      });

      it('updates PR due to body change', async () => {
        const changedPr: Pr = {
          ...pr,
          bodyStruct: getPrBodyStruct(`${body} updated`),
        };
        platform.getBranchPr.mockResolvedValueOnce(changedPr);

        const res = await ensurePr(config);

        expect(res).toEqual({ type: 'with-pr', pr: changedPr });
        expect(platform.updatePr).toHaveBeenCalled();
        expect(platform.createPr).not.toHaveBeenCalled();
      });

      it('ignores reviewable content ', async () => {
        // See: https://reviewable.io/

        const reviewableContent =
          '<!-- Reviewable:start -->something<!-- Reviewable:end -->';
        const changedPr: Pr = {
          ...pr,
          bodyStruct: getPrBodyStruct(`${body}${reviewableContent}`),
        };
        platform.getBranchPr.mockResolvedValueOnce(changedPr);

        const res = await ensurePr(config);

        expect(res).toEqual({ type: 'with-pr', pr: changedPr });
        expect(platform.updatePr).not.toHaveBeenCalled();
        expect(platform.createPr).not.toHaveBeenCalled();
      });
    });

    describe('dry-run', () => {
      beforeEach(() => {
        GlobalConfig.set({ dryRun: true });
      });

      it('dry-runs PR creation', async () => {
        platform.createPr.mockResolvedValueOnce(pr);

        const res = await ensurePr(config);

        expect(res).toEqual({
          type: 'with-pr',
          pr: { displayNumber: 'Dry run PR', number: 0 },
        });
        expect(platform.updatePr).not.toHaveBeenCalled();
        expect(platform.createPr).not.toHaveBeenCalled();
        expect(logger.logger.info).toHaveBeenCalledWith(
          `DRY-RUN: Would create PR: ${prTitle}`
        );
      });

      it('dry-runs PR update', async () => {
        const changedPr: Pr = { ...pr, title: 'Another title' };
        platform.getBranchPr.mockResolvedValueOnce(changedPr);

        const res = await ensurePr(config);

        expect(res).toEqual({ type: 'with-pr', pr: changedPr });
        expect(platform.updatePr).not.toHaveBeenCalled();
        expect(platform.createPr).not.toHaveBeenCalled();
        expect(logger.logger.info).toHaveBeenCalledWith(
          `DRY-RUN: Would update PR #${pr.number}`
        );
      });

      it('skips automerge failure comment', async () => {
        platform.createPr.mockResolvedValueOnce(pr);
        checks.resolveBranchStatus.mockResolvedValueOnce(BranchStatus.red);
        platform.massageMarkdown.mockReturnValueOnce('markdown content');

        await ensurePr({
          ...config,
          automerge: true,
          automergeType: 'branch',
          branchAutomergeFailureMessage: 'branch status error',
          suppressNotifications: [],
        });

        expect(comment.ensureComment).not.toHaveBeenCalled();
      });
    });

    describe('Automerge', () => {
      it('handles branch automerge', async () => {
        platform.getBranchPr.mockResolvedValueOnce(pr);

        const res = await ensurePr({
          ...config,
          automerge: true,
          automergeType: 'branch',
        });

        expect(res).toEqual({
          type: 'without-pr',
          prBlockedBy: 'BranchAutomerge',
        });
        expect(platform.updatePr).not.toHaveBeenCalled();
        expect(platform.createPr).not.toHaveBeenCalled();
      });

      it('adds assignees for PR automerge with red status', async () => {
        const changedPr: Pr = {
          ...pr,
          hasAssignees: false,
          hasReviewers: false,
        };
        platform.getBranchPr.mockResolvedValueOnce(changedPr);
        checks.resolveBranchStatus.mockResolvedValueOnce(BranchStatus.red);

        const res = await ensurePr({
          ...config,
          automerge: true,
          automergeType: 'pr',
          assignAutomerge: false,
        });

        expect(res).toEqual({ type: 'with-pr', pr: changedPr });
        expect(participants.addParticipants).toHaveBeenCalled();
      });

      it('skips branch automerge and forces PR creation due to artifact errors', async () => {
        platform.createPr.mockResolvedValueOnce(pr);

        const res = await ensurePr({
          ...config,
          automerge: true,
          automergeType: 'branch',
          artifactErrors: [{ lockFile: 'foo', stderr: 'bar' }],
        });

        expect(res).toEqual({ type: 'with-pr', pr });
        expect(platform.createPr).toHaveBeenCalled();
        expect(participants.addParticipants).not.toHaveBeenCalled();
      });

      it('skips branch automerge and forces PR creation due to prNotPendingHours exceeded', async () => {
        const now = DateTime.now();
        const then = now.minus({ hours: 2 });

        git.getBranchLastCommitTime.mockResolvedValueOnce(then.toJSDate());
        checks.resolveBranchStatus.mockResolvedValueOnce(BranchStatus.yellow);
        platform.createPr.mockResolvedValueOnce(pr);

        const res = await ensurePr({
          ...config,
          automerge: true,
          automergeType: 'branch',
          stabilityStatus: BranchStatus.green,
          prNotPendingHours: 1,
        });

        expect(res).toEqual({ type: 'with-pr', pr });
        expect(platform.createPr).toHaveBeenCalled();
      });

      it('automerges branch when prNotPendingHours are not exceeded', async () => {
        const now = DateTime.now();
        const then = now.minus({ hours: 1 });

        git.getBranchLastCommitTime.mockResolvedValueOnce(then.toJSDate());
        checks.resolveBranchStatus.mockResolvedValueOnce(BranchStatus.yellow);
        platform.createPr.mockResolvedValueOnce(pr);

        const res = await ensurePr({
          ...config,
          automerge: true,
          automergeType: 'branch',
          stabilityStatus: BranchStatus.green,
          prNotPendingHours: 2,
        });

        expect(res).toEqual({
          type: 'without-pr',
          prBlockedBy: 'BranchAutomerge',
        });
        expect(platform.createPr).not.toHaveBeenCalled();
      });

      it('comments on automerge failure', async () => {
        platform.createPr.mockResolvedValueOnce(pr);
        checks.resolveBranchStatus.mockResolvedValueOnce(BranchStatus.red);
        jest
          .spyOn(platform, 'massageMarkdown')
          .mockImplementation((prBody) => 'markdown content');
        await ensurePr({
          ...config,
          automerge: true,
          automergeType: 'branch',
          branchAutomergeFailureMessage: 'branch status error',
          suppressNotifications: [],
        });

        expect(platform.createPr).toHaveBeenCalled();
        expect(platform.massageMarkdown).toHaveBeenCalled();
        expect(comment.ensureComment).toHaveBeenCalledWith({
          content: 'markdown content',
          number: 123,
          topic: 'Branch automerge failure',
        });
      });

      it('handles ensureComment error', async () => {
        platform.createPr.mockResolvedValueOnce(pr);
        checks.resolveBranchStatus.mockResolvedValueOnce(BranchStatus.red);
        platform.massageMarkdown.mockReturnValueOnce('markdown content');
        comment.ensureComment.mockRejectedValueOnce(new Error('unknown'));

        const res = await ensurePr({
          ...config,
          automerge: true,
          automergeType: 'branch',
          branchAutomergeFailureMessage: 'branch status error',
          suppressNotifications: [],
        });

        expect(res).toEqual({ type: 'without-pr', prBlockedBy: 'Error' });
      });

      it('logs unknown error', async () => {
        const changedPr: Pr = {
          ...pr,
          hasAssignees: false,
          hasReviewers: false,
        };
        platform.getBranchPr.mockResolvedValueOnce(changedPr);
        checks.resolveBranchStatus.mockResolvedValueOnce(BranchStatus.red);

        const err = new Error('unknown');
        participants.addParticipants.mockRejectedValueOnce(err);

        await ensurePr({
          ...config,
          automerge: true,
          automergeType: 'pr',
          assignAutomerge: false,
        });

        expect(logger.logger.error).toHaveBeenCalledWith(
          { err },
          'Failed to ensure PR: ' + prTitle
        );
      });

      it('re-throws ExternalHostError', async () => {
        const changedPr: Pr = {
          ...pr,
          hasAssignees: false,
          hasReviewers: false,
        };
        platform.getBranchPr.mockResolvedValueOnce(changedPr);
        checks.resolveBranchStatus.mockResolvedValueOnce(BranchStatus.red);

        const err = new ExternalHostError(new Error('unknown'));
        participants.addParticipants.mockRejectedValueOnce(err);

        await expect(
          ensurePr({
            ...config,
            automerge: true,
            automergeType: 'pr',
            assignAutomerge: false,
          })
        ).rejects.toThrow(err);
      });

      it.each`
        message
        ${REPOSITORY_CHANGED}
        ${PLATFORM_RATE_LIMIT_EXCEEDED}
        ${PLATFORM_INTEGRATION_UNAUTHORIZED}
      `(
        're-throws error with specific message: "$message"',
        async ({ message }) => {
          const changedPr: Pr = {
            ...pr,
            hasAssignees: false,
            hasReviewers: false,
          };
          platform.getBranchPr.mockResolvedValueOnce(changedPr);
          checks.resolveBranchStatus.mockResolvedValueOnce(BranchStatus.red);

          const err = new Error(message);
          participants.addParticipants.mockRejectedValueOnce(err);

          await expect(
            ensurePr({
              ...config,
              automerge: true,
              automergeType: 'pr',
              assignAutomerge: false,
            })
          ).rejects.toThrow(err);
        }
      );
    });

    describe('Changelog', () => {
      const dummyChanges: ChangeLogChange[] = [
        {
          date: DateTime.fromISO('2000-01-01').toJSDate(),
          message: '',
          sha: '',
        },
      ];

      const dummyRelease: ChangeLogRelease = {
        version: '',
        gitRef: '',
        changes: dummyChanges,
        compare: {},
        date: '',
      };

      const dummyUpgrade: BranchUpgradeConfig = {
        branchName: sourceBranch,
        depType: 'foo',
        depName: 'bar',
        manager: 'npm',
        currentValue: '1.2.3',
        newVersion: '4.5.6',
        logJSON: {
          hasReleaseNotes: true,
          project: {
            type: 'github',
            repository: 'some/repo',
            baseUrl: 'https://github.com',
            sourceUrl: 'https://github.com/some/repo',
          },
          versions: [
            { ...dummyRelease, version: '1.2.3' },
            { ...dummyRelease, version: '2.3.4' },
            { ...dummyRelease, version: '3.4.5' },
            { ...dummyRelease, version: '4.5.6' },
          ],
        },
      };

      it('processes changelogs', async () => {
        platform.createPr.mockResolvedValueOnce(pr);

        const res = await ensurePr({
          ...config,
          upgrades: [dummyUpgrade],
        });

        expect(res).toEqual({ type: 'with-pr', pr });
        const [[bodyConfig]] = prBody.getPrBody.mock.calls;
        expect(bodyConfig).toMatchObject({
          hasReleaseNotes: true,
          upgrades: [
            {
              hasReleaseNotes: true,
              releases: [
                { version: '1.2.3' },
                { version: '2.3.4' },
                { version: '3.4.5' },
                { version: '4.5.6' },
              ],
            },
          ],
        });
      });

      it('handles missing GitHub token', async () => {
        platform.createPr.mockResolvedValueOnce(pr);

        const res = await ensurePr({
          ...config,
          upgrades: [
            {
              ...dummyUpgrade,
              logJSON: { error: ChangeLogError.MissingGithubToken },
              prBodyNotes: [],
            },
          ],
        });

        expect(res).toEqual({ type: 'with-pr', pr });

        const {
          upgrades: [{ prBodyNotes }],
        } = prBody.getPrBody.mock.calls[0][0];
        expect(prBodyNotes).toBeNonEmptyArray();
      });

      it('removes duplicate changelogs', async () => {
        platform.createPr.mockResolvedValueOnce(pr);

        const upgrade: BranchUpgradeConfig = {
          ...dummyUpgrade,
          sourceUrl: 'https://github.com/foo/bar',
          sourceDirectory: '/src',
        };
        const res = await ensurePr({
          ...config,
          upgrades: [upgrade, upgrade, { ...upgrade, depType: 'test' }],
        });

        expect(res).toEqual({ type: 'with-pr', pr });
        const [[bodyConfig]] = prBody.getPrBody.mock.calls;
        expect(bodyConfig).toMatchObject({
          branchName: 'renovate-branch',
          hasReleaseNotes: true,
          prTitle: 'Some title',
          upgrades: [
            { depType: 'foo', hasReleaseNotes: true },
            { depType: 'test', hasReleaseNotes: false },
          ],
        });
      });

      it('remove duplicates release notes', async () => {
        platform.createPr.mockResolvedValueOnce(pr);
        const upgrade = {
          ...dummyUpgrade,
          logJSON: undefined,
          sourceUrl: 'https://github.com/foo/bar',
          hasReleaseNotes: true,
        };
        delete upgrade.logJSON;

        const res = await ensurePr({
          ...config,
          upgrades: [upgrade, { ...upgrade, depType: 'test' }],
        });

        expect(res).toEqual({ type: 'with-pr', pr });
        const [[bodyConfig]] = prBody.getPrBody.mock.calls;
        expect(bodyConfig).toMatchObject({
          branchName: 'renovate-branch',
          hasReleaseNotes: true,
          prTitle: 'Some title',
          upgrades: [
            { depType: 'foo', hasReleaseNotes: true },
            { depType: 'test', hasReleaseNotes: false },
          ],
        });
      });
    });
  });
});
