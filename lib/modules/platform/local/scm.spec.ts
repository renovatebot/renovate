import { partial } from '~test/util.ts';
import { rawExec as _rawExec } from '../../../util/exec/common.ts';
import type { ExecResult } from '../../../util/exec/types.ts';
import type { CommitFilesConfig } from '../../../util/git/types.ts';
import { LocalFs } from './scm.ts';

vi.mock('glob', () => ({
  glob: vi.fn().mockImplementation(() => Promise.resolve(['file1', 'file2'])),
}));
vi.mock('../../../util/exec/common.ts');
const execMock = vi.mocked(_rawExec);

describe('modules/platform/local/scm', () => {
  let localFs: LocalFs;

  beforeEach(() => {
    localFs = new LocalFs();
  });

  describe('dummy functions', () => {
    it('behindBaseBranch', async () => {
      await expect(localFs.isBranchBehindBase('', '')).resolves.toBe(false);
    });

    it('isBranchModified', async () => {
      await expect(localFs.isBranchModified('', '')).resolves.toBe(false);
    });

    it('isBranchConflicted', async () => {
      await expect(localFs.isBranchConflicted('', '')).resolves.toBe(false);
    });

    it('branchExists', async () => {
      await expect(localFs.branchExists('')).resolves.toBe(true);
    });

    it('getBranchCommit', async () => {
      await expect(localFs.getBranchCommit('')).resolves.toBeNull();
    });

    it('getBranchUpdateDate', async () => {
      await expect(localFs.getBranchUpdateDate('')).resolves.toBeNull();
    });

    it('getAllBranchUpdateDates', async () => {
      await expect(localFs.getAllBranchUpdateDates()).resolves.toEqual({});
    });

    it('deleteBranch', async () => {
      await expect(localFs.deleteBranch('')).resolves.toBeUndefined();
    });

    it('commitAndPush', async () => {
      await expect(
        localFs.commitAndPush(partial<CommitFilesConfig>()),
      ).resolves.toBeNull();
    });

    it('checkoutBranch', async () => {
      await expect(localFs.checkoutBranch('')).resolves.toBeNull();
    });
  });

  describe('getFileList', () => {
    it('should return file list using git', async () => {
      execMock.mockReturnValueOnce(
        Promise.resolve(
          partial<ExecResult>({
            stdout: 'file1\nfile2',
          }),
        ),
      );
      await expect(localFs.getFileList()).resolves.toHaveLength(2);

      expect(execMock).toHaveBeenCalledExactlyOnceWith('git ls-files', {
        maxBuffer: 1024 * 1024 * 10,
      });
    });

    it('should return file list using glob', async () => {
      execMock.mockImplementationOnce(() => {
        throw new Error();
      });

      await expect(localFs.getFileList()).resolves.toHaveLength(2);
    });
  });

  it('mergeAndPush', async () => {
    await expect(localFs.mergeAndPush('branchName')).resolves.toBeUndefined();
  });

  it('mergeBranch', async () => {
    await expect(localFs.mergeToLocal('branchName')).resolves.toBeUndefined();
  });
});
