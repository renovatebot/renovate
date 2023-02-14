import { git, mocked } from '../../../../test/util';
import { DefaultGitScm } from '../default-scm';
import { GithubScm } from './scm';
import * as _github from '.';

jest.mock('.');
const github = mocked(_github);

describe('modules/platform/github/scm', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    git.commitFiles = jest.fn();
  });

  const commitObj = {
    baseBranch: 'main',
    branchName: 'branch',
    files: [],
    message: 'msg',
  };

  it('platformCommit = false => delegate to git', async () => {
    await GithubScm.instance.commitAndPush({
      ...commitObj,
      platformCommit: false,
    });

    expect(git.commitFiles).toHaveBeenCalledWith({
      ...commitObj,
      platformCommit: false,
    });
    expect(github.commitFiles).not.toHaveBeenCalled();
  });

  it('platformCommit = true => delegate to github', async () => {
    await GithubScm.instance.commitAndPush({
      ...commitObj,
      platformCommit: true,
    });

    expect(git.commitFiles).not.toHaveBeenCalled();
    expect(github.commitFiles).toHaveBeenCalledWith({
      ...commitObj,
      platformCommit: true,
    });
  });

  it('check overridden singleton instance', () => {
    expect(DefaultGitScm.instance instanceof GithubScm).toBeFalse();
    expect(GithubScm.instance instanceof GithubScm).toBeTrue();
  });
});
