import { updateArtifacts } from '.';

describe('modules/manager/git-submodules/artifact', () => {
  describe('updateArtifacts()', () => {
    it('returns empty content', () => {
      expect(
        updateArtifacts({
          packageFileName: '',
          updatedDeps: [{ depName: '' }],
          newPackageFileContent: '',
          config: {},
        }),
      ).toMatchObject([{ file: { type: 'addition', path: '', contents: '' } }]);
    });

    it('returns two modules', () => {
      expect(
        updateArtifacts({
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
  });
});
