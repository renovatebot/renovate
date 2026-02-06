import type { LongCommitSha } from '../../../util/git/types.ts';
import { client as _client } from './client.ts';
import { GerritScm, configureScm } from './scm.ts';
import type { GerritChange, GerritRevisionInfo } from './types.ts';
import { git, partial } from '~test/util.ts';

vi.mock('./client.ts');
const clientMock = vi.mocked(_client);

describe('modules/platform/gerrit/scm', () => {
  const gerritScm = new GerritScm();

  beforeEach(() => {
    configureScm('test/repo');
  });

  describe('deleteBranch()', () => {
    it('should call git.deleteVirtualBranch', async () => {
      await gerritScm.deleteBranch('renovate/test-branch');

      expect(git.deleteVirtualBranch).toHaveBeenCalledExactlyOnceWith(
        'renovate/test-branch',
      );
    });
  });

  describe('commitFiles()', () => {
    it('commitFiles() - empty commit', async () => {
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

    it('commitFiles() - create first Patch', async () => {
      clientMock.findChanges.mockResolvedValueOnce([]);
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
      expect(git.pushCommit).toHaveBeenCalledExactlyOnceWith({
        files: [],
        sourceRef: 'renovate/dependency-1.x',
        targetRef: 'refs/for/main',
        pushOptions: ['notify=NONE'],
      });
    });

    it('commitFiles() - create first Patch - auto approve', async () => {
      clientMock.findChanges.mockResolvedValueOnce([]);
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
          expect.stringMatching(
            /^Renovate-Branch: renovate\/dependency-1\.x\nChange-Id: I[a-z0-9]{40}$/,
          ),
        ],
        prTitle: 'pr title',
        autoApprove: true,
        force: true,
      });
      expect(git.pushCommit).toHaveBeenCalledExactlyOnceWith({
        files: [],
        sourceRef: 'renovate/dependency-1.x',
        targetRef: 'refs/for/main',
        pushOptions: ['notify=NONE', 'label=Code-Review+2'],
      });
    });

    it('commitFiles() - existing change should keep target branch', async () => {
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
        pushOptions: ['notify=NONE'],
      });
    });

    it('commitFiles() - existing change-set without new changes', async () => {
      const existingChange = partial<GerritChange>({
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
      git.hasDiff.mockResolvedValueOnce(false); //no changes

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
        force: true,
      });
      expect(git.fetchRevSpec).toHaveBeenCalledExactlyOnceWith(
        'refs/changes/1/2',
      );
      expect(git.pushCommit).toHaveBeenCalledTimes(0);
    });

    it('commitFiles() - existing change-set with new changes - auto-approve again', async () => {
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
        pushOptions: ['notify=NONE', 'label=Code-Review+2'],
      });
    });

    it('commitFiles() - create first patch - with labels', async () => {
      clientMock.findChanges.mockResolvedValueOnce([]);
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
          labels: ['hashtag1', 'hashtag2'],
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
        autoApprove: true,
        force: true,
        labels: ['hashtag1', 'hashtag2'],
      });
      expect(git.pushCommit).toHaveBeenCalledExactlyOnceWith({
        files: [],
        sourceRef: 'renovate/dependency-1.x',
        targetRef: 'refs/for/main',
        pushOptions: [
          'notify=NONE',
          'label=Code-Review+2',
          'hashtag=hashtag1',
          'hashtag=hashtag2',
        ],
      });
    });

    it('commitFiles() - existing change-set with new changes - ensure labels', async () => {
      const existingChange = partial<GerritChange>({
        _number: 123456,
        change_id: 'If5689d5a0e5b7e5207ee943e4ba8857bff6f05c9',
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
          labels: ['hashtag1', 'hashtag2'],
        }),
      ).toBe('commitSha');
      expect(git.prepareCommit).toHaveBeenCalledExactlyOnceWith({
        baseBranch: 'main',
        branchName: 'renovate/dependency-1.x',
        files: [],
        message: [
          'pr title',
          'Renovate-Branch: renovate/dependency-1.x\nChange-Id: If5689d5a0e5b7e5207ee943e4ba8857bff6f05c9',
        ],
        prTitle: 'pr title',
        autoApprove: true,
        force: true,
        labels: ['hashtag1', 'hashtag2'],
      });
      expect(git.fetchRevSpec).toHaveBeenCalledExactlyOnceWith(
        'refs/changes/1/2',
      );
      expect(git.pushCommit).toHaveBeenCalledExactlyOnceWith({
        files: [],
        sourceRef: 'renovate/dependency-1.x',
        targetRef: 'refs/for/main',
        pushOptions: [
          'notify=NONE',
          'label=Code-Review+2',
          'hashtag=hashtag1',
          'hashtag=hashtag2',
        ],
      });
    });
  });
});
