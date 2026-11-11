import { fakeSha, git } from '~test/util.ts';
import { PR_ALREADY_IN_MERGE_QUEUE } from '../../../constants/error-messages.ts';
import type { CommitFilesConfig } from '../../../util/git/types.ts';
import * as _github from './index.ts';
import { GithubScm } from './scm.ts';

vi.mock('./index.ts');
const github = vi.mocked(_github);
const actualGithub = await vi.importActual<typeof _github>('./index.ts');

describe('modules/platform/github/scm', () => {
  beforeEach(() => {
    git.commitFiles.mockResolvedValue(fakeSha('sha'));
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

  it('replaces links in the commit message', async () => {
    const message = [
      'chore(deps): update dependency renovate to v44.220.0',
      '- **config:** add option ([#43916](https://github.com/renovatebot/renovate/issues/43916)), closes https://github.com/renovatebot/renovate/pull/1',
    ];

    await githubScm.commitAndPush({ ...commitObj, message });

    expect(git.commitFiles).toHaveBeenCalledExactlyOnceWith({
      ...commitObj,
      message: [
        'chore(deps): update dependency renovate to v44.220.0',
        '- **config:** add option ([#43916](https://redirect.github.com/renovatebot/renovate/issues/43916)), closes https://redirect.github.com/renovatebot/renovate/pull/1',
      ],
    });
  });

  it('replaces links in the commit message when using platformCommit', async () => {
    await githubScm.commitAndPush({
      ...commitObj,
      message: 'fix https://github.com/foo/bar/issues/1',
      platformCommit: 'enabled',
    });

    expect(github.commitFiles).toHaveBeenCalledExactlyOnceWith({
      ...commitObj,
      message: 'fix https://redirect.github.com/foo/bar/issues/1',
      platformCommit: 'enabled',
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
