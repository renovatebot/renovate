import { readFileSync } from 'fs';
import { extractPackageFile } from './extract';

const complexPrecommitConfig = readFileSync(
  'lib/manager/pre-commit/__fixtures__/complex.pre-commit-config.yaml',
  'utf8'
);

const examplePrecommitConfig = readFileSync(
  'lib/manager/pre-commit/__fixtures__/.pre-commit-config.yaml',
  'utf8'
);

describe('lib/manager/precommit/extract', () => {
  describe('extractPackageFile()', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });
    it('returns null for invalid yaml file content', () => {
      const result = extractPackageFile('nothing here: [');
      expect(result).toBeNull();
    });
    it('returns null for empty yaml file content', () => {
      const result = extractPackageFile('');
      expect(result).toBeNull();
    });
    it('returns null for no file content', () => {
      const result = extractPackageFile(null);
      expect(result).toBeNull();
    });
    it('extracts from values.yaml correctly with same structure as "pre-commit sample-config"', () => {
      const result = extractPackageFile(examplePrecommitConfig);
      expect(result).toMatchSnapshot();
    });
    it('extracts from complex config file correctly"', () => {
      const result = extractPackageFile(complexPrecommitConfig);
      expect(result).toMatchSnapshot();
    });
  });
});
