import { fs, partial } from '~test/util.ts';
import * as _tidy from '../../../../modules/manager/gomod/post-update/tidy.ts';
import type { FileChange } from '../../../../util/git/types.ts';
import type { BranchConfig } from '../../../types.ts';
import executePostUpdateOptions from './execute-post-update-options.ts';

vi.mock('../../../../modules/manager/gomod/post-update/tidy.ts');
vi.mock('../../../../util/fs/index.ts');

const tidy = vi.mocked(_tidy);

function baseConfig(overrides: Partial<BranchConfig> = {}): BranchConfig {
  return partial<BranchConfig>({
    manager: 'gomod',
    branchName: 'renovate/go-modules',
    baseBranch: 'main',
    upgrades: [],
    postUpdateOptions: ['gomodTidy'],
    updatedPackageFiles: [],
    updatedArtifacts: [],
    artifactErrors: [],
    ...overrides,
  });
}

describe('workers/repository/update/branch/execute-post-update-options', () => {
  it('returns null when there are no updated package files or artifacts', async () => {
    await expect(executePostUpdateOptions(baseConfig())).resolves.toBeNull();

    expect(tidy.executeGoModTidy).not.toHaveBeenCalled();
  });

  it('returns null when no supported Go tidy option is configured', async () => {
    await expect(
      executePostUpdateOptions(
        baseConfig({
          updatedPackageFiles: [
            {
              type: 'addition',
              path: 'go.mod',
              contents: 'module example.com/test',
            },
          ],
          postUpdateOptions: ['someOtherOption'],
        }),
      ),
    ).resolves.toBeNull();

    expect(tidy.executeGoModTidy).not.toHaveBeenCalled();
  });

  it('returns null for a non-Go manager', async () => {
    await expect(
      executePostUpdateOptions(
        baseConfig({
          manager: 'npm',
          updatedPackageFiles: [
            { type: 'addition', path: 'package.json', contents: '{}' },
          ],
        }),
      ),
    ).resolves.toBeNull();

    expect(tidy.executeGoModTidy).not.toHaveBeenCalled();
  });

  it('writes updated files before running Go tidy and merges the result', async () => {
    const packageFile: FileChange = {
      type: 'addition',
      path: 'go.mod',
      contents: 'module example.com/test',
    };
    const existingArtifact: FileChange = {
      type: 'addition',
      path: 'vendor/modules.txt',
      contents: 'vendor contents',
    };
    const deletedFile: FileChange = { type: 'deletion', path: 'old.go' };
    const symlink: FileChange = {
      type: 'addition',
      path: 'go.mod.link',
      contents: 'go.mod',
      isSymlink: true,
    };
    const tidiedSum: FileChange = {
      type: 'addition',
      path: 'go.sum',
      contents: 'tidied sum',
    };
    const tidyError = { fileName: 'go.mod', stderr: 'go mod tidy failed' };

    fs.localPathIsFile.mockResolvedValue(true);
    tidy.executeGoModTidy.mockResolvedValue({
      updatedArtifacts: [tidiedSum],
      artifactErrors: [tidyError],
    });

    const result = await executePostUpdateOptions(
      baseConfig({
        updatedPackageFiles: [packageFile, deletedFile, symlink],
        updatedArtifacts: [existingArtifact],
      }),
    );

    expect(fs.writeLocalFile).toHaveBeenCalledWith(
      'go.mod',
      Buffer.from('module example.com/test'),
    );
    expect(fs.writeLocalFile).toHaveBeenCalledWith(
      'vendor/modules.txt',
      Buffer.from('vendor contents'),
    );
    expect(fs.writeLocalFile).not.toHaveBeenCalledWith(
      'old.go',
      expect.anything(),
    );
    expect(fs.writeLocalFile).not.toHaveBeenCalledWith(
      'go.mod.link',
      expect.anything(),
    );

    expect(tidy.executeGoModTidy).toHaveBeenCalledWith(
      expect.objectContaining({
        updatedPackageFiles: [packageFile, deletedFile, symlink],
        updatedArtifacts: [existingArtifact],
      }),
    );
    expect(result?.updatedArtifacts).toEqual(
      expect.arrayContaining([existingArtifact, tidiedSum]),
    );
    expect(result?.artifactErrors).toEqual([tidyError]);
  });

  it('does not write an addition which is not a local file', async () => {
    const packageFile: FileChange = {
      type: 'addition',
      path: 'generated-directory',
      contents: 'not a file',
    };
    fs.localPathIsFile.mockResolvedValue(false);
    tidy.executeGoModTidy.mockResolvedValue({
      updatedArtifacts: [],
      artifactErrors: [],
    });

    await executePostUpdateOptions(
      baseConfig({ updatedPackageFiles: [packageFile] }),
    );

    expect(fs.writeLocalFile).not.toHaveBeenCalled();
  });

  it('writes updated files when contents are already a Buffer', async () => {
    const contents = Buffer.from('module example.com/test');
    const packageFile: FileChange = {
      type: 'addition',
      path: 'go.mod',
      contents,
    };

    fs.localPathIsFile.mockResolvedValue(true);
    tidy.executeGoModTidy.mockResolvedValue({
      updatedArtifacts: [],
      artifactErrors: [],
    });

    await executePostUpdateOptions(
      baseConfig({ updatedPackageFiles: [packageFile] }),
    );

    expect(fs.writeLocalFile).toHaveBeenCalledWith('go.mod', contents);
  });

  it('replaces existing artifacts when tidy returns the same file path', async () => {
    const existingArtifact: FileChange = {
      type: 'addition',
      path: 'go.sum',
      contents: 'old contents',
    };

    const updatedArtifact: FileChange = {
      type: 'addition',
      path: 'go.sum',
      contents: 'updated contents',
    };

    fs.localPathIsFile.mockResolvedValue(true);
    tidy.executeGoModTidy.mockResolvedValue({
      updatedArtifacts: [updatedArtifact],
      artifactErrors: [],
    });

    const result = await executePostUpdateOptions(
      baseConfig({
        updatedArtifacts: [existingArtifact],
      }),
    );

    expect(result?.updatedArtifacts).toEqual([updatedArtifact]);
  });

  it('returns null when Go mod tidy produces no result', async () => {
    const packageFile: FileChange = {
      type: 'addition',
      path: 'go.mod',
      contents: 'module example.com/test',
    };

    tidy.executeGoModTidy.mockResolvedValue(null as any);

    const result = await executePostUpdateOptions(
      baseConfig({
        updatedPackageFiles: [packageFile],
      }),
    );

    expect(tidy.executeGoModTidy).toHaveBeenCalled();
    expect(result).toBeNull();
  });
});
