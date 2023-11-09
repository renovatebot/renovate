import { DateTime } from 'luxon';
import {
  git,
  logger,
  mocked,
  partial,
  platform,
  scm,
} from '../../../../../test/util';
import { GlobalConfig } from '../../../../config/global';
import {
  PLATFORM_INTEGRATION_UNAUTHORIZED,
  PLATFORM_RATE_LIMIT_EXCEEDED,
  REPOSITORY_CHANGED,
} from '../../../../constants/error-messages';
import * as _comment from '../../../../modules/platform/comment';
import { getPrBodyStruct } from '../../../../modules/platform/pr-body';
import type { Pr } from '../../../../modules/platform/types';
import { ExternalHostError } from '../../../../types/errors/external-host-error';
import type { PrCache } from '../../../../util/cache/repository/types';
import { fingerprint } from '../../../../util/fingerprint';
import * as _limits from '../../../global/limits';
import type { BranchConfig, BranchUpgradeConfig } from '../../../types';
import { embedChangelogs } from '../../changelog';
import * as _statusChecks from '../branch/status-checks';
import * as _prBody from './body';
import type { ChangeLogChange, ChangeLogRelease } from './changelog/types';
import * as _participants from './participants';
import * as _prCache from './pr-cache';
import { generatePrBodyFingerprintConfig } from './pr-fingerprint';
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

