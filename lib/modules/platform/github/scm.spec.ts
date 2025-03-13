import type { CommitFilesConfig, LongCommitSha } from '../../../util/git/types';
import { GithubScm } from './scm';
import * as _github from '.';
import { git } from '~test/util';

vi.mock('.');
const github = vi.mocked(_github);

describe('modules/platform/github/scm', () => {
  beforeEach(() => {
    git.commitFiles.mockResolvedValue('sha' as LongCommitSha);
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

    expect(git.commitFiles).toHaveBeenCalledWith({
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
    expect(github.commitFiles).toHaveBeenCalledWith({
      ...commitObj,
      platformCommit: 'enabled',
    });
  });

  it('platformCommit = auto => delegate to git', async () => {
    await githubScm.commitAndPush({
      ...commitObj,
      platformCommit: 'auto',
    });

    expect(git.commitFiles).toHaveBeenCalledWith({
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
    expect(github.commitFiles).toHaveBeenCalledWith({
      ...commitObj,
      platformCommit: 'auto',
    });
  });
});
