import { git, platform } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import { tryBranchAutomerge } from '../../../workers/repository/update/branch/automerge.ts';
import { scm, setPlatformScmApi } from '../scm.ts';

vi.unmock('../scm.ts');

describe('modules/platform/oci/scm', () => {
  beforeEach(() => {
    GlobalConfig.reset();
    setPlatformScmApi('oci');
  });

  it('rejects branch automerge without merging or pushing', async () => {
    await expect(scm.mergeAndPush('renovate/dep')).rejects.toThrow(
      'OCI branch automerge is not supported; merge pull requests manually',
    );

    expect(git.mergeBranch).not.toHaveBeenCalled();
  });

  it('prevents the branch automerge worker from merging when tests are ignored', async () => {
    platform.getBranchPr.mockResolvedValueOnce(null);

    const result = await tryBranchAutomerge({
      automerge: true,
      automergeType: 'branch',
      ignoreTests: true,
      branchName: 'renovate/dep',
      baseBranch: 'main',
    });

    expect(result).toBe('failed');
    expect(git.mergeBranch).not.toHaveBeenCalled();
  });
});
