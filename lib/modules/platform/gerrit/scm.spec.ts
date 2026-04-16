import { git, partial } from '~test/util.ts';
import type { LongCommitSha } from '../../../util/git/types.ts';
import { client as _client } from './client.ts';
import {
  GerritScm,
  configureScm,
  pendingChangeBranches,
  pushForReview,
} from './scm.ts';
import type { GerritChange } from './types.ts';

vi.mock('./client.ts');
const clientMock = vi.mocked(_client);

describe('modules/platform/gerrit/scm', () => {
  const gerritScm = new GerritScm();

  beforeEach(() => {
    configureScm('test/repo');
    pendingChangeBranches.clear();
  });

  describe('pushForReview()', () => {
    it('pushes to refs/for/<targetBranch> and returns true on success', async () => {
      git.pushCommit.mockResolvedValueOnce(true);
      await expect(
        pushForReview({
          sourceRef: 'renovate/feat',
          targetBranch: 'main',
          files: [],
        }),
      ).resolves.toBeTrue();
      expect(git.pushCommit).toHaveBeenCalledExactlyOnceWith({
        sourceRef: 'renovate/feat',
        targetRef: 'refs/for/main',
        files: [],
        pushOptions: ['notify=NONE', 'ready'],
      });
      expect(git.updateVirtualBranch).toHaveBeenCalledExactlyOnceWith(
        'renovate/feat',
      );
    });

    it('adds hashtag push options for each label', async () => {
      git.pushCommit.mockResolvedValueOnce(true);
      await expect(
        pushForReview({
          sourceRef: 'renovate/feat',
          targetBranch: 'main',
          files: [],
          labels: ['team:backend', 'priority:high'],
        }),
      ).resolves.toBeTrue();
      expect(git.pushCommit).toHaveBeenCalledExactlyOnceWith({
        sourceRef: 'renovate/feat',
        targetRef: 'refs/for/main',
        files: [],
        pushOptions: [
          'notify=NONE',
          'ready',
          'hashtag=team:backend',
          'hashtag=priority:high',
        ],
      });
      expect(git.updateVirtualBranch).toHaveBeenCalledExactlyOnceWith(
        'renovate/feat',
      );
    });

    it('clears pending change branch on success', async () => {
      pendingChangeBranches.add('renovate/feat');
      git.pushCommit.mockResolvedValueOnce(true);
      await expect(
        pushForReview({
          sourceRef: 'renovate/feat',
          targetBranch: 'main',
          files: [],
        }),
      ).resolves.toBeTrue();
      expect(pendingChangeBranches.has('renovate/feat')).toBeFalse();
      expect(git.updateVirtualBranch).toHaveBeenCalledExactlyOnceWith(
        'renovate/feat',
      );
    });

    it('keeps pending change branch when push fails', async () => {
      pendingChangeBranches.add('renovate/feat');
      git.pushCommit.mockResolvedValueOnce(false);
      await expect(
        pushForReview({
          sourceRef: 'renovate/feat',
          targetBranch: 'main',
          files: [],
        }),
      ).resolves.toBeFalse();
      expect(pendingChangeBranches.has('renovate/feat')).toBeTrue();
      expect(git.updateVirtualBranch).not.toHaveBeenCalled();
    });
  });

  describe('deleteBranch()', () => {
    it('deletes virtual branch', async () => {
      await expect(gerritScm.deleteBranch('branchName')).toResolve();
      expect(git.deleteVirtualBranch).toHaveBeenCalledExactlyOnceWith(
        'branchName',
      );
    });

    it('clears pending change branch', async () => {
      pendingChangeBranches.add('renovate/pending');
      await gerritScm.deleteBranch('renovate/pending');
      expect(pendingChangeBranches.has('renovate/pending')).toBeFalse();
    });
  });

  describe('mergeToLocal()', () => {
    it('uses local merge when there is a pending change branch', async () => {
      pendingChangeBranches.add('renovate/onboarding');
      git.mergeToLocal.mockResolvedValueOnce();
      await expect(gerritScm.mergeToLocal('renovate/onboarding')).toResolve();
      expect(clientMock.findChanges).not.toHaveBeenCalled();
      expect(git.mergeToLocal).toHaveBeenCalledExactlyOnceWith(
        'renovate/onboarding',
        { localBranch: true },
      );
    });

    it('delegates to super.mergeToLocal() when there is no pending change branch', async () => {
      git.mergeToLocal.mockResolvedValueOnce();
      await expect(gerritScm.mergeToLocal('existingChange')).toResolve();
      expect(git.mergeToLocal).toHaveBeenCalledExactlyOnceWith(
        'existingChange',
      );
    });
  });

  describe('commitAndPush()', () => {
    it('commitAndPush() - empty commit', async () => {
      clientMock.getBranchChange.mockResolvedValueOnce(null);
      git.prepareCommit.mockResolvedValueOnce(null); //empty commit

      await expect(
        gerritScm.commitAndPush({
          branchName: 'renovate/dependency-1.x',
          baseBranch: 'main',
          message: 'commit msg',
          files: [],
          prTitle: 'pr title',
        }),
      ).resolves.toBeNull();
      expect(clientMock.getBranchChange).toHaveBeenCalledExactlyOnceWith(
        'test/repo',
        {
          branchName: 'renovate/dependency-1.x',
          state: 'open',
          targetBranch: 'main',
        },
      );
    });

    it('commitAndPush() - create first commit but does not push', async () => {
      clientMock.getBranchChange.mockResolvedValueOnce(null);
      git.prepareCommit.mockResolvedValueOnce({
        commitSha: 'commitSha' as LongCommitSha,
        parentCommitSha: 'parentSha' as LongCommitSha,
        files: [],
      });

      expect(
        await gerritScm.commitAndPush({
          branchName: 'renovate/dependency-1.x',
          baseBranch: 'main',
          message: 'commit msg',
          files: [],
          prTitle: 'pr title',
        }),
      ).toBe('commitSha');
      expect(git.prepareCommit).toHaveBeenCalledExactlyOnceWith({
        baseBranch: 'main',
        branchName: 'renovate/dependency-1.x',
        files: [],
        message: [
          'pr title',
          expect.stringMatching(
            /^Renovate-Branch: renovate\/dependency-1\.x\nChange-Id: I[a-z0-9]{40}$/,
          ),
        ],
        prTitle: 'pr title',
      });
      // For new changes, push should NOT be called - it will be done by createPr()
      expect(git.pushCommit).not.toHaveBeenCalled();
      // Virtual branch is not updated until createPr() pushes the change
      expect(git.updateVirtualBranch).not.toHaveBeenCalled();
    });

    it('commitAndPush() - existing change keeps original target branch', async () => {
      const existingChange = partial<GerritChange>({
        change_id: 'Ifcd936eef0ced620040a07a337c586d0a882725b',
        branch: 'main',
      });
      clientMock.getBranchChange.mockResolvedValueOnce(existingChange);
      git.prepareCommit.mockResolvedValueOnce({
        commitSha: 'commitSha' as LongCommitSha,
        parentCommitSha: 'parentSha' as LongCommitSha,
        files: [],
      });
      git.pushCommit.mockResolvedValueOnce(true);

      expect(
        await gerritScm.commitAndPush({
          branchName: 'renovate/dependency-1.x',
          baseBranch: 'new-main',
          message: ['commit msg'],
          files: [],
          prTitle: 'pr title',
        }),
      ).toBe('commitSha');
      expect(git.prepareCommit).toHaveBeenCalledExactlyOnceWith({
        baseBranch: 'new-main',
        branchName: 'renovate/dependency-1.x',
        files: [],
        message: [
          'pr title',
          'Renovate-Branch: renovate/dependency-1.x\nChange-Id: Ifcd936eef0ced620040a07a337c586d0a882725b',
        ],
        prTitle: 'pr title',
      });
      expect(git.pushCommit).toHaveBeenCalledExactlyOnceWith({
        files: [],
        sourceRef: 'renovate/dependency-1.x',
        targetRef: 'refs/for/main', // not new-main
        pushOptions: ['notify=NONE', 'ready'],
      });
      expect(git.updateVirtualBranch).toHaveBeenCalledExactlyOnceWith(
        'renovate/dependency-1.x',
      );
    });

    it('commitAndPush() - existing change without new changes', async () => {
      const existingChange = partial<GerritChange>({
        change_id: 'I1bf983f8f6530c44826925b1308a45fe672408a6',
        branch: 'main',
      });
      clientMock.getBranchChange.mockResolvedValueOnce(existingChange);
      git.prepareCommit.mockResolvedValueOnce(null); //no changes

      expect(
        await gerritScm.commitAndPush({
          branchName: 'renovate/dependency-1.x',
          baseBranch: 'main',
          message: ['commit msg'],
          files: [],
          prTitle: 'pr title',
        }),
      ).toBeNull();
      expect(git.prepareCommit).toHaveBeenCalledExactlyOnceWith({
        baseBranch: 'main',
        branchName: 'renovate/dependency-1.x',
        files: [],
        message: [
          'pr title',
          'Renovate-Branch: renovate/dependency-1.x\nChange-Id: I1bf983f8f6530c44826925b1308a45fe672408a6',
        ],
        prTitle: 'pr title',
      });
      expect(git.pushCommit).toHaveBeenCalledTimes(0);
    });

    it('commitAndPush() - existing change with new changes - auto-approve', async () => {
      const existingChange = partial<GerritChange>({
        _number: 123456,
        change_id: 'I1bf983f8f6530c44826925b1308a45fe672408a6',
        branch: 'main',
      });
      clientMock.getBranchChange.mockResolvedValueOnce(existingChange);
      git.prepareCommit.mockResolvedValueOnce({
        commitSha: 'commitSha' as LongCommitSha,
        parentCommitSha: 'parentSha' as LongCommitSha,
        files: [],
      });
      git.pushCommit.mockResolvedValueOnce(true);
      expect(
        await gerritScm.commitAndPush({
          branchName: 'renovate/dependency-1.x',
          baseBranch: 'main',
          message: 'commit msg',
          files: [],
          prTitle: 'pr title',
          autoApprove: true,
        }),
      ).toBe('commitSha');
      expect(git.prepareCommit).toHaveBeenCalledExactlyOnceWith({
        baseBranch: 'main',
        branchName: 'renovate/dependency-1.x',
        files: [],
        message: [
          'pr title',
          'Renovate-Branch: renovate/dependency-1.x\nChange-Id: I1bf983f8f6530c44826925b1308a45fe672408a6',
        ],
        prTitle: 'pr title',
        autoApprove: true,
      });
      expect(git.pushCommit).toHaveBeenCalledExactlyOnceWith({
        files: [],
        sourceRef: 'renovate/dependency-1.x',
        targetRef: 'refs/for/main',
        pushOptions: ['notify=NONE', 'ready', 'label=Code-Review+2'],
      });
      expect(git.updateVirtualBranch).toHaveBeenCalledExactlyOnceWith(
        'renovate/dependency-1.x',
      );
    });
  });
});
