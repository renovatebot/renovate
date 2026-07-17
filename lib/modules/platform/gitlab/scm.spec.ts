import { git } from '~test/util.ts';
import type { CommitFilesConfig } from '../../../util/git/types.ts';
import type { LongCommitSha } from '../../../util/schema-utils/git.ts';
import * as _gitlab from './index.ts';
import { GitlabScm } from './scm.ts';

vi.mock('./index.ts');
const gitlab = vi.mocked(_gitlab);

describe('modules/platform/gitlab/scm', () => {
  beforeEach(() => {
    git.commitFiles.mockResolvedValue('sha' as LongCommitSha);
  });

  const gitlabScm = new GitlabScm();

  const commitObj = {
    baseBranch: 'main',
    branchName: 'branch',
    files: [],
    message: 'msg',
  } satisfies CommitFilesConfig;

  it('platformCommit = disabled => delegate to git', async () => {
    await gitlabScm.commitAndPush({
      ...commitObj,
      platformCommit: 'disabled',
    });

    expect(git.commitFiles).toHaveBeenCalledExactlyOnceWith({
      ...commitObj,
      platformCommit: 'disabled',
    });
    expect(gitlab.commitFiles).not.toHaveBeenCalled();
  });

  it('platformCommit = enabled => delegate to gitlab', async () => {
    await gitlabScm.commitAndPush({
      ...commitObj,
      platformCommit: 'enabled',
    });

    expect(git.commitFiles).not.toHaveBeenCalled();
    expect(gitlab.commitFiles).toHaveBeenCalledExactlyOnceWith({
      ...commitObj,
      platformCommit: 'enabled',
    });
  });

  it('platformCommit = auto => delegate to git', async () => {
    await gitlabScm.commitAndPush({
      ...commitObj,
      platformCommit: 'auto',
    });

    expect(git.commitFiles).toHaveBeenCalledExactlyOnceWith({
      ...commitObj,
      platformCommit: 'auto',
    });
    expect(gitlab.commitFiles).not.toHaveBeenCalled();
  });
});
