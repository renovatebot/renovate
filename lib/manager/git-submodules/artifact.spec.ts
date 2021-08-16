import updateArtifacts from './artifacts';

describe('manager/git-submodules/artifact', () => {
  describe('updateArtifacts()', () => {
    it('returns empty content', () => {
      // FIXME: explicit assert condition
      expect(
        updateArtifacts({
          packageFileName: '',
          updatedDeps: [{ depName: '' }],
          newPackageFileContent: '',
          config: {},
        })
      ).toMatchSnapshot();
    });
    it('returns two modules', () => {
      // FIXME: explicit assert condition
      expect(
        updateArtifacts({
          packageFileName: '',
          updatedDeps: [{ depName: 'renovate' }, { depName: 'renovate-pro' }],
          newPackageFileContent: '',
          config: {},
        })
      ).toMatchSnapshot();
    });
  });
});
