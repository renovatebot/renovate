import { git, mocked } from '../../../../test/util';
import type { CommitFilesConfig, LongCommitSha } from '../../../util/git/types';
import { GithubScm } from './scm';
import * as _github from '.';

jest.mock('.');
const github = mocked(_github);

describe('modules/platform/github/scm', () => {
  beforeEach(() => {
    jest.spyOn(git, 'commitFiles').mockResolvedValue('sha' as LongCommitSha);
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

  describe('sanitize mentions in commit messages', () => {
    it('single string', async () => {
      await githubScm.commitAndPush({
        ...commitObj,
        message: 'Use @octokit to irritate @octocat',
        platformCommit: 'enabled',
      });

      expect(git.commitFiles).not.toHaveBeenCalled();
      expect(github.commitFiles).toHaveBeenCalledWith({
        ...commitObj,
        message: 'Use @\u{8203}octokit to irritate @\u{8203}octocat',
        platformCommit: 'enabled',
      });
    });

    it('array of string', async () => {
      await githubScm.commitAndPush({
        ...commitObj,
        message: ['Use @octokit', 'It automates the way we irritate @octocat'],
        platformCommit: 'enabled',
      });

      expect(git.commitFiles).not.toHaveBeenCalled();
      expect(github.commitFiles).toHaveBeenCalledWith({
        ...commitObj,
        message: [
          'Use @\u{8203}octokit',
          'It automates the way we irritate @\u{8203}octocat',
        ],
        platformCommit: 'enabled',
      });
    });
  });
});
