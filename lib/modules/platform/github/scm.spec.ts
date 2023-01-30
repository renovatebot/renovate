import { git, mocked } from '../../../../test/util';
import githubScm from './scm';
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
    await githubScm.commitAndPush!({ ...commitObj, platformCommit: false });

    expect(git.commitFiles).toHaveBeenCalledWith({
      ...commitObj,
      platformCommit: false,
    });
    expect(github.commitFiles).not.toHaveBeenCalled();
  });

  it('platformCommit = true => delegate to github', async () => {
    await githubScm.commitAndPush!({ ...commitObj, platformCommit: true });

    expect(git.commitFiles).not.toHaveBeenCalled();
    expect(github.commitFiles).toHaveBeenCalledWith({
      ...commitObj,
      platformCommit: true,
    });
  });
});
