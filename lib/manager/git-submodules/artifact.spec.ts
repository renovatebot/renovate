import { testName } from '../../../test/util';
import updateArtifacts from './artifacts';

describe(testName(), () => {
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
