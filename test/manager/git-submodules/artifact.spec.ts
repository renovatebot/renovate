import updateArtifacts from '../../../lib/manager/git-submodules/artifacts';

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
  });
});
