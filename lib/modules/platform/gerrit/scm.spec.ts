import { fakeSha, git, partial } from '~test/util.ts';
import { client as _client } from './client.ts';
import type { GerritChange, GerritRevisionInfo } from './schema.ts';
import {
  GerritScm,
  configureScm,
  nextPatchSetRef,
  pushForReview,
} from './scm.ts';

vi.mock('./client.ts');
const clientMock = vi.mocked(_client);

describe('modules/platform/gerrit/scm', () => {
  const gerritScm = new GerritScm();
  const commitSha = fakeSha('commitSha');
  const parentCommitSha = fakeSha('parentSha');
  const currentRevision = fakeSha('abc123');

  beforeEach(() => {
    configureScm('test/repo');
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
    });

    it('returns false when push fails', async () => {
      git.pushCommit.mockResolvedValueOnce(false);
      await expect(
        pushForReview({
          sourceRef: 'renovate/feat',
          targetBranch: 'main',
          files: [],
        }),
      ).resolves.toBeFalse();
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

    it('commitAndPush() - create first commit but does not push', async () => {
      clientMock.getBranchChange.mockResolvedValueOnce(null);
      git.prepareCommit.mockResolvedValueOnce({
        commitSha,
        parentCommitSha,
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
      ).toBe(commitSha);
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
    });

    it('commitAndPush() - existing change keeps original target branch', async () => {
      const existingChange = partial<GerritChange>({
        change_id: 'Ifcd936eef0ced620040a07a337c586d0a882725b',
        branch: 'main',
        current_revision: currentRevision,
        revisions: {
          [currentRevision]: partial<GerritRevisionInfo>({
            ref: 'refs/changes/56/123456/2',
          }),
        },
      });
      clientMock.getBranchChange.mockResolvedValueOnce(existingChange);
      git.prepareCommit.mockResolvedValueOnce({
        commitSha,
        parentCommitSha,
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
      ).toBe(commitSha);
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
      expect(git.setVirtualBranch).toHaveBeenCalledExactlyOnceWith(
        'renovate/dependency-1.x',
        'refs/changes/56/123456/3',
        commitSha,
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
      expect(git.pushCommit).not.toHaveBeenCalled();
    });

    it('commitAndPush() - existing change with new changes - auto-approve', async () => {
      const existingChange = partial<GerritChange>({
        _number: 123456,
        change_id: 'I1bf983f8f6530c44826925b1308a45fe672408a6',
        branch: 'main',
        current_revision: currentRevision,
        revisions: {
          [currentRevision]: partial<GerritRevisionInfo>({
            ref: 'refs/changes/56/123456/2',
          }),
        },
      });
      clientMock.getBranchChange.mockResolvedValueOnce(existingChange);
      git.prepareCommit.mockResolvedValueOnce({
        commitSha,
        parentCommitSha,
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
      ).toBe(commitSha);
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
      expect(git.setVirtualBranch).toHaveBeenCalledExactlyOnceWith(
        'renovate/dependency-1.x',
        'refs/changes/56/123456/3',
        commitSha,
      );
    });
  });

  describe('nextPatchSetRef()', () => {
    it('increments patchset 1', () => {
      expect(nextPatchSetRef('refs/changes/45/12345/1')).toBe(
        'refs/changes/45/12345/2',
      );
    });

    it('increments patchset 9 to 10', () => {
      expect(nextPatchSetRef('refs/changes/45/12345/9')).toBe(
        'refs/changes/45/12345/10',
      );
    });

    it('increments double-digit patchset', () => {
      expect(nextPatchSetRef('refs/changes/00/100/42')).toBe(
        'refs/changes/00/100/43',
      );
    });
  });
});
