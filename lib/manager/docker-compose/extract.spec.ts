import { readFileSync } from 'fs';
import { extractPackageFile } from './extract';

const yamlFile3 = readFileSync(
  'lib/manager/docker-compose/__fixtures__/docker-compose.3.yml',
  'utf8'
);

describe('lib/manager/docker-compose/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });
    it('returns null for malformed YAML', () => {
      expect(extractPackageFile('nothing here\n:::::::')).toBeNull();
    });
    it('extracts multiple image lines for version 3', () => {
      const res = extractPackageFile(yamlFile3);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(8);
    });
  });
});
