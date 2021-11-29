import updateArtifacts from './artifacts';

describe('manager/git-submodules/artifact', () => {
  describe('updateArtifacts()', () => {
    it('returns empty content', () => {
      expect(
        updateArtifacts({
          packageFileName: '',
          updatedDeps: [{ depName: '' }],
          newPackageFileContent: '',
          config: {},
        })
      ).toMatchSnapshot([{ file: { contents: '', name: '' } }]);
    });
    it('returns two modules', () => {
      expect(
        updateArtifacts({
          packageFileName: '',
          updatedDeps: [{ depName: 'renovate' }, { depName: 'renovate-pro' }],
          newPackageFileContent: '',
          config: {},
        })
      ).toMatchSnapshot([
        { file: { name: 'renovate' } },
        { file: { name: 'renovate-pro' } },
      ]);
    });
  });
});
