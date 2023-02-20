import { git, mocked } from '../../../../test/util';
import type { CommitFilesConfig } from '../../../util/git/types';
import { GithubScm } from './scm';
import * as _github from '.';

jest.mock('.');
const github = mocked(_github);

describe('modules/platform/github/scm', () => {
  beforeEach(() => {
    jest.spyOn(git, 'commitFiles').mockResolvedValue('sha');
  });

  const githubScm = new GithubScm();

  const commitObj = {
    baseBranch: 'main',
    branchName: 'branch',
    files: [],
    message: 'msg',
  } satisfies CommitFilesConfig;

  it('platformCommit = false => delegate to git', async () => {
    await githubScm.commitAndPush({
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
    await githubScm.commitAndPush({
      ...commitObj,
      platformCommit: true,
    });

    expect(git.commitFiles).not.toHaveBeenCalled();
    expect(github.commitFiles).toHaveBeenCalledWith({
      ...commitObj,
      platformCommit: true,
    });
  });
});
