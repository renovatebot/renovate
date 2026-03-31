import { git, partial } from '~test/util.ts';
import type { LongCommitSha } from '../../../util/git/types.ts';
import { client as _client } from './client.ts';
import { GerritScm, configureScm } from './scm.ts';
import type { GerritChange, GerritRevisionInfo } from './types.ts';

vi.mock('./client.ts');
const clientMock = vi.mocked(_client);

describe('modules/platform/gerrit/scm', () => {
  const gerritScm = new GerritScm();

  beforeEach(() => {
    configureScm('test/repo');
  });

  describe('deleteBranch()', async () => {
    await expect(gerritScm.deleteBranch('renovate/test-branch')).toResolve();
    expect(git.deleteVirtualBranch).toHaveBeenCalledExactlyOnceWith(
      'renovate/test-branch',
    );
  });

  describe('mergeToLocal', () => {
    it('uses local merge when there is a pending change branch', async () => {
      // Creates a pending change branch
      clientMock.getBranchChange.mockResolvedValueOnce(null);
      git.prepareCommit.mockResolvedValueOnce({
        commitSha: 'commitSha' as LongCommitSha,
        parentCommitSha: 'parentSha' as LongCommitSha,
        files: [],
      });
      await gerritScm.commitAndPush({
        branchName: 'renovate/onboarding',
        baseBranch: 'main',
        message: 'commit msg',
        files: [],
        prTitle: 'Configure Renovate',
      });

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
          requestDetails: ['CURRENT_REVISION'],
        },
      );
    });

    it('commitAndPush() - create first commit', async () => {
      clientMock.findChanges.mockResolvedValueOnce([]);
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
        force: true,
      });
      // For new changes, push should NOT be called - it will be done by createPr()
      expect(git.pushCommit).not.toHaveBeenCalled();
    });

    it('commitAndPush() - existing change without new changes', async () => {
      const existingChange = partial<GerritChange>({
        change_id: 'Ifcd936eef0ced620040a07a337c586d0a882725b',
        branch: 'main',
        current_revision: 'commitSha' as LongCommitSha,
        revisions: {
          commitSha: partial<GerritRevisionInfo>({ ref: 'refs/changes/1/2' }),
        },
      });
      clientMock.getBranchChange.mockResolvedValueOnce(existingChange);
      git.prepareCommit.mockResolvedValueOnce({
        commitSha: 'commitSha' as LongCommitSha,
        parentCommitSha: 'parentSha' as LongCommitSha,
        files: [],
      });
      git.pushCommit.mockResolvedValueOnce(true);
      git.hasDiff.mockResolvedValueOnce(true);

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
        force: true,
      });
      expect(git.fetchRevSpec).toHaveBeenCalledExactlyOnceWith(
        'refs/changes/1/2',
      );
      expect(git.pushCommit).toHaveBeenCalledExactlyOnceWith({
        files: [],
        sourceRef: 'renovate/dependency-1.x',
        targetRef: 'refs/for/main', // not new-main
        pushOptions: ['notify=NONE', 'ready'],
      });
    });

    it('commitAndPush() - existing change with new changes - auto-approve', async () => {
      const existingChange = partial<GerritChange>({
        _number: 123456,
        change_id: 'I1bf983f8f6530c44826925b1308a45fe672408a6',
        branch: 'main',
        current_revision: 'commitSha' as LongCommitSha,
        revisions: {
          commitSha: partial<GerritRevisionInfo>({ ref: 'refs/changes/1/2' }),
        },
      });
      clientMock.getBranchChange.mockResolvedValueOnce(existingChange);
      git.prepareCommit.mockResolvedValueOnce({
        commitSha: 'commitSha' as LongCommitSha,
        parentCommitSha: 'parentSha' as LongCommitSha,
        files: [],
      });
      git.pushCommit.mockResolvedValueOnce(true);
      git.hasDiff.mockResolvedValueOnce(true);

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
        force: true,
      });
      expect(git.fetchRevSpec).toHaveBeenCalledExactlyOnceWith(
        'refs/changes/1/2',
      );
      expect(git.pushCommit).toHaveBeenCalledExactlyOnceWith({
        files: [],
        sourceRef: 'renovate/dependency-1.x',
        targetRef: 'refs/for/main',
        pushOptions: ['notify=NONE', 'ready', 'label=Code-Review+2'],
      });
    });
  });
});
