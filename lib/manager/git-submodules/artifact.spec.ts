import updateArtifacts from './artifacts';

describe('lib/manager/gitsubmodules/artifacts', () => {
  describe('updateArtifacts()', () => {
    it('returns empty content', () => {
      expect(
        updateArtifacts({
          packageFileName: '',
          updatedDeps: [''],
          newPackageFileContent: '',
          config: {},
        })
      ).toMatchSnapshot();
    });
    it('returns two modules', () => {
      expect(
        updateArtifacts({
          packageFileName: '',
          updatedDeps: ['renovate', 'renovate-pro'],
          newPackageFileContent: '',
          config: {},
        })
      ).toMatchSnapshot();
    });
  });
});
