import { partial } from '~test/util.ts';
import { rawExec as _rawExec } from '../../../util/exec/common.ts';
import type { ExecResult } from '../../../util/exec/types.ts';
import { LocalFs } from './scm.ts';

vi.mock('glob', () => ({
  glob: vi.fn().mockImplementation(() => Promise.resolve(['file1', 'file2'])),
}));
vi.mock('../../../util/exec/common.ts');
const execSync = vi.mocked(_rawExec);

describe('modules/platform/local/scm', () => {
  let localFs: LocalFs;

  beforeEach(() => {
    localFs = new LocalFs();
  });

  describe('dummy functions', () => {
    it('behindBaseBranch', async () => {
      expect(await localFs.isBranchBehindBase('', '')).toBe(false);
    });

    it('isBranchModified', async () => {
      expect(await localFs.isBranchModified('', '')).toBe(false);
    });

    it('isBranchConflicted', async () => {
      expect(await localFs.isBranchConflicted('', '')).toBe(false);
    });

    it('branchExists', async () => {
      expect(await localFs.branchExists('')).toBe(true);
    });

    it('getBranchCommit', async () => {
      expect(await localFs.getBranchCommit('')).toBeNull();
    });

    it('getBranchUpdateDate', async () => {
      expect(await localFs.getBranchUpdateDate('')).toBeNull();
    });

    it('deleteBranch', async () => {
      expect(await localFs.deleteBranch('')).toBeUndefined();
    });

    it('commitAndPush', async () => {
      expect(await localFs.commitAndPush({} as any)).toBeNull();
    });

    it('checkoutBranch', async () => {
      expect(await localFs.checkoutBranch('')).toBe('');
    });
  });

  describe('getFileList', () => {
    it('should return file list using git', async () => {
      execSync.mockReturnValueOnce(
        Promise.resolve(
          partial<ExecResult>({
            stdout: 'file1\nfile2',
          }),
        ),
      );
      expect(await localFs.getFileList()).toHaveLength(2);

      expect(execSync).toHaveBeenCalledExactlyOnceWith('git ls-files', {
        maxBuffer: 1024 * 1024 * 10,
      });
    });

    it('should return file list using glob', async () => {
      execSync.mockImplementationOnce(() => {
        throw new Error();
      });

      expect(await localFs.getFileList()).toHaveLength(2);
    });
  });

  it('mergeAndPush', async () => {
    await expect(localFs.mergeAndPush('branchName')).resolves.toBeUndefined();
  });

  it('mergeBranch', async () => {
    await expect(localFs.mergeToLocal('branchName')).resolves.toBeUndefined();
  });
});
