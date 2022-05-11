import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

const environmentYml = Fixtures?.get('environment.yml');

describe('modules/manager/conda/extract', () => {
  describe('extractPackageFile', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('not an environment.yml')).toBeNull();
    });

    it('extracts dependencies', () => {
      const res = extractPackageFile(environmentYml);
      expect(res?.deps.filter((dep) => dep.skipReason)).toHaveLength(9);
      expect(res?.deps).toHaveLength(12);
      expect(res).toMatchSnapshot();
    });
  });
});
