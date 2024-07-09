import { fs } from '../../../../test/util';
import { updateArtifacts } from '.';

jest.mock('../../../util/fs');

describe('modules/manager/git-submodules/artifact', () => {
  describe('updateArtifacts()', () => {
    it('returns empty content', async () => {
      expect(
        await updateArtifacts({
          packageFileName: '',
          updatedDeps: [{ depName: '' }],
          newPackageFileContent: '',
          config: {},
        }),
      ).toMatchObject([{ file: { type: 'addition', path: '', contents: '' } }]);
    });

    it('returns two modules', async () => {
      expect(
        await updateArtifacts({
          packageFileName: '',
          updatedDeps: [{ depName: 'renovate' }, { depName: 'renovate-pro' }],
          newPackageFileContent: '',
          config: {},
        }),
      ).toMatchObject([
        { file: { type: 'addition', path: 'renovate', contents: '' } },
        { file: { type: 'addition', path: 'renovate-pro', contents: '' } },
      ]);
    });

    it('returns updated .gitmodules with new value as branch value', async () => {
      const updatedGitModules = `[submodule "renovate"]
  path = deps/renovate
  url = https://github.com/renovatebot/renovate.git
  branch = v0.0.2`;
      fs.readLocalFile.mockResolvedValueOnce(updatedGitModules);
      expect(
        await updateArtifacts({
          packageFileName: '',
          updatedDeps: [
            {
              depName: 'renovate',
              currentValue: 'v0.0.1',
              newValue: 'v0.0.2',
              packageFile: '.gitmodules',
            },
          ],
          newPackageFileContent: '',
          config: {},
        }),
      ).toMatchObject([
        { file: { type: 'addition', path: 'renovate', contents: '' } },
        {
          file: {
            type: 'addition',
            path: '.gitmodules',
            contents: updatedGitModules,
          },
        },
      ]);
      expect(fs.readLocalFile).toHaveBeenCalledWith('.gitmodules');
    });
  });
});
