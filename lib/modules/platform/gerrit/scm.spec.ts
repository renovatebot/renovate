import type { LongCommitSha } from '../../../util/git/types';
import { client as _client } from './client';
import { GerritScm, configureScm } from './scm';

import type { GerritChange, GerritRevisionInfo } from './types';
import { git, partial } from '~test/util';

vi.mock('./client');
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
      clientMock.findChanges.mockResolvedValueOnce([]);
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
      expect(clientMock.findChanges).toHaveBeenCalledExactlyOnceWith(
        'test/repo',
        {
          branchName: 'renovate/dependency-1.x',
          state: 'open',
          targetBranch: 'main',
          singleChange: true,
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

    it('commitFiles() - existing change-set without new changes', async () => {
      const existingChange = partial<GerritChange>({
        change_id: '...',
        current_revision: 'commitSha',
        revisions: {
          commitSha: partial<GerritRevisionInfo>({ ref: 'refs/changes/1/2' }),
        },
      });
      clientMock.findChanges.mockResolvedValueOnce([existingChange]);
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
          'Renovate-Branch: renovate/dependency-1.x\nChange-Id: ...',
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
        change_id: '...',
        current_revision: 'commitSha',
        revisions: {
          commitSha: partial<GerritRevisionInfo>({ ref: 'refs/changes/1/2' }),
        },
      });
      clientMock.findChanges.mockResolvedValueOnce([existingChange]);
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
          'Renovate-Branch: renovate/dependency-1.x\nChange-Id: ...',
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
        change_id: '...',
        current_revision: 'commitSha',
        revisions: {
          commitSha: partial<GerritRevisionInfo>({ ref: 'refs/changes/1/2' }),
        },
      });
      clientMock.findChanges.mockResolvedValueOnce([existingChange]);
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
          'Renovate-Branch: renovate/dependency-1.x\nChange-Id: ...',
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