jest.mock('./pr-cache');
const prCache = mocked(_prCache);

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
      state: 'open',
      targetBranch: 'base',
    };

    const config: BranchConfig = {
      manager: 'some-manager',
      branchName: sourceBranch,
      baseBranch: 'base',
      upgrades: [],
      prTitle,
    };

    beforeEach(() => {
      GlobalConfig.reset();
      prBody.getPrBody.mockReturnValue(body);
    });

    describe('Create', () => {
      it('creates PR', async () => {
        platform.createPr.mockResolvedValueOnce(pr);

        const res = await ensurePr(config);

        expect(res).toEqual({ type: 'with-pr', pr });
        expect(limits.incLimitedValue).toHaveBeenCalledOnce();
        expect(limits.incLimitedValue).toHaveBeenCalledWith('PullRequests');
        expect(logger.logger.info).toHaveBeenCalledWith(
          { pr: pr.number, prTitle },
          'PR created',
        );
        expect(prCache.setPrCache).toHaveBeenCalled();
      });

      it('aborts PR creation once limit is exceeded', async () => {
        platform.createPr.mockResolvedValueOnce(pr);
        limits.isLimitReached.mockReturnValueOnce(true);

        config.fetchChangeLogs = 'pr';

        const res = await ensurePr(config);

        expect(res).toEqual({ type: 'without-pr', prBlockedBy: 'RateLimited' });
        expect(platform.createPr).not.toHaveBeenCalled();
        expect(prCache.setPrCache).not.toHaveBeenCalled();
      });

      it('ignores PR limits on vulnerability alert', async () => {
        platform.createPr.mockResolvedValueOnce(pr);
        limits.isLimitReached.mockReturnValueOnce(true);

        const prConfig = { ...config, isVulnerabilityAlert: true };
        delete prConfig.prTitle; // for coverage
        const res = await ensurePr(prConfig);

        expect(res).toEqual({ type: 'with-pr', pr });
        expect(platform.createPr).toHaveBeenCalled();
        expect(prCache.setPrCache).toHaveBeenCalled();
      });

      it('creates rollback PR', async () => {
        platform.createPr.mockResolvedValueOnce(pr);

        const res = await ensurePr({ ...config, updateType: 'rollback' });

        expect(res).toEqual({ type: 'with-pr', pr });
        expect(logger.logger.info).toHaveBeenCalledWith('Creating Rollback PR');
        expect(prCache.setPrCache).toHaveBeenCalled();
      });

      it('skips PR creation due to non-green branch check', async () => {
        checks.resolveBranchStatus.mockResolvedValueOnce('yellow');

        const res = await ensurePr({ ...config, prCreation: 'status-success' });

        expect(res).toEqual({
          type: 'without-pr',
          prBlockedBy: 'AwaitingTests',
        });
        expect(prCache.setPrCache).not.toHaveBeenCalled();
      });

      it('creates PR for green branch checks', async () => {
        checks.resolveBranchStatus.mockResolvedValueOnce('green');
        platform.createPr.mockResolvedValueOnce(pr);

        const res = await ensurePr({ ...config, prCreation: 'status-success' });

        expect(res).toEqual({ type: 'with-pr', pr });
        expect(platform.createPr).toHaveBeenCalled();
        expect(prCache.setPrCache).toHaveBeenCalled();
      });

      it('skips PR creation for unapproved dependencies', async () => {
        checks.resolveBranchStatus.mockResolvedValueOnce('yellow');

        const res = await ensurePr({ ...config, prCreation: 'approval' });

        expect(res).toEqual({
          type: 'without-pr',
          prBlockedBy: 'NeedsApproval',
        });
        expect(prCache.setPrCache).not.toHaveBeenCalled();
      });

      it('skips PR creation before prNotPendingHours is hit', async () => {
        const now = DateTime.now();
        const then = now.minus({ hours: 1 });

        checks.resolveBranchStatus.mockResolvedValueOnce('yellow');
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
        expect(prCache.setPrCache).not.toHaveBeenCalled();
      });

      it('skips PR creation due to stabilityStatus', async () => {
        const now = DateTime.now();
        const then = now.minus({ hours: 1 });

        checks.resolveBranchStatus.mockResolvedValueOnce('yellow');
        git.getBranchLastCommitTime.mockResolvedValueOnce(then.toJSDate());

        const res = await ensurePr({
          ...config,
          prCreation: 'not-pending',
          stabilityStatus: 'green',
        });

        expect(res).toEqual({
          type: 'without-pr',
          prBlockedBy: 'AwaitingTests',
        });
        expect(prCache.setPrCache).not.toHaveBeenCalled();
      });

      it('creates PR after prNotPendingHours is hit', async () => {
        const now = DateTime.now();
        const then = now.minus({ hours: 2 });

        checks.resolveBranchStatus.mockResolvedValueOnce('yellow');
        git.getBranchLastCommitTime.mockResolvedValueOnce(then.toJSDate());
        platform.createPr.mockResolvedValueOnce(pr);

        const res = await ensurePr({
          ...config,
          prCreation: 'not-pending',
          prNotPendingHours: 1,
        });

        expect(res).toEqual({ type: 'with-pr', pr });
        expect(prCache.setPrCache).toHaveBeenCalled();
      });

      describe('Error handling', () => {
        it('handles unknown error', async () => {
          const err = new Error('unknown');
          platform.createPr.mockRejectedValueOnce(err);

          const res = await ensurePr(config);

          expect(res).toEqual({ type: 'without-pr', prBlockedBy: 'Error' });
          expect(prCache.setPrCache).not.toHaveBeenCalled();
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
            'A pull requests already exists',
          );
          expect(prCache.setPrCache).not.toHaveBeenCalled();
        });

        it('deletes branch on 502 error', async () => {
          const err: Error & { statusCode?: number } = new Error('unknown');
          err.statusCode = 502;
          platform.createPr.mockRejectedValueOnce(err);

          const res = await ensurePr(config);

          expect(res).toEqual({ type: 'without-pr', prBlockedBy: 'Error' });
          expect(prCache.setPrCache).not.toHaveBeenCalled();
          expect(scm.deleteBranch).toHaveBeenCalledWith('renovate-branch');
        });
      });
    });

    describe('Update', () => {
      it('updates PR due to title change', async () => {
        const changedPr: Pr = { ...pr, title: 'Another title' }; // user changed the prTitle
        platform.getBranchPr.mockResolvedValueOnce(changedPr);

        const res = await ensurePr(config);

        expect(res).toEqual({ type: 'with-pr', pr }); // we redo the prTitle as per config
        expect(platform.updatePr).toHaveBeenCalled();
        expect(platform.createPr).not.toHaveBeenCalled();
        expect(logger.logger.info).toHaveBeenCalledWith(
          { pr: changedPr.number, prTitle },
          `PR updated`,
        );
        expect(prCache.setPrCache).toHaveBeenCalled();
      });

      it('updates PR due to body change', async () => {
        const changedPr: Pr = {
          ...pr,
          bodyStruct: getPrBodyStruct(`${body} updated`), // user changed prBody
        };
        platform.getBranchPr.mockResolvedValueOnce(changedPr);

        const res = await ensurePr(config);

        expect(res).toEqual({ type: 'with-pr', pr }); // we redo the prBody as per config
        expect(platform.updatePr).toHaveBeenCalled();
        expect(platform.createPr).not.toHaveBeenCalled();
        expect(prCache.setPrCache).toHaveBeenCalled();
        expect(logger.logger.info).toHaveBeenCalledWith(
          { pr: changedPr.number, prTitle },
          `PR updated`,
        );
      });

      it('updates PR target branch if base branch changed in config', async () => {
        platform.getBranchPr.mockResolvedValueOnce(pr);

        const res = await ensurePr({ ...config, baseBranch: 'new_base' }); // user changed base branch in config

        expect(platform.updatePr).toHaveBeenCalled();
        expect(platform.createPr).not.toHaveBeenCalled();
        expect(prCache.setPrCache).toHaveBeenCalled();
        expect(logger.logger.info).toHaveBeenCalledWith(
          { pr: pr.number, prTitle },
          `PR updated`,
        );
        expect(logger.logger.debug).toHaveBeenCalledWith(
          {
            branchName: 'renovate-branch',
            oldBaseBranch: 'base',
            newBaseBranch: 'new_base',
          },
          'PR base branch has changed',
        );
        expect(res).toEqual({
          type: 'with-pr',
          pr: { ...pr, targetBranch: 'new_base' }, // updated target branch of pr
        });
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
        expect(prCache.setPrCache).toHaveBeenCalled();
        expect(logger.logger.debug).toHaveBeenCalledWith(
          'Pull Request #123 does not need updating',
        );
      });
    });

    describe('dry-run', () => {
      beforeEach(() => {
        GlobalConfig.set({ dryRun: 'full' });
      });

      it('dry-runs PR creation', async () => {
        platform.createPr.mockResolvedValueOnce(pr);

        const res = await ensurePr(config);

        expect(res).toEqual({
          type: 'with-pr',
          pr: { number: 0 },
        });
        expect(platform.updatePr).not.toHaveBeenCalled();
        expect(platform.createPr).not.toHaveBeenCalled();
        expect(logger.logger.info).toHaveBeenCalledWith(
          `DRY-RUN: Would create PR: ${prTitle}`,
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
          `DRY-RUN: Would update PR #${pr.number}`,
        );
      });

      it('skips automerge failure comment', async () => {
        platform.createPr.mockResolvedValueOnce(pr);
        checks.resolveBranchStatus.mockResolvedValueOnce('red');
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
        expect(prCache.setPrCache).not.toHaveBeenCalled();
      });

      it('forces PR on dashboard check', async () => {
        platform.createPr.mockResolvedValueOnce(pr);

        const res = await ensurePr({
          ...config,
          automerge: true,
          automergeType: 'branch',
          reviewers: ['somebody'],
          dependencyDashboardChecks: {
            'renovate-branch': 'approvePr',
          },
        });

        expect(res).toEqual({ type: 'with-pr', pr });
        expect(prCache.setPrCache).toHaveBeenCalled();
      });

      it('adds assignees for PR automerge with red status', async () => {
        const changedPr: Pr = {
          ...pr,
          hasAssignees: false,
        };
        platform.getBranchPr.mockResolvedValueOnce(changedPr);
        checks.resolveBranchStatus.mockResolvedValueOnce('red');

        const res = await ensurePr({
          ...config,
          automerge: true,
          automergeType: 'pr',
          assignAutomerge: false,
        });

        expect(res).toEqual({ type: 'with-pr', pr: changedPr });
        expect(participants.addParticipants).toHaveBeenCalled();
        expect(prCache.setPrCache).toHaveBeenCalled();
      });

      it('adds reviewers for PR automerge with red status and existing ignorable reviewers that can be ignored', async () => {
        const changedPr: Pr = {
          ...pr,
          hasAssignees: false,
          reviewers: ['renovate-approve'],
        };
        platform.getBranchPr.mockResolvedValueOnce(changedPr);
        checks.resolveBranchStatus.mockResolvedValueOnce('red');

        const res = await ensurePr({
          ...config,
          automerge: true,
          automergeType: 'pr',
          assignAutomerge: false,
          ignoreReviewers: ['renovate-approve'],
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
        expect(prCache.setPrCache).toHaveBeenCalled();
      });

      it('skips branch automerge and forces PR creation due to prNotPendingHours exceeded', async () => {
        const now = DateTime.now();
        const then = now.minus({ hours: 2 });

        git.getBranchLastCommitTime.mockResolvedValueOnce(then.toJSDate());
        checks.resolveBranchStatus.mockResolvedValueOnce('yellow');
        platform.createPr.mockResolvedValueOnce(pr);

        const res = await ensurePr({
          ...config,
          automerge: true,
          automergeType: 'branch',
          stabilityStatus: 'green',
          prNotPendingHours: 1,
        });

        expect(res).toEqual({ type: 'with-pr', pr });
        expect(platform.createPr).toHaveBeenCalled();
        expect(prCache.setPrCache).toHaveBeenCalled();
      });

      it('automerges branch when prNotPendingHours are not exceeded', async () => {
        const now = DateTime.now();
        const then = now.minus({ hours: 1 });

        git.getBranchLastCommitTime.mockResolvedValueOnce(then.toJSDate());
        checks.resolveBranchStatus.mockResolvedValueOnce('yellow');
        platform.createPr.mockResolvedValueOnce(pr);

        const res = await ensurePr({
          ...config,
          automerge: true,
          automergeType: 'branch',
          stabilityStatus: 'green',
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
        checks.resolveBranchStatus.mockResolvedValueOnce('red');
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
        checks.resolveBranchStatus.mockResolvedValueOnce('red');
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
        };
        platform.getBranchPr.mockResolvedValueOnce(changedPr);
        checks.resolveBranchStatus.mockResolvedValueOnce('red');

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
          'Failed to ensure PR: ' + prTitle,
        );
      });

      it('re-throws ExternalHostError', async () => {
        const changedPr: Pr = {
          ...pr,
          hasAssignees: false,
        };
        platform.getBranchPr.mockResolvedValueOnce(changedPr);
        checks.resolveBranchStatus.mockResolvedValueOnce('red');

        const err = new ExternalHostError(new Error('unknown'));
        participants.addParticipants.mockRejectedValueOnce(err);

        await expect(
          ensurePr({
            ...config,
            automerge: true,
            automergeType: 'pr',
            assignAutomerge: false,
          }),
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
          };
          platform.getBranchPr.mockResolvedValueOnce(changedPr);
          checks.resolveBranchStatus.mockResolvedValueOnce('red');

          const err = new Error(message);
          participants.addParticipants.mockRejectedValueOnce(err);

          await expect(
            ensurePr({
              ...config,
              automerge: true,
              automergeType: 'pr',
              assignAutomerge: false,
            }),
          ).rejects.toThrow(err);
        },
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

      const dummyUpgrade = partial<BranchUpgradeConfig>({
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
            apiBaseUrl: 'https://api.github.com/',
            sourceUrl: 'https://github.com/some/repo',
          },
          versions: [
            { ...dummyRelease, version: '1.2.3' },
            { ...dummyRelease, version: '2.3.4' },
            { ...dummyRelease, version: '3.4.5' },
            { ...dummyRelease, version: '4.5.6' },
          ],
        },
      });

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
              logJSON: { error: 'MissingGithubToken' },
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

        const upgrade = partial<BranchUpgradeConfig>({
          ...dummyUpgrade,
          sourceUrl: 'https://github.com/foo/bar',
          sourceDirectory: '/src',
        });
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

    describe('prCache', () => {
      const existingPr: Pr = {
        ...pr,
      };
      let cachedPr: PrCache | null = null;

      it('adds pr-cache when not present', async () => {
        platform.getBranchPr.mockResolvedValue(existingPr);
        cachedPr = null;
        prCache.getPrCache.mockReturnValueOnce(cachedPr);
        const res = await ensurePr(config);
        expect(res).toEqual({
          type: 'with-pr',
          pr: existingPr,
        });
        expect(logger.logger.debug).toHaveBeenCalledWith(
          'Pull Request #123 does not need updating',
        );
        expect(prCache.setPrCache).toHaveBeenCalledTimes(1);
      });

      it('does not update lastEdited pr-cache when pr fingerprint is same but pr was edited within 24hrs', async () => {
        platform.getBranchPr.mockResolvedValue(existingPr);
        cachedPr = {
          bodyFingerprint: fingerprint(generatePrBodyFingerprintConfig(config)),
          lastEdited: new Date().toISOString(),
        };
        prCache.getPrCache.mockReturnValueOnce(cachedPr);
        const res = await ensurePr(config);
        expect(res).toEqual({
          type: 'with-pr',
          pr: existingPr,
        });
        expect(logger.logger.debug).toHaveBeenCalledWith(
          'Pull Request #123 does not need updating',
        );
        expect(logger.logger.debug).toHaveBeenCalledWith(
          'PR cache matches but it has been edited in the past 24hrs, so processing PR',
        );
        expect(prCache.setPrCache).toHaveBeenCalledWith(
          sourceBranch,
          cachedPr.bodyFingerprint,
          false,
        );
      });

      it('updates pr-cache when pr fingerprint is different', async () => {
        platform.getBranchPr.mockResolvedValue(existingPr);
        cachedPr = {
          bodyFingerprint: 'old',
          lastEdited: new Date('2020-01-20T00:00:00Z').toISOString(),
        };
        prCache.getPrCache.mockReturnValueOnce(cachedPr);
        const res = await ensurePr(config);
        expect(res).toEqual({
          type: 'with-pr',
          pr: existingPr,
        });
        expect(logger.logger.debug).toHaveBeenCalledWith(
          'PR fingerprints mismatch, processing PR',
        );
        expect(prCache.setPrCache).toHaveBeenCalledTimes(1);
      });

      it('skips fetching changelogs when cache is valid and pr was lastEdited before 24hrs', async () => {
        config.repositoryCache = 'enabled';
        platform.getBranchPr.mockResolvedValue(existingPr);
        cachedPr = {
          bodyFingerprint: fingerprint(
            generatePrBodyFingerprintConfig({
              ...config,
              fetchChangeLogs: 'pr',
            }),
          ),
          lastEdited: new Date('2020-01-20T00:00:00Z').toISOString(),
        };
        prCache.getPrCache.mockReturnValueOnce(cachedPr);
        const res = await ensurePr({ ...config, fetchChangeLogs: 'pr' });
        expect(res).toEqual({
          type: 'with-pr',
          pr: existingPr,
        });
        expect(logger.logger.debug).toHaveBeenCalledWith(
          'PR cache matches and no PR changes in last 24hrs, so skipping PR body check',
        );
        expect(embedChangelogs).toHaveBeenCalledTimes(0);
      });

      it('updates PR when rebase requested by user regardless of pr-cache state', async () => {
        config.repositoryCache = 'enabled';
        platform.getBranchPr.mockResolvedValue({
          number,
          sourceBranch,
          title: prTitle,
          bodyStruct: {
            hash: 'hash-with-checkbox-checked',
            rebaseRequested: true,
          },
          state: 'open',
        });
        cachedPr = {
          bodyFingerprint: fingerprint(
            generatePrBodyFingerprintConfig({
              ...config,
              fetchChangeLogs: 'pr',
            }),
          ),
          lastEdited: new Date('2020-01-20T00:00:00Z').toISOString(),
        };
        prCache.getPrCache.mockReturnValueOnce(cachedPr);
        const res = await ensurePr({ ...config, fetchChangeLogs: 'pr' });
        expect(res).toEqual({
          type: 'with-pr',
          pr: {
            number,
            sourceBranch,
            title: prTitle,
            bodyStruct,
            state: 'open',
            targetBranch: 'base',
          },
        });
        expect(logger.logger.debug).toHaveBeenCalledWith(
          'PR rebase requested, so skipping cache check',
        );
        expect(logger.logger.debug).not.toHaveBeenCalledWith(
          `Pull Request #${number} does not need updating`,
        );
        expect(embedChangelogs).toHaveBeenCalledTimes(1);
      });

      it('logs when cache is enabled but pr-cache is absent', async () => {
        config.repositoryCache = 'enabled';
        platform.getBranchPr.mockResolvedValue(existingPr);
        prCache.getPrCache.mockReturnValueOnce(null);
        await ensurePr(config);
        expect(logger.logger.debug).toHaveBeenCalledWith('PR cache not found');
      });

      it('does not log when cache is disabled and pr-cache is absent', async () => {
        config.repositoryCache = 'disabled';
        platform.getBranchPr.mockResolvedValue(existingPr);
        prCache.getPrCache.mockReturnValueOnce(null);
        await ensurePr(config);
        expect(logger.logger.debug).not.toHaveBeenCalledWith(
          'PR cache not found',
        );
      });
    });
  });
});
