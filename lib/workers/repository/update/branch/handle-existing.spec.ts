import { partial, scm } from '~test/util.ts';
import { GlobalConfig } from '../../../../config/global.ts';
import { logger } from '../../../../logger/index.ts';
import * as _comment from '../../../../modules/platform/comment.ts';
import type { Pr } from '../../../../modules/platform/index.ts';
import type { BranchConfig } from '../../../types.ts';
import { handleClosedPr, handleModifiedPr } from './handle-existing.ts';

vi.mock('../../../../modules/platform/comment.ts');
const comment = vi.mocked(_comment);

describe('workers/repository/update/branch/handle-existing', () => {
  const pr = partial<Pr>({ number: 12, state: 'closed' });

  let config: BranchConfig;

  beforeEach(() => {
    GlobalConfig.reset();
    config = {
      manager: 'some-manager',
      branchName: 'some-branch',
      baseBranch: 'base',
      upgrades: [],
      suppressNotifications: [],
      userStrings: {
        ignoreTopic: 'ignore-topic',
        ignoreMajor: 'ignore-major',
        ignoreDigest: 'ignore-digest',
        ignoreOther: 'ignore-other',
      },
    };
  });

  describe('handleClosedPr', () => {
    it('does nothing for a pr that is not closed', async () => {
      await handleClosedPr(config, partial<Pr>({ number: 12, state: 'open' }));

      expect(comment.ensureComment).not.toHaveBeenCalled();
      expect(scm.branchExists).not.toHaveBeenCalled();
    });

    it('skips the comment when the notification is suppressed', async () => {
      config.suppressNotifications = ['prIgnoreNotification'];
      scm.branchExists.mockResolvedValueOnce(false);

      await handleClosedPr(config, pr);

      expect(comment.ensureComment).not.toHaveBeenCalled();
      expect(scm.deleteBranch).not.toHaveBeenCalled();
    });

    it('leaves the branch alone when it no longer exists', async () => {
      scm.branchExists.mockResolvedValueOnce(false);

      await handleClosedPr(config, pr);

      expect(comment.ensureComment).toHaveBeenCalledOnce();
      expect(scm.deleteBranch).not.toHaveBeenCalled();
    });

    it('comments and deletes the branch', async () => {
      scm.branchExists.mockResolvedValueOnce(true);

      await handleClosedPr(config, pr);

      expect(comment.ensureComment).toHaveBeenCalledOnce();
      expect(scm.deleteBranch).toHaveBeenCalledExactlyOnceWith('some-branch');
    });

    it('does neither in dry run mode', async () => {
      GlobalConfig.set({ dryRun: 'full' });
      scm.branchExists.mockResolvedValueOnce(true);

      await handleClosedPr(config, pr);

      expect(comment.ensureComment).not.toHaveBeenCalled();
      expect(scm.deleteBranch).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'DRY-RUN: Would ensure closed PR comment in PR #12',
      );
      expect(logger.info).toHaveBeenCalledWith(
        'DRY-RUN: Would delete branch some-branch',
      );
    });

    it.each`
      updateType  | expected
      ${'major'}  | ${'ignore-major'}
      ${'digest'} | ${'ignore-digest'}
      ${'minor'}  | ${'ignore-other'}
    `('compiles the $updateType message', async ({ updateType, expected }) => {
      config.updateType = updateType;
      scm.branchExists.mockResolvedValueOnce(false);

      await handleClosedPr(config, pr);

      expect(comment.ensureComment).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining(expected),
        }),
      );
    });
  });

  describe('handleModifiedPr', () => {
    it('does nothing when the notification is suppressed', async () => {
      config.suppressNotifications = ['prEditedNotification'];

      await handleModifiedPr(config, pr);

      expect(comment.ensureComment).not.toHaveBeenCalled();
      expect(comment.ensureCommentRemoval).not.toHaveBeenCalled();
    });

    it('removes the comment when a rebase was requested', async () => {
      config.rebaseRequested = true;

      await handleModifiedPr(config, pr);

      expect(comment.ensureCommentRemoval).toHaveBeenCalledExactlyOnceWith({
        type: 'by-topic',
        number: 12,
        topic: 'Edited/Blocked Notification',
      });
    });

    it('adds the comment when no rebase was requested', async () => {
      await handleModifiedPr(config, pr);

      expect(comment.ensureComment).toHaveBeenCalledOnce();
    });

    it('removes nothing in dry run mode when a rebase was requested', async () => {
      GlobalConfig.set({ dryRun: 'full' });
      config.rebaseRequested = true;

      await handleModifiedPr(config, pr);

      expect(comment.ensureCommentRemoval).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'DRY-RUN: Would remove edited/blocked PR comment in PR #12',
      );
    });

    it('adds nothing in dry run mode when no rebase was requested', async () => {
      GlobalConfig.set({ dryRun: 'full' });

      await handleModifiedPr(config, pr);

      expect(comment.ensureComment).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'DRY-RUN: Would ensure edited/blocked PR comment in PR #12',
      );
    });
  });
});
