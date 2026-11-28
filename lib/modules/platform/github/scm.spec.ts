import { fakeSha, git, logger } from '~test/util.ts';
import { PR_ALREADY_IN_MERGE_QUEUE } from '../../../constants/error-messages.ts';
import type {
  CommitFilesConfig,
  CommitResult,
} from '../../../util/git/types.ts';
import * as _github from './index.ts';
import { GithubScm } from './scm.ts';

vi.mock('./index.ts');
const github = vi.mocked(_github);
const actualGithub = await vi.importActual<typeof _github>('./index.ts');

describe('modules/platform/github/scm', () => {
  const commitResult = {
    parentCommitSha: fakeSha('parent'),
    commitSha: fakeSha('commit'),
    files: [],
  } satisfies CommitResult;

  beforeEach(() => {
    git.prepareCommit.mockResolvedValue(commitResult);
    git.pushPreparedCommit.mockResolvedValue(fakeSha('commit'));
    github.pushCommitFiles.mockResolvedValue(fakeSha('remote'));
    github.massageCommitMessage.mockImplementation(
      actualGithub.massageCommitMessage,
    );
  });

  const githubScm = new GithubScm();

  const commitObj = {
    baseBranch: 'main',
    branchName: 'branch',
    files: [],
    message: 'msg',
  } satisfies CommitFilesConfig;

  describe('prepareCommit()', () => {
    it('returns the prepared commit without pushing it', async () => {
      const res = await githubScm.prepareCommit(commitObj);

      expect(res?.sha).toBe(fakeSha('commit'));
      expect(git.prepareCommit).toHaveBeenCalledExactlyOnceWith(commitObj);
      expect(git.pushPreparedCommit).not.toHaveBeenCalled();
      expect(github.pushCommitFiles).not.toHaveBeenCalled();
    });

    it('returns null if there is nothing to commit', async () => {
      git.prepareCommit.mockResolvedValueOnce(null);

      const res = await githubScm.prepareCommit(commitObj);

      expect(res).toBeNull();
      expect(logger.logger.debug).not.toHaveBeenCalledWith(
        expect.anything(),
        'Platform-native commit: unable to prepare for commit',
      );
    });

    it('returns null and logs if there is nothing to commit using platformCommit', async () => {
      git.prepareCommit.mockResolvedValueOnce(null);

      const res = await githubScm.prepareCommit({
        ...commitObj,
        files: [
          { type: 'addition', path: 'foo.bar', contents: 'foobar' },
          { type: 'deletion', path: 'baz' },
        ],
        platformCommit: 'enabled',
      });

      expect(res).toBeNull();
      expect(logger.logger.debug).toHaveBeenCalledWith(
        { branchName: 'branch', files: ['foo.bar', 'baz'] },
        'Platform-native commit: unable to prepare for commit',
      );
    });
  });

  describe('commitAndPush()', () => {
    it('platformCommit = disabled => delegate to git', async () => {
      const res = await githubScm.commitAndPush({
        ...commitObj,
        platformCommit: 'disabled',
      });

      expect(res).toBe(fakeSha('commit'));
      expect(git.pushPreparedCommit).toHaveBeenCalledExactlyOnceWith(
        { ...commitObj, platformCommit: 'disabled' },
        commitResult,
      );
      expect(github.pushCommitFiles).not.toHaveBeenCalled();
    });

    it('platformCommit = enabled => delegate to github', async () => {
      const res = await githubScm.commitAndPush({
        ...commitObj,
        platformCommit: 'enabled',
      });

      expect(res).toBe(fakeSha('remote'));
      expect(git.pushPreparedCommit).not.toHaveBeenCalled();
      expect(github.pushCommitFiles).toHaveBeenCalledExactlyOnceWith(
        { ...commitObj, platformCommit: 'enabled' },
        commitResult,
      );
    });

    it('platformCommit = auto => delegate to git', async () => {
      await githubScm.commitAndPush({
        ...commitObj,
        platformCommit: 'auto',
      });

      expect(git.pushPreparedCommit).toHaveBeenCalledExactlyOnceWith(
        { ...commitObj, platformCommit: 'auto' },
        commitResult,
      );
      expect(github.pushCommitFiles).not.toHaveBeenCalled();
    });

    it('platformCommit = auto and is a github app => delegate to github', async () => {
      github.isGHApp.mockReturnValueOnce(true);

      await githubScm.commitAndPush({
        ...commitObj,
        platformCommit: 'auto',
      });

      expect(git.pushPreparedCommit).not.toHaveBeenCalled();
      expect(github.pushCommitFiles).toHaveBeenCalledExactlyOnceWith(
        { ...commitObj, platformCommit: 'auto' },
        commitResult,
      );
    });

    it('replaces links in the commit message', async () => {
      const message = [
        'chore(deps): update dependency renovate to v44.220.0',
        '- **config:** add option ([#43916](https://github.com/renovatebot/renovate/issues/43916)), closes https://github.com/renovatebot/renovate/pull/1',
      ];
      const massagedConfig = {
        ...commitObj,
        message: [
          'chore(deps): update dependency renovate to v44.220.0',
          '- **config:** add option ([#43916](https://redirect.github.com/renovatebot/renovate/issues/43916)), closes https://redirect.github.com/renovatebot/renovate/pull/1',
        ],
      };

      await githubScm.commitAndPush({ ...commitObj, message });

      expect(git.prepareCommit).toHaveBeenCalledExactlyOnceWith(massagedConfig);
      expect(git.pushPreparedCommit).toHaveBeenCalledExactlyOnceWith(
        massagedConfig,
        commitResult,
      );
    });

    it('replaces links in the commit message when using platformCommit', async () => {
      await githubScm.commitAndPush({
        ...commitObj,
        message: 'fix https://github.com/foo/bar/issues/1',
        platformCommit: 'enabled',
      });

      expect(github.pushCommitFiles).toHaveBeenCalledExactlyOnceWith(
        {
          ...commitObj,
          message: 'fix https://redirect.github.com/foo/bar/issues/1',
          platformCommit: 'enabled',
        },
        commitResult,
      );
    });

    it('checks the merge queue before committing', async () => {
      await githubScm.commitAndPush(commitObj);

      expect(github.assertPrNotInMergeQueue).toHaveBeenCalledExactlyOnceWith(
        'branch',
        'main',
      );
    });

    it('does not commit if the branch PR is in the merge queue', async () => {
      github.assertPrNotInMergeQueue.mockRejectedValueOnce(
        new Error(PR_ALREADY_IN_MERGE_QUEUE),
      );

      await expect(githubScm.commitAndPush(commitObj)).rejects.toThrow(
        PR_ALREADY_IN_MERGE_QUEUE,
      );

      expect(git.prepareCommit).not.toHaveBeenCalled();
      expect(git.pushPreparedCommit).not.toHaveBeenCalled();
      expect(github.pushCommitFiles).not.toHaveBeenCalled();
    });
  });
});
