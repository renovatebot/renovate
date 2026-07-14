import { git } from '~test/util.ts';
import type { CommitFilesConfig } from '../../../util/git/types.ts';
import type { LongCommitSha } from '../../../util/schema-utils/git.ts';
import * as _github from './index.ts';
import { GithubScm } from './scm.ts';

vi.mock('./index.ts');
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

  it('delegates to git when platformCommit is disabled', async () => {
    github.isPlatformCommitEnabled.mockReturnValueOnce(false);

    await githubScm.commitAndPush(commitObj);

    expect(git.commitFiles).toHaveBeenCalledExactlyOnceWith(commitObj);
    expect(github.commitFiles).not.toHaveBeenCalled();
  });

  it('delegates to github when platformCommit is enabled', async () => {
    github.isPlatformCommitEnabled.mockReturnValueOnce(true);

    await githubScm.commitAndPush(commitObj);

    expect(git.commitFiles).not.toHaveBeenCalled();
    expect(github.commitFiles).toHaveBeenCalledExactlyOnceWith(commitObj);
  });
});
