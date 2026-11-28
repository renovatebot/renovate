import { fakeSha, logger, scm } from '~test/util.ts';
import { GlobalConfig } from '../../../../config/global.ts';
import { CONFIG_SECRETS_EXPOSED } from '../../../../constants/error-messages.ts';
import type { PreparedCommit } from '../../../../modules/platform/types.ts';
import {
  addSecretForSanitizing,
  clearRepoSanitizedSecretsList,
} from '../../../../util/sanitize.ts';
import type { BranchConfig } from '../../../types.ts';
import { prepareBranchCommit, pushBranchCommit } from './commit.ts';

describe('workers/repository/update/branch/commit', () => {
  let config: BranchConfig;
  const push = vi.fn<PreparedCommit['push']>();
  const preparedCommit: PreparedCommit = { sha: fakeSha('local'), push };

  beforeEach(() => {
    config = {
      baseBranch: 'base-branch',
      manager: 'some-manager',
      branchName: 'renovate/some-branch',
      commitMessage: 'some commit message',
      semanticCommits: 'disabled',
      semanticCommitType: 'a',
      semanticCommitScope: 'b',
      updatedPackageFiles: [],
      updatedArtifacts: [],
      upgrades: [],
      platformCommit: 'auto',
    } satisfies BranchConfig;
    push.mockResolvedValue(fakeSha('123test'));
    scm.prepareCommit.mockResolvedValue(preparedCommit);
    GlobalConfig.reset();
  });

  describe('prepareBranchCommit', () => {
    it('handles empty files', async () => {
      await expect(prepareBranchCommit(config)).resolves.toBeNull();
      expect(scm.prepareCommit).not.toHaveBeenCalled();
    });

    it('prepares the commit without pushing it', async () => {
      config.updatedPackageFiles?.push({
        type: 'addition',
        path: 'package.json',
        contents: 'some contents',
      });

      const res = await prepareBranchCommit(config);

      expect(res).toBe(preparedCommit);
      expect(push).not.toHaveBeenCalled();
      expect(scm.prepareCommit).toHaveBeenCalledExactlyOnceWith({
        baseBranch: 'base-branch',
        branchName: 'renovate/some-branch',
        files: [
          {
            contents: 'some contents',
            path: 'package.json',
            type: 'addition',
          },
        ],
        force: false,
        message: 'some commit message',
        platformCommit: 'auto',
      });
    });

    it('returns null if the platform has nothing to commit', async () => {
      scm.prepareCommit.mockResolvedValueOnce(null);
      config.updatedPackageFiles?.push({
        type: 'addition',
        path: 'package.json',
        contents: 'some contents',
      });

      await expect(prepareBranchCommit(config)).resolves.toBeNull();

      expect(scm.prepareCommit).toHaveBeenCalledOnce();
    });

    it('passes commit trailers', async () => {
      config.updatedPackageFiles?.push({
        type: 'addition',
        path: 'package.json',
        contents: 'some contents',
      });
      config.commitTrailers = [
        'Signed-off-by: Renovate Bot <bot@renovateapp.com>',
      ];

      await prepareBranchCommit(config);

      expect(scm.prepareCommit).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          trailers: ['Signed-off-by: Renovate Bot <bot@renovateapp.com>'],
        }),
      );
    });

    it('logs the commit in dry-run mode without preparing it', async () => {
      GlobalConfig.set({ dryRun: 'full' });
      config.updatedPackageFiles?.push({
        type: 'addition',
        path: 'package.json',
        contents: 'some contents',
      });

      await expect(prepareBranchCommit(config)).resolves.toBeNull();

      expect(scm.prepareCommit).not.toHaveBeenCalled();
      expect(logger.logger.info).toHaveBeenCalledWith(
        'DRY-RUN: Would commit files to branch renovate/some-branch. See debug logs for raw commit information',
      );
    });

    it('logs deleted files in dry-run mode without preparing a commit', async () => {
      GlobalConfig.set({ dryRun: 'full' });
      config.updatedPackageFiles?.push({
        type: 'deletion',
        path: 'package-lock.json',
      });

      await expect(prepareBranchCommit(config)).resolves.toBeNull();

      expect(scm.prepareCommit).not.toHaveBeenCalled();
      expect(logger.logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          files: [{ type: 'deletion', path: 'package-lock.json' }],
        }),
        'DRY-RUN: Would commit files to branch renovate/some-branch',
      );
    });

    it('rejects if the commit message contains a secret', async () => {
      addSecretForSanitizing('some-secret');
      config.commitMessage = 'update some-secret';
      config.updatedPackageFiles?.push({
        type: 'addition',
        path: 'package.json',
        contents: 'some contents',
      });

      try {
        await expect(prepareBranchCommit(config)).rejects.toThrow(
          CONFIG_SECRETS_EXPOSED,
        );
        expect(scm.prepareCommit).not.toHaveBeenCalled();
      } finally {
        clearRepoSanitizedSecretsList();
      }
    });
  });

  describe('pushBranchCommit', () => {
    it('pushes the prepared commit', async () => {
      await expect(pushBranchCommit(preparedCommit)).resolves.toBe(
        fakeSha('123test'),
      );
      expect(push).toHaveBeenCalledTimes(1);
    });
  });
});
