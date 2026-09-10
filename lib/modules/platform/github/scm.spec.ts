import { fakeSha, git } from '~test/util.ts';
import { PR_ALREADY_IN_MERGE_QUEUE } from '../../../constants/error-messages.ts';
import type { CommitFilesConfig } from '../../../util/git/types.ts';
import * as _github from './index.ts';
import { GithubScm } from './scm.ts';

vi.mock('./index.ts');
const github = vi.mocked(_github);

describe('modules/platform/github/scm', () => {
  beforeEach(() => {
    git.commitFiles.mockResolvedValue(fakeSha('sha'));
  });

  const githubScm = new GithubScm();

  const commitObj = {
    baseBranch: 'main',
    branchName: 'branch',
    files: [],
    message: 'msg',
  } satisfies CommitFilesConfig;

  it('platformCommit = disabled => delegate to git', async () => {
    await githubScm.commitAndPush({
      ...commitObj,
      platformCommit: 'disabled',
    });

    expect(git.commitFiles).toHaveBeenCalledExactlyOnceWith({
      ...commitObj,
      platformCommit: 'disabled',
    });
    expect(github.commitFiles).not.toHaveBeenCalled();
  });

  it('platformCommit = enabled => delegate to github', async () => {
    await githubScm.commitAndPush({
      ...commitObj,
      platformCommit: 'enabled',
    });

    expect(git.commitFiles).not.toHaveBeenCalled();
    expect(github.commitFiles).toHaveBeenCalledExactlyOnceWith({
      ...commitObj,
      platformCommit: 'enabled',
    });
  });

  it('platformCommit = auto => delegate to git', async () => {
    await githubScm.commitAndPush({
      ...commitObj,
      platformCommit: 'auto',
    });

    expect(git.commitFiles).toHaveBeenCalledExactlyOnceWith({
      ...commitObj,
      platformCommit: 'auto',
    });
    expect(github.commitFiles).not.toHaveBeenCalled();
  });

  it('platformCommit = auto and is a github app => delegate to github', async () => {
    github.isGHApp.mockReturnValueOnce(true);

    await githubScm.commitAndPush({
      ...commitObj,
      platformCommit: 'auto',
    });

    expect(git.commitFiles).not.toHaveBeenCalled();
    expect(github.commitFiles).toHaveBeenCalledExactlyOnceWith({
      ...commitObj,
      platformCommit: 'auto',
    });
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

    expect(git.commitFiles).not.toHaveBeenCalled();
    expect(github.commitFiles).not.toHaveBeenCalled();
  });
});
