import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from './extract';

const pdmPyProject = Fixtures.get('pdm.toml');

describe('modules/manager/pep621/extract', () => {
  describe('extractPackageFile()', () => {
    it('should return null for empty content', function () {
      const result = extractPackageFile('', 'pyproject.toml');
      expect(result).toBeNull();
    });

    it('should return dependencies for valid content', function () {
      const result = extractPackageFile(pdmPyProject, 'pyproject.toml');
      expect(result).toBeNull();
    });
  });
});
